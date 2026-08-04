import { createHash } from "node:crypto"

import {
  DataDocumentNotFoundError,
  DataRepositoryConflictError,
  DataRepositoryInitializationError,
  type DataDocument,
  type DataDocumentKind,
  type DataDocumentRevision,
  type DataDocumentRevisionOperation,
  type DataDocumentRevisionSummary,
  type DataRepositoryImportInput,
  type DataRepositoryInitializeInput,
  type DataRepositoryManagement,
  type DataRepositoryReadOptions,
  type DataRepositoryRestoreInput,
  type DataRepositorySnapshot,
  type DataRepositoryWriteInput,
  type DataRepositoryWriteResult,
} from "@i0c/config"
import {
  createPostgresClient,
  type PostgresSql,
  type PostgresTransactionSql,
} from "@i0c/database-postgres"
import type { AtomicVersionedDataRepository } from "@i0c/plugin-api"

import {
  resolvePostgresDataRepositoryConnectionOptions,
  type PostgresDataRepositoryConnectionOptions,
} from "./config"
import { postgresDataRepositoryManifest } from "./manifest"

interface DataDocumentRow {
  checksum: string
  content: string
  kind: DataDocumentKind
  revision: bigint | number | string
  updated_at: Date | string
}

interface RevisionRow {
  revision: bigint | number | string
}

interface DataDocumentRevisionRow extends DataDocumentRow {
  actor_github_user_id: string | null
  created_at: Date | string
  operation: DataDocumentRevisionOperation
}

interface DataDocumentKindRow {
  kind: DataDocumentKind
}

interface TableExistsRow {
  document_table_exists: boolean
  revision_table_exists: boolean
}

type RepositorySql = PostgresSql | PostgresTransactionSql

export interface PostgresDataRepositoryServices {
  sql?: PostgresSql
}

export type PostgresDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
> & {
  management: DataRepositoryManagement
}

export function createPostgresDataRepository(
  connectionOptions: PostgresDataRepositoryConnectionOptions,
  services: PostgresDataRepositoryServices = {},
): PostgresDataRepository {
  const options = resolvePostgresDataRepositoryConnectionOptions(
    connectionOptions,
  )
  const sql = services.sql ?? createPostgresClient(options.connectionString, {
    maxConnections: options.maxConnections,
    idleTimeoutSeconds: options.idleTimeoutSeconds,
    connectTimeoutSeconds: options.connectTimeoutSeconds,
  })

  const repository: PostgresDataRepository = {
    async read(kind) {
      return readDocument(sql, kind)
    },
    async readSnapshot() {
      return sql.begin(async (transaction) => {
        await transaction.unsafe(
          "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
        )
        const rows = await transaction<DataDocumentRow[]>`
          SELECT kind, content, revision, checksum, updated_at
          FROM i0c_data_document
          WHERE kind IN ('config', 'redirects')
          ORDER BY kind ASC
        `
        const config = rows.find((row) => row.kind === "config")
        const redirects = rows.find((row) => row.kind === "redirects")
        if (!config) {
          throw new DataDocumentNotFoundError("config")
        }
        if (!redirects) {
          throw new DataDocumentNotFoundError("redirects")
        }

        return {
          config: toDataDocument(config),
          redirects: toDataDocument(redirects),
          revision: createSnapshotRevision(config, redirects),
        }
      })
    },
    async write(kind, input) {
      return writeDocument(sql, kind, input, "save")
    },
    management: {
      async importSnapshot(input) {
        return importSnapshot(sql, input)
      },
      async initialize(input) {
        return initializeDocuments(sql, input)
      },
      async inspectSetupState() {
        const [table] = await sql<TableExistsRow[]>`
          SELECT
            TO_REGCLASS('i0c_data_document') IS NOT NULL
              AS document_table_exists,
            TO_REGCLASS('i0c_data_document_revision') IS NOT NULL
              AS revision_table_exists
        `
        if (
          !table?.document_table_exists
          || !table.revision_table_exists
        ) {
          return { state: "migration-required" }
        }
        const rows = await sql<DataDocumentKindRow[]>`
          SELECT kind
          FROM i0c_data_document
          WHERE kind IN ('config', 'redirects')
          ORDER BY kind ASC
        `
        const existingKinds = rows.map((row) => row.kind)
        if (existingKinds.length === 0) {
          return { state: "empty", existingKinds }
        }
        if (existingKinds.length === 2) {
          return { state: "initialized" }
        }
        return { state: "partial", existingKinds }
      },
      async listRevisions(input) {
        return listRevisions(sql, input)
      },
      async readRevision(input) {
        return readRevision(sql, input.kind, input.revision)
      },
      async restore(input) {
        return restoreRevision(sql, input)
      },
    },
  }

  return repository
}

