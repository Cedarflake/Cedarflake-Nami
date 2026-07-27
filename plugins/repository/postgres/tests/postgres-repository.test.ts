import assert from "node:assert/strict"
import test from "node:test"

import postgres, { type Sql } from "postgres"

import { DataRepositoryConflictError } from "@i0c/config"
import {
  assertPluginManifest,
  assertVersionedDataRepositoryContract,
} from "@i0c/plugin-testkit"

import {
  resolvePostgresDataRepositoryConnectionOptions,
} from "../src/config"
import { postgresDataRepositoryManifest } from "../src/manifest"
import {
  createPostgresDataRepositoryMigrationProvider,
} from "../src/migrations"
import { createPostgresDataRepository } from "../src/repository"

test("declares a valid PostgreSQL data repository manifest", () => {
  assertPluginManifest(postgresDataRepositoryManifest)
})

test("resolves safe PostgreSQL connection defaults", () => {
  assert.deepEqual(
    resolvePostgresDataRepositoryConnectionOptions({
      connectionString: " postgres://example ",
    }),
    {
      connectionString: "postgres://example",
      maxConnections: 3,
      idleTimeoutSeconds: 20,
      connectTimeoutSeconds: 30,
    },
  )
})

test("rejects invalid PostgreSQL connection limits", () => {
  assert.throws(
    () => resolvePostgresDataRepositoryConnectionOptions({
      connectionString: "postgres://example",
      maxConnections: 0,
    }),
    /maxConnections must be a positive integer/,
  )
})

test("satisfies the shared versioned repository contract", async () => {
  const sql = createMemorySql()
  const repository = createPostgresDataRepository(
    { connectionString: "postgres://contract-test" },
    { sql },
  )
  assert.deepEqual(
    await repository.write("config", {
      content: "{\"schemaVersion\":1}",
      expectedRevision: "0",
    }),
    { revision: "1" },
  )
  assert.deepEqual(
    await repository.write("redirects", {
      content: "{\"Slots\":{}}",
      expectedRevision: "0",
    }),
    { revision: "1" },
  )

  await assertVersionedDataRepositoryContract({
    repository,
    kind: "config",
    readOptions: {},
    writeInput: {
      content: "{\"schemaVersion\":1,\"updated\":true}",
      expectedRevision: "1",
    },
    expectedBefore: {
      content: "{\"schemaVersion\":1}",
      revision: "1",
    },
    expectedWriteResult: { revision: "2" },
    expectedAfter: {
      content: "{\"schemaVersion\":1,\"updated\":true}",
      revision: "2",
    },
  })

  const snapshot = await repository.readSnapshot({})
  assert.equal(snapshot.config.revision, "2")
  assert.equal(snapshot.redirects.revision, "1")
  assert.match(snapshot.revision, /^[0-9a-f]{64}$/)

  await assert.rejects(
    repository.write("config", {
      content: "{\"schemaVersion\":1,\"stale\":true}",
      expectedRevision: "1",
    }),
    DataRepositoryConflictError,
  )
})

const integrationConnectionString =
  process.env.TEST_DATA_REPOSITORY_DATABASE_URL?.trim()

