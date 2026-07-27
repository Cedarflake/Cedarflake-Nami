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
import type { AtomicVersionedDataRepository } from "@i0c/plugin-api"

import type { D1Database, D1PreparedStatement, D1Result } from "./d1"
import { d1All, d1Batch } from "./d1"
import { d1DataRepositoryManifest } from "./manifest"

interface DataDocumentRow {
  checksum: string
  content: string
  kind: DataDocumentKind
  mutation_id: string
  revision: number | string
  updated_at: string
}

interface DataDocumentRevisionRow extends DataDocumentRow {
  actor_github_user_id: string | null
  created_at: string
  operation: DataDocumentRevisionOperation
}

interface DataDocumentKindRow {
  kind: DataDocumentKind
}

interface TableNameRow {
  name: string
}

export interface D1DataRepositoryServices {
  clock?: () => Date
  createMutationId?: () => string
}

export type D1DataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
> & {
  management: DataRepositoryManagement
}

export function createD1DataRepository(
  database: D1Database,
  services: D1DataRepositoryServices = {},
): D1DataRepository {
  const clock = services.clock ?? (() => new Date())
  const createMutationId = services.createMutationId ?? (() => crypto.randomUUID())

  return {
    async read(kind) {
      return readDocument(database, kind)
    },
    async readSnapshot() {
      return readSnapshot(database)
    },
    async write(kind, input) {
      return writeDocument(
        database,
        kind,
        input,
        "save",
        clock,
        createMutationId,
      )
    },
    management: {
      async importSnapshot(input) {
        return importSnapshot(database, input, clock, createMutationId)
      },
      async initialize(input) {
        return initializeDocuments(database, input, clock, createMutationId)
      },
      async inspectSetupState() {
        return inspectSetupState(database)
      },
      async listRevisions(input) {
        return listRevisions(database, input)
      },
      async readRevision(input) {
        return readRevision(database, input.kind, input.revision)
      },
      async restore(input) {
        return restoreRevision(database, input, clock, createMutationId)
      },
    },
  }
}

export const d1DataRepositoryPlugin = {
  manifest: d1DataRepositoryManifest,
  create: createD1DataRepository,
}

async function writeDocument(
  database: D1Database,
  kind: DataDocumentKind,
  input: DataRepositoryWriteInput,
  operation: DataDocumentRevisionOperation,
  clock: () => Date,
  createMutationId: () => string,
): Promise<DataRepositoryWriteResult> {
  assertD1Revision(input.expectedRevision)
  assertActorGitHubUserId(input.actorGitHubUserId)
  const checksum = await createChecksum(input.content)
  const mutationId = createMutationId()
  const updatedAt = clock().toISOString()
  const mutation = input.expectedRevision === "0"
    ? database.prepare(`
        INSERT INTO i0c_data_document (
          kind,
          content,
          revision,
          checksum,
          updated_at,
          mutation_id
        )
        VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT (kind) DO NOTHING
      `).bind(kind, input.content, checksum, updatedAt, mutationId)
    : database.prepare(`
        UPDATE i0c_data_document
        SET
          content = ?,
          revision = revision + 1,
          checksum = ?,
          updated_at = ?,
          mutation_id = ?
        WHERE kind = ? AND revision = ?
      `).bind(
        input.content,
        checksum,
        updatedAt,
        mutationId,
        kind,
        toRevisionBinding(input.expectedRevision),
      )

  const results = await d1Batch(database, [
    mutation,
    createRevisionInsert(
      database,
      operation,
      input.actorGitHubUserId,
      "kind = ? AND mutation_id = ?",
      kind,
      mutationId,
    ),
  ])

  if (!hasExpectedChanges(results[0], 1)) {
    await throwWriteConflict(database, kind, input.expectedRevision)
  }
  return { revision: incrementRevision(input.expectedRevision) }
}