export const postgresDataRepositoryPlugin = {
  manifest: postgresDataRepositoryManifest,
  create: createPostgresDataRepository,
}

async function writeDocument(
  sql: PostgresSql,
  kind: DataDocumentKind,
  input: DataRepositoryWriteInput,
  operation: DataDocumentRevisionOperation,
): Promise<DataRepositoryWriteResult> {
  assertPostgresRevision(input.expectedRevision)
  assertActorGitHubUserId(input.actorGitHubUserId)
  const checksum = createChecksum(input.content)

  return sql.begin(async (transaction) => {
    const rows = input.expectedRevision === "0"
      ? await transaction<DataDocumentRow[]>`
          INSERT INTO i0c_data_document (
            kind,
            content,
            revision,
            checksum,
            updated_at
          )
          VALUES (${kind}, ${input.content}, 1, ${checksum}, NOW())
          ON CONFLICT (kind) DO NOTHING
          RETURNING kind, content, revision, checksum, updated_at
        `
      : await transaction<DataDocumentRow[]>`
          UPDATE i0c_data_document
          SET
            content = ${input.content},
            revision = revision + 1,
            checksum = ${checksum},
            updated_at = NOW()
          WHERE
            kind = ${kind}
            AND revision = ${input.expectedRevision}::BIGINT
          RETURNING kind, content, revision, checksum, updated_at
        `
    const updated = rows[0]
    if (!updated) {
      await throwWriteConflict(
        transaction,
        kind,
        input.expectedRevision,
      )
    }

    await insertRevision(
      transaction,
      updated,
      operation,
      input.actorGitHubUserId,
    )
    return { revision: normalizeRevision(updated.revision) }
  })
}

async function initializeDocuments(
  sql: PostgresSql,
  input: DataRepositoryInitializeInput,
): Promise<DataRepositorySnapshot> {
  assertActorGitHubUserId(input.actorGitHubUserId)
  return sql.begin(async (transaction) => {
    await transaction.unsafe(
      "LOCK TABLE i0c_data_document IN SHARE ROW EXCLUSIVE MODE",
    )
    const existing = await transaction<DataDocumentKindRow[]>`
      SELECT kind
      FROM i0c_data_document
      WHERE kind IN ('config', 'redirects')
      FOR UPDATE
    `
    if (existing.length > 0) {
      throw new DataRepositoryInitializationError(
        "The data repository has already been initialized",
      )
    }

    const rows = await transaction<DataDocumentRow[]>`
      INSERT INTO i0c_data_document (
        kind,
        content,
        revision,
        checksum,
        updated_at
      )
      VALUES
        (
          'config',
          ${input.configContent},
          1,
          ${createChecksum(input.configContent)},
          NOW()
        ),
        (
          'redirects',
          ${input.redirectsContent},
          1,
          ${createChecksum(input.redirectsContent)},
          NOW()
        )
      RETURNING kind, content, revision, checksum, updated_at
    `
    const config = requireDocumentRow(rows, "config")
    const redirects = requireDocumentRow(rows, "redirects")
    await insertRevision(
      transaction,
      config,
      "initialize",
      input.actorGitHubUserId,
    )
    await insertRevision(
      transaction,
      redirects,
      "initialize",
      input.actorGitHubUserId,
    )
    return toSnapshot(config, redirects)
  })
}