test(
  "satisfies the versioned repository contract with PostgreSQL",
  { skip: integrationConnectionString ? false : "TEST_DATA_REPOSITORY_DATABASE_URL is not set" },
  async () => {
    const connectionString = integrationConnectionString
    assert.ok(connectionString)
    const migrations = createPostgresDataRepositoryMigrationProvider({
      connectionString,
    })
    await migrations.applyMigrations()
    const sql = postgres(connectionString, {
      max: 1,
      idle_timeout: 1,
      connect_timeout: 30,
      prepare: false,
    })

    try {
      await sql`DELETE FROM i0c_data_document`
      const repository = createPostgresDataRepository(
        { connectionString },
        { sql },
      )
      assert.deepEqual(
        await repository.write("config", {
          content: "{\"schemaVersion\":1}",
          expectedRevision: "0",
        }),
        { revision: "1" },
      )
      assert.deepEqual(
        await repository.write("redirects", {
          content: "{\"Slots\":{}}",
          expectedRevision: "0",
        }),
        { revision: "1" },
      )

      await assertVersionedDataRepositoryContract({
        repository,
        kind: "config",
        readOptions: {},
        writeInput: {
          content: "{\"schemaVersion\":1,\"updated\":true}",
          expectedRevision: "1",
        },
        expectedBefore: {
          content: "{\"schemaVersion\":1}",
          revision: "1",
        },
        expectedWriteResult: { revision: "2" },
        expectedAfter: {
          content: "{\"schemaVersion\":1,\"updated\":true}",
          revision: "2",
        },
      })

      const snapshot = await repository.readSnapshot({})
      assert.equal(snapshot.config.revision, "2")
      assert.equal(snapshot.redirects.revision, "1")
      assert.match(snapshot.revision, /^[0-9a-f]{64}$/)

      await assert.rejects(
        repository.write("config", {
          content: "{\"schemaVersion\":1,\"stale\":true}",
          expectedRevision: "1",
        }),
        (error) => {
          assert.ok(error instanceof DataRepositoryConflictError)
          assert.equal(error.actualRevision, "2")
          return true
        },
      )
    } finally {
      await sql`DELETE FROM i0c_data_document`
      await sql.end({ timeout: 5 })
    }
  },
)

interface MemoryRow {
  checksum: string
  content: string
  kind: "config" | "redirects"
  revision: number
  updated_at: Date
}

interface MemorySqlTag {
  (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<MemoryRow[] | Array<{ revision: number }>>
  begin<T>(operation: (transaction: MemorySqlTag) => Promise<T>): Promise<T>
  unsafe(query: string): Promise<readonly unknown[]>
}

function createMemorySql(): Sql {
  const rows = new Map<MemoryRow["kind"], MemoryRow>()
  const query = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const statement = strings.join("?").replace(/\s+/g, " ").trim()
    if (statement.startsWith("INSERT INTO i0c_data_document")) {
      const kind = values[0] as MemoryRow["kind"]
      if (rows.has(kind)) {
        return []
      }
      const row: MemoryRow = {
        kind,
        content: String(values[1]),
        revision: 1,
        checksum: String(values[2]),
        updated_at: new Date(),
      }
      rows.set(kind, row)
      return [{ ...row }]
    }
    if (statement.startsWith("UPDATE i0c_data_document")) {
      const kind = values[2] as MemoryRow["kind"]
      const current = rows.get(kind)
      if (!current || current.revision !== Number(values[3])) {
        return []
      }
      const row: MemoryRow = {
        ...current,
        content: String(values[0]),
        revision: current.revision + 1,
        checksum: String(values[1]),
        updated_at: new Date(),
      }
      rows.set(kind, row)
      return [{ ...row }]
    }
    if (statement.includes("WHERE kind IN ('config', 'redirects')")) {
      return [...rows.values()]
        .sort((left, right) => left.kind.localeCompare(right.kind))
        .map((row) => ({ ...row }))
    }
    if (
      statement.startsWith("SELECT revision")
      && statement.includes("FROM i0c_data_document")
    ) {
      const row = rows.get(values[0] as MemoryRow["kind"])
      return row ? [{ revision: row.revision }] : []
    }
    if (statement.startsWith("SELECT kind, content, revision")) {
      const row = rows.get(values[0] as MemoryRow["kind"])
      return row ? [{ ...row }] : []
    }
    throw new Error(`Unexpected SQL in contract fixture: ${statement}`)
  }) as MemorySqlTag
  query.begin = async <T>(
    operation: (transaction: MemorySqlTag) => Promise<T>,
  ): Promise<T> => operation(query)
  query.unsafe = async () => []
  return query as unknown as Sql
}