async function initializeDocuments(
  database: D1Database,
  input: DataRepositoryInitializeInput,
  clock: () => Date,
  createMutationId: () => string,
): Promise<DataRepositorySnapshot> {
  assertActorGitHubUserId(input.actorGitHubUserId)
  const mutationId = createMutationId()
  const updatedAt = clock().toISOString()
  const configChecksum = await createChecksum(input.configContent)
  const redirectsChecksum = await createChecksum(input.redirectsContent)

  const results = await d1Batch(database, [
    database.prepare(`
      INSERT INTO i0c_data_document (
        kind,
        content,
        revision,
        checksum,
        updated_at,
        mutation_id
      )
      SELECT 'config', ?, 1, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM i0c_data_document
        WHERE kind IN ('config', 'redirects')
      )
      UNION ALL
      SELECT 'redirects', ?, 1, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM i0c_data_document
        WHERE kind IN ('config', 'redirects')
      )
    `).bind(
      input.configContent,
      configChecksum,
      updatedAt,
      mutationId,
      input.redirectsContent,
      redirectsChecksum,
      updatedAt,
      mutationId,
    ),
    createRevisionInsert(
      database,
      "initialize",
      input.actorGitHubUserId,
      "mutation_id = ?",
      mutationId,
    ),
  ])

  if (!hasExpectedChanges(results[0], 2)) {
    throw new DataRepositoryInitializationError(
      "The data repository has already been initialized",
    )
  }
  return readSnapshotAtRevisions(database, "1", "1")
}

async function importSnapshot(
  database: D1Database,
  input: DataRepositoryImportInput,
  clock: () => Date,
  createMutationId: () => string,
): Promise<DataRepositorySnapshot> {
  assertD1Revision(input.expectedConfigRevision)
  assertD1Revision(input.expectedRedirectsRevision)
  assertActorGitHubUserId(input.actorGitHubUserId)
  const mutationId = createMutationId()
  const updatedAt = clock().toISOString()
  const configChecksum = await createChecksum(input.configContent)
  const redirectsChecksum = await createChecksum(input.redirectsContent)

  const results = await d1Batch(database, [
    database.prepare(`
      UPDATE i0c_data_document
      SET
        content = CASE kind
          WHEN 'config' THEN ?
          ELSE ?
        END,
        revision = revision + 1,
        checksum = CASE kind
          WHEN 'config' THEN ?
          ELSE ?
        END,
        updated_at = ?,
        mutation_id = ?
      WHERE
        kind IN ('config', 'redirects')
        AND EXISTS (
          SELECT 1
          FROM i0c_data_document
          WHERE kind = 'config' AND revision = ?
        )
        AND EXISTS (
          SELECT 1
          FROM i0c_data_document
          WHERE kind = 'redirects' AND revision = ?
        )
    `).bind(
      input.configContent,
      input.redirectsContent,
      configChecksum,
      redirectsChecksum,
      updatedAt,
      mutationId,
      toRevisionBinding(input.expectedConfigRevision),
      toRevisionBinding(input.expectedRedirectsRevision),
    ),
    createRevisionInsert(
      database,
      "import",
      input.actorGitHubUserId,
      "mutation_id = ?",
      mutationId,
    ),
  ])

  if (!hasExpectedChanges(results[0], 2)) {
    await assertExpectedRevision(
      database,
      "config",
      input.expectedConfigRevision,
    )
    await assertExpectedRevision(
      database,
      "redirects",
      input.expectedRedirectsRevision,
    )
    throw new DataRepositoryInitializationError(
      "The D1 data repository import did not update both documents",
    )
  }

  return readSnapshotAtRevisions(
    database,
    incrementRevision(input.expectedConfigRevision),
    incrementRevision(input.expectedRedirectsRevision),
  )
}

async function restoreRevision(
  database: D1Database,
  input: DataRepositoryRestoreInput,
  clock: () => Date,
  createMutationId: () => string,
): Promise<DataRepositoryWriteResult> {
  assertD1Revision(input.revision)
  assertD1Revision(input.expectedRevision)
  assertActorGitHubUserId(input.actorGitHubUserId)
  const mutationId = createMutationId()
  const updatedAt = clock().toISOString()

  const results = await d1Batch(database, [
    database.prepare(`
      UPDATE i0c_data_document
      SET
        content = (
          SELECT content
          FROM i0c_data_document_revision
          WHERE kind = ? AND revision = ?
        ),
        checksum = (
          SELECT checksum
          FROM i0c_data_document_revision
          WHERE kind = ? AND revision = ?
        ),
        revision = revision + 1,
        updated_at = ?,
        mutation_id = ?
      WHERE
        kind = ?
        AND revision = ?
        AND EXISTS (
          SELECT 1
          FROM i0c_data_document_revision
          WHERE kind = ? AND revision = ?
        )
    `).bind(
      input.kind,
      toRevisionBinding(input.revision),
      input.kind,
      toRevisionBinding(input.revision),
      updatedAt,
      mutationId,
      input.kind,
      toRevisionBinding(input.expectedRevision),
      input.kind,
      toRevisionBinding(input.revision),
    ),
    createRevisionInsert(
      database,
      "rollback",
      input.actorGitHubUserId,
      "kind = ? AND mutation_id = ?",
      input.kind,
      mutationId,
    ),
  ])

  if (!hasExpectedChanges(results[0], 1)) {
    await requireRevisionRow(database, input.kind, input.revision)
    await assertExpectedRevision(database, input.kind, input.expectedRevision)
    throw new DataRepositoryInitializationError(
      "The D1 data repository restore did not update the document",
    )
  }
  return { revision: incrementRevision(input.expectedRevision) }
}