async function importSnapshot(
  sql: PostgresSql,
  input: DataRepositoryImportInput,
): Promise<DataRepositorySnapshot> {
  assertPostgresRevision(input.expectedConfigRevision)
  assertPostgresRevision(input.expectedRedirectsRevision)
  assertActorGitHubUserId(input.actorGitHubUserId)

  return sql.begin(async (transaction) => {
    const config = await updateExistingDocument(
      transaction,
      "config",
      input.configContent,
      input.expectedConfigRevision,
    )
    const redirects = await updateExistingDocument(
      transaction,
      "redirects",
      input.redirectsContent,
      input.expectedRedirectsRevision,
    )
    await insertRevision(
      transaction,
      config,
      "import",
      input.actorGitHubUserId,
    )
    await insertRevision(
      transaction,
      redirects,
      "import",
      input.actorGitHubUserId,
    )
    return toSnapshot(config, redirects)
  })
}

async function listRevisions(
  sql: PostgresSql,
  input: {
    beforeRevision?: string
    kind: DataDocumentKind
    limit?: number
  },
): Promise<readonly DataDocumentRevisionSummary[]> {
  const limit = input.limit ?? 50
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError("Revision list limit must be an integer from 1 to 100")
  }
  if (input.beforeRevision !== undefined) {
    assertPostgresRevision(input.beforeRevision)
  }
  const rows = input.beforeRevision === undefined
    ? await sql<DataDocumentRevisionRow[]>`
        SELECT
          kind,
          revision,
          checksum,
          operation,
          actor_github_user_id,
          created_at,
          content,
          created_at AS updated_at
        FROM i0c_data_document_revision
        WHERE kind = ${input.kind}
        ORDER BY revision DESC
        LIMIT ${limit}
      `
    : await sql<DataDocumentRevisionRow[]>`
        SELECT
          kind,
          revision,
          checksum,
          operation,
          actor_github_user_id,
          created_at,
          content,
          created_at AS updated_at
        FROM i0c_data_document_revision
        WHERE
          kind = ${input.kind}
          AND revision < ${input.beforeRevision}::BIGINT
        ORDER BY revision DESC
        LIMIT ${limit}
      `
  return rows.map(toRevisionSummary)
}

async function readRevision(
  sql: PostgresSql,
  kind: DataDocumentKind,
  revision: string,
): Promise<DataDocumentRevision> {
  assertPostgresRevision(revision)
  const [row] = await sql<DataDocumentRevisionRow[]>`
    SELECT
      kind,
      revision,
      checksum,
      operation,
      actor_github_user_id,
      created_at,
      content,
      created_at AS updated_at
    FROM i0c_data_document_revision
    WHERE
      kind = ${kind}
      AND revision = ${revision}::BIGINT
  `
  if (!row) {
    throw new DataDocumentNotFoundError(kind)
  }
  return {
    ...toRevisionSummary(row),
    content: row.content,
  }
}

async function restoreRevision(
  sql: PostgresSql,
  input: DataRepositoryRestoreInput,
): Promise<DataRepositoryWriteResult> {
  assertPostgresRevision(input.revision)
  assertPostgresRevision(input.expectedRevision)
  assertActorGitHubUserId(input.actorGitHubUserId)

  return sql.begin(async (transaction) => {
    const [source] = await transaction<DataDocumentRevisionRow[]>`
      SELECT
        kind,
        revision,
        checksum,
        operation,
        actor_github_user_id,
        created_at,
        content,
        created_at AS updated_at
      FROM i0c_data_document_revision
      WHERE
        kind = ${input.kind}
        AND revision = ${input.revision}::BIGINT
    `
    if (!source) {
      throw new DataDocumentNotFoundError(input.kind)
    }
    const updated = await updateExistingDocument(
      transaction,
      input.kind,
      source.content,
      input.expectedRevision,
    )
    await insertRevision(
      transaction,
      updated,
      "rollback",
      input.actorGitHubUserId,
    )
    return { revision: normalizeRevision(updated.revision) }
  })
}

