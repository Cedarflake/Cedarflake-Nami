import { createHash } from "node:crypto"

import postgres, { type Sql } from "postgres"

import {
  DataDocumentNotFoundError,
  DataRepositoryConflictError,
  type DataDocument,
  type DataDocumentKind,
  type DataRepositoryReadOptions,
  type DataRepositorySnapshot,
  type DataRepositoryWriteInput,
  type DataRepositoryWriteResult,
} from "@i0c/config"
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

export interface PostgresDataRepositoryServices {
  sql?: Sql
}

export type PostgresDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
>

export function createPostgresDataRepository(
  connectionOptions: PostgresDataRepositoryConnectionOptions,
  services: PostgresDataRepositoryServices = {},
): PostgresDataRepository {
  const options = resolvePostgresDataRepositoryConnectionOptions(
    connectionOptions,
  )
  const sql = services.sql ?? postgres(options.connectionString, {
    max: options.maxConnections,
    idle_timeout: options.idleTimeoutSeconds,
    connect_timeout: options.connectTimeoutSeconds,
    prepare: false,
  })

  return {
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
      assertPostgresRevision(input.expectedRevision)
      const checksum = createChecksum(input.content)
      const rows = input.expectedRevision === "0"
        ? await sql<DataDocumentRow[]>`
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
        : await sql<DataDocumentRow[]>`
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
      if (updated) {
        return { revision: normalizeRevision(updated.revision) }
      }

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
        input.expectedRevision,
        normalizeRevision(current.revision),
      )
    },
  }
}

export const postgresDataRepositoryPlugin = {
  manifest: postgresDataRepositoryManifest,
  create: createPostgresDataRepository,
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
  sql: Sql,
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