async function inspectSetupState(
  database: D1Database,
): Promise<
  | { state: "migration-required" }
  | { existingKinds: readonly DataDocumentKind[]; state: "empty" | "partial" }
  | { state: "initialized" }
> {
  const tables = await d1All<TableNameRow>(database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE
      type = 'table'
      AND name IN ('i0c_data_document', 'i0c_data_document_revision')
    ORDER BY name ASC
  `))
  if (tables.length !== 2) {
    return { state: "migration-required" }
  }

  const rows = await d1All<DataDocumentKindRow>(database.prepare(`
    SELECT kind
    FROM i0c_data_document
    WHERE kind IN ('config', 'redirects')
    ORDER BY kind ASC
  `))
  const existingKinds = rows.map((row) => row.kind)
  if (existingKinds.length === 0) {
    return { state: "empty", existingKinds }
  }
  if (existingKinds.length === 2) {
    return { state: "initialized" }
  }
  return { state: "partial", existingKinds }
}

async function listRevisions(
  database: D1Database,
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
    assertD1Revision(input.beforeRevision)
  }
  const statement = input.beforeRevision === undefined
    ? database.prepare(`
        SELECT
          kind,
          revision,
          checksum,
          operation,
          actor_github_user_id,
          created_at,
          content,
          created_at AS updated_at,
          '' AS mutation_id
        FROM i0c_data_document_revision
        WHERE kind = ?
        ORDER BY revision DESC
        LIMIT ?
      `).bind(input.kind, limit)
    : database.prepare(`
        SELECT
          kind,
          revision,
          checksum,
          operation,
          actor_github_user_id,
          created_at,
          content,
          created_at AS updated_at,
          '' AS mutation_id
        FROM i0c_data_document_revision
        WHERE kind = ? AND revision < ?
        ORDER BY revision DESC
        LIMIT ?
      `).bind(
        input.kind,
        toRevisionBinding(input.beforeRevision),
        limit,
      )
  return (await d1All<DataDocumentRevisionRow>(statement)).map(
    toRevisionSummary,
  )
}

async function readRevision(
  database: D1Database,
  kind: DataDocumentKind,
  revision: string,
): Promise<DataDocumentRevision> {
  assertD1Revision(revision)
  const row = await requireRevisionRow(database, kind, revision)
  return {
    ...toRevisionSummary(row),
    content: row.content,
  }
}

async function readDocument(
  database: D1Database,
  kind: DataDocumentKind,
): Promise<DataDocument> {
  const rows = await d1All<DataDocumentRow>(database.prepare(`
    SELECT kind, content, revision, checksum, updated_at, mutation_id
    FROM i0c_data_document
    WHERE kind = ?
  `).bind(kind))
  const row = rows[0]
  if (!row) {
    throw new DataDocumentNotFoundError(kind)
  }
  return toDataDocument(row)
}

async function readSnapshot(
  database: D1Database,
): Promise<DataRepositorySnapshot> {
  const rows = await d1All<DataDocumentRow>(database.prepare(`
    SELECT kind, content, revision, checksum, updated_at, mutation_id
    FROM i0c_data_document
    WHERE kind IN ('config', 'redirects')
    ORDER BY kind ASC
  `))
  return toSnapshot(
    requireDocumentRow(rows, "config"),
    requireDocumentRow(rows, "redirects"),
  )
}

async function readSnapshotAtRevisions(
  database: D1Database,
  configRevision: string,
  redirectsRevision: string,
): Promise<DataRepositorySnapshot> {
  const rows = await d1All<DataDocumentRow>(database.prepare(`
    SELECT
      kind,
      content,
      revision,
      checksum,
      created_at AS updated_at,
      '' AS mutation_id
    FROM i0c_data_document_revision
    WHERE
      (kind = 'config' AND revision = ?)
      OR (kind = 'redirects' AND revision = ?)
    ORDER BY kind ASC
  `).bind(
    toRevisionBinding(configRevision),
    toRevisionBinding(redirectsRevision),
  ))
  return toSnapshot(
    requireDocumentRow(rows, "config"),
    requireDocumentRow(rows, "redirects"),
  )
}

async function requireRevisionRow(
  database: D1Database,
  kind: DataDocumentKind,
  revision: string,
): Promise<DataDocumentRevisionRow> {
  const rows = await d1All<DataDocumentRevisionRow>(database.prepare(`
    SELECT
      kind,
      revision,
      checksum,
      operation,
      actor_github_user_id,
      created_at,
      content,
      created_at AS updated_at,
      '' AS mutation_id
    FROM i0c_data_document_revision
    WHERE kind = ? AND revision = ?
  `).bind(kind, toRevisionBinding(revision)))
  const row = rows[0]
  if (!row) {
    throw new DataDocumentNotFoundError(kind)
  }
  return row
}

function createRevisionInsert(
  database: D1Database,
  operation: DataDocumentRevisionOperation,
  actorGitHubUserId: string | undefined,
  predicate: string,
  ...values: readonly unknown[]
): D1PreparedStatement {
  return database.prepare(`
    INSERT INTO i0c_data_document_revision (
      kind,
      revision,
      content,
      checksum,
      operation,
      actor_github_user_id,
      created_at
    )
    SELECT
      kind,
      revision,
      content,
      checksum,
      ?,
      ?,
      updated_at
    FROM i0c_data_document
    WHERE ${predicate}
    ORDER BY kind ASC
  `).bind(operation, actorGitHubUserId ?? null, ...values)
}

function hasExpectedChanges(
  result: D1Result | undefined,
  expected: number,
): boolean {
  return Number(result?.meta?.changes ?? 0) === expected
}

async function assertExpectedRevision(
  database: D1Database,
  kind: DataDocumentKind,
  expectedRevision: string,
): Promise<void> {
  const rows = await d1All<{ revision: number | string }>(database.prepare(`
    SELECT revision
    FROM i0c_data_document
    WHERE kind = ?
  `).bind(kind))
  const current = rows[0]
  if (!current) {
    throw new DataDocumentNotFoundError(kind)
  }
  const actualRevision = normalizeRevision(current.revision)
  if (actualRevision !== expectedRevision) {
    throw new DataRepositoryConflictError(
      kind,
      expectedRevision,
      actualRevision,
    )
  }
}

async function throwWriteConflict(
  database: D1Database,
  kind: DataDocumentKind,
  expectedRevision: string,
): Promise<never> {
  await assertExpectedRevision(database, kind, expectedRevision)
  throw new DataRepositoryInitializationError(
    "The D1 data repository write did not update the document",
  )
}

function requireDocumentRow(
  rows: readonly DataDocumentRow[],
  kind: DataDocumentKind,
): DataDocumentRow {
  const row = rows.find((candidate) => candidate.kind === kind)
  if (!row) {
    throw new DataDocumentNotFoundError(kind)
  }
  return row
}

async function toSnapshot(
  config: DataDocumentRow,
  redirects: DataDocumentRow,
): Promise<DataRepositorySnapshot> {
  return {
    config: toDataDocument(config),
    redirects: toDataDocument(redirects),
    revision: await createSnapshotRevision(config, redirects),
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

function toDataDocument(row: DataDocumentRow): DataDocument {
  return {
    content: row.content,
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

function assertD1Revision(revision: string): void {
  if (!/^(?:0|[1-9]\d*)$/.test(revision)) {
    throw new TypeError(
      "D1 data repository revisions must be non-negative integers",
    )
  }
}

function incrementRevision(revision: string): string {
  return (BigInt(revision) + 1n).toString()
}

function toRevisionBinding(revision: string): number | string {
  const numeric = BigInt(revision)
  return numeric <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(numeric)
    : revision
}

async function createChecksum(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  )
  return toHex(digest)
}

async function createSnapshotRevision(
  config: DataDocumentRow,
  redirects: DataDocumentRow,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode([
      `config:${normalizeRevision(config.revision)}:${config.checksum}`,
      `redirects:${normalizeRevision(redirects.revision)}:${redirects.checksum}`,
    ].join("\n")),
  )
  return toHex(digest)
}

function toHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("")
}

function normalizeRevision(revision: number | string): string {
  return String(revision)
}