async function updateExistingDocument(
  sql: RepositorySql,
  kind: DataDocumentKind,
  content: string,
  expectedRevision: string,
): Promise<DataDocumentRow> {
  const rows = await sql<DataDocumentRow[]>`
    UPDATE i0c_data_document
    SET
      content = ${content},
      revision = revision + 1,
      checksum = ${createChecksum(content)},
      updated_at = NOW()
    WHERE
      kind = ${kind}
      AND revision = ${expectedRevision}::BIGINT
    RETURNING kind, content, revision, checksum, updated_at
  `
  const updated = rows[0]
  if (!updated) {
    await throwWriteConflict(sql, kind, expectedRevision)
  }
  return updated
}

async function throwWriteConflict(
  sql: RepositorySql,
  kind: DataDocumentKind,
  expectedRevision: string,
): Promise<never> {
  const [current] = await sql<RevisionRow[]>`
    SELECT revision
    FROM i0c_data_document
    WHERE kind = ${kind}
  `
  if (!current) {
    throw new DataDocumentNotFoundError(kind)
  }
  throw new DataRepositoryConflictError(
    kind,
    expectedRevision,
    normalizeRevision(current.revision),
  )
}

async function insertRevision(
  sql: RepositorySql,
  document: DataDocumentRow,
  operation: DataDocumentRevisionOperation,
  actorGitHubUserId: string | undefined,
): Promise<void> {
  await sql`
    INSERT INTO i0c_data_document_revision (
      kind,
      revision,
      content,
      checksum,
      operation,
      actor_github_user_id,
      created_at
    )
    VALUES (
      ${document.kind},
      ${normalizeRevision(document.revision)}::BIGINT,
      ${document.content},
      ${document.checksum},
      ${operation},
      ${actorGitHubUserId ?? null},
      ${document.updated_at}
    )
  `
}

function requireDocumentRow(
  rows: readonly DataDocumentRow[],
  kind: DataDocumentKind,
): DataDocumentRow {
  const row = rows.find((candidate) => candidate.kind === kind)
  if (!row) {
    throw new DataRepositoryInitializationError(
      `The ${kind} document could not be initialized`,
    )
  }
  return row
}

function toSnapshot(
  config: DataDocumentRow,
  redirects: DataDocumentRow,
): DataRepositorySnapshot {
  return {
    config: toDataDocument(config),
    redirects: toDataDocument(redirects),
    revision: createSnapshotRevision(config, redirects),
  }
}

function toRevisionSummary(
  row: DataDocumentRevisionRow,
): DataDocumentRevisionSummary {
  return {
    ...(row.actor_github_user_id
      ? { actorGitHubUserId: row.actor_github_user_id }
      : {}),
    checksum: row.checksum,
    createdAt: new Date(row.created_at).toISOString(),
    kind: row.kind,
    operation: row.operation,
    revision: normalizeRevision(row.revision),
  }
}

function assertActorGitHubUserId(
  actorGitHubUserId: string | undefined,
): void {
  if (
    actorGitHubUserId !== undefined
    && !/^[1-9]\d*$/.test(actorGitHubUserId)
  ) {
    throw new TypeError("Actor GitHub user ID must be a numeric ID")
  }
}

function assertPostgresRevision(revision: string): void {
  if (!/^(?:0|[1-9]\d*)$/.test(revision)) {
    throw new TypeError(
      "PostgreSQL data repository revisions must be non-negative integers",
    )
  }
}

function createChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function createSnapshotRevision(
  config: DataDocumentRow,
  redirects: DataDocumentRow,
): string {
  return createHash("sha256")
    .update(
      [
        `config:${normalizeRevision(config.revision)}:${config.checksum}`,
        `redirects:${normalizeRevision(redirects.revision)}:${redirects.checksum}`,
      ].join("\n"),
    )
    .digest("hex")
}

function normalizeRevision(revision: bigint | number | string): string {
  return String(revision)
}

async function readDocument(
  sql: PostgresSql,
  kind: DataDocumentKind,
): Promise<DataDocument> {
  const [row] = await sql<DataDocumentRow[]>`
    SELECT kind, content, revision, checksum, updated_at
    FROM i0c_data_document
    WHERE kind = ${kind}
  `
  if (!row) {
    throw new DataDocumentNotFoundError(kind)
  }
  return toDataDocument(row)
}

function toDataDocument(row: DataDocumentRow): DataDocument {
  return {
    content: row.content,
    revision: normalizeRevision(row.revision),
  }
}
