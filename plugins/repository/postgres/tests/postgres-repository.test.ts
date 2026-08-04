import assert from "node:assert/strict"
import test from "node:test"

import { DataRepositoryConflictError } from "@i0c/config"
import {
  createPostgresClient,
  type PostgresSql,
} from "@i0c/database-postgres"
import {
  assertManagedDataRepositoryBehaviorContract,
  assertPluginManifest,
  assertVersionedDataRepositoryContract,
} from "@i0c/plugin-testkit"

import {
  resolvePostgresDataRepositoryConnectionOptions,
} from "../src/config"
import { postgresDataRepositoryManifest } from "../src/manifest"
import {
  createPostgresDataRepositorySchemaMigrationProvider,
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

test("initializes, imports, and restores immutable document revisions", async () => {
  const sql = createMemorySql()
  const repository = createPostgresDataRepository(
    { connectionString: "postgres://management-test" },
    { sql },
  )

  assert.deepEqual(
    await repository.management.inspectSetupState(),
    { state: "empty", existingKinds: [] },
  )
  const initialized = await repository.management.initialize({
    actorGitHubUserId: "123",
    configContent: "{\"schemaVersion\":1}",
    redirectsContent: "{\"Slots\":{}}",
  })
  assert.equal(initialized.config.revision, "1")
  assert.equal(initialized.redirects.revision, "1")
  assert.deepEqual(
    await repository.management.inspectSetupState(),
    { state: "initialized" },
  )

  assert.deepEqual(
    await repository.write("config", {
      actorGitHubUserId: "123",
      content: "{\"schemaVersion\":1,\"updated\":true}",
      expectedRevision: "1",
    }),
    { revision: "2" },
  )
  const firstConfigRevision = await repository.management.readRevision({
    kind: "config",
    revision: "1",
  })
  assert.equal(firstConfigRevision.operation, "initialize")
  assert.equal(firstConfigRevision.actorGitHubUserId, "123")

  assert.deepEqual(
    await repository.management.restore({
      actorGitHubUserId: "123",
      expectedRevision: "2",
      kind: "config",
      revision: "1",
    }),
    { revision: "3" },
  )
  assert.equal(
    (await repository.read("config", {})).content,
    "{\"schemaVersion\":1}",
  )

  const imported = await repository.management.importSnapshot({
    actorGitHubUserId: "123",
    configContent: "{\"schemaVersion\":1,\"imported\":true}",
    expectedConfigRevision: "3",
    expectedRedirectsRevision: "1",
    redirectsContent: "{\"Slots\":{\"/\":\"https://example.com\"}}",
  })
  assert.equal(imported.config.revision, "4")
  assert.equal(imported.redirects.revision, "2")
  assert.deepEqual(
    (await repository.management.listRevisions({
      kind: "config",
      limit: 10,
    })).map((revision) => [revision.revision, revision.operation]),
    [
      ["4", "import"],
      ["3", "rollback"],
      ["2", "save"],
      ["1", "initialize"],
    ],
  )
})

const integrationConnectionString =
  process.env.TEST_POSTGRES_URL?.trim()
  ?? process.env.TEST_DATABASE_URL?.trim()

test(
  "satisfies the versioned repository contract with PostgreSQL",
  {
    skip: integrationConnectionString
      ? false
      : "TEST_POSTGRES_URL and TEST_DATABASE_URL are not set",
  },
  async () => {
    const connectionString = integrationConnectionString
    assert.ok(connectionString)
    const migrations = createPostgresDataRepositorySchemaMigrationProvider({
      connectionString,
    })
    await migrations.applySchemaMigrations()
    const sql = createPostgresClient(connectionString, {
      maxConnections: 1,
      idleTimeoutSeconds: 1,
      connectTimeoutSeconds: 30,
    })

    try {
      await sql`DELETE FROM i0c_data_document_revision`
      await sql`DELETE FROM i0c_data_document`
      const repository = createPostgresDataRepository(
        { connectionString },
        { sql },
      )
      await assertManagedDataRepositoryBehaviorContract(repository)
    } finally {
      await sql`DELETE FROM i0c_data_document_revision`
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

interface MemoryRevisionRow extends MemoryRow {
  actor_github_user_id: string | null
  created_at: Date
  operation: "import" | "initialize" | "migration" | "rollback" | "save"
}

interface MemorySqlTag {
  (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<readonly unknown[]>
  begin<T>(operation: (transaction: MemorySqlTag) => Promise<T>): Promise<T>
  unsafe(query: string): Promise<readonly unknown[]>
}

function createMemorySql(): PostgresSql {
  const rows = new Map<MemoryRow["kind"], MemoryRow>()
  const revisions = new Map<
    MemoryRow["kind"],
    Map<number, MemoryRevisionRow>
  >()
  const query = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const statement = strings.join("?").replace(/\s+/g, " ").trim()
    if (statement.startsWith("SELECT TO_REGCLASS('i0c_data_document')")) {
      return [{
        document_table_exists: true,
        revision_table_exists: true,
      }]
    }
    if (statement.startsWith("INSERT INTO i0c_data_document_revision")) {
      const kind = values[0] as MemoryRow["kind"]
      const revision = Number(values[1])
      const current = revisions.get(kind) ?? new Map()
      current.set(revision, {
        kind,
        revision,
        content: String(values[2]),
        checksum: String(values[3]),
        operation: values[4] as MemoryRevisionRow["operation"],
        actor_github_user_id: values[5] === null ? null : String(values[5]),
        created_at: new Date(values[6] as Date | string),
        updated_at: new Date(values[6] as Date | string),
      })
      revisions.set(kind, current)
      return []
    }
    if (
      statement.startsWith("INSERT INTO i0c_data_document")
      && statement.includes("'config'")
      && statement.includes("'redirects'")
    ) {
      const now = new Date()
      const inserted: MemoryRow[] = [
        {
          kind: "config",
          content: String(values[0]),
          revision: 1,
          checksum: String(values[1]),
          updated_at: now,
        },
        {
          kind: "redirects",
          content: String(values[2]),
          revision: 1,
          checksum: String(values[3]),
          updated_at: now,
        },
      ]
      for (const row of inserted) {
        rows.set(row.kind, row)
      }
      return inserted.map((row) => ({ ...row }))
    }
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
    if (
      statement.startsWith("SELECT kind FROM i0c_data_document")
      && statement.includes("FROM i0c_data_document")
    ) {
      return [...rows.values()]
        .sort((left, right) => left.kind.localeCompare(right.kind))
        .map((row) => ({ kind: row.kind }))
    }
    if (
      statement.includes("FROM i0c_data_document_revision")
      && statement.includes("ORDER BY revision DESC")
    ) {
      const kind = values[0] as MemoryRow["kind"]
      const beforeRevision = values.length === 3 ? Number(values[1]) : undefined
      const limit = Number(values.at(-1))
      return [...(revisions.get(kind)?.values() ?? [])]
        .filter((row) =>
          beforeRevision === undefined || row.revision < beforeRevision
        )
        .sort((left, right) => right.revision - left.revision)
        .slice(0, limit)
        .map((row) => ({ ...row }))
    }
    if (
      statement.includes("FROM i0c_data_document_revision")
      && statement.includes("AND revision =")
    ) {
      const row = revisions
        .get(values[0] as MemoryRow["kind"])
        ?.get(Number(values[1]))
      return row ? [{ ...row }] : []
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
  }) as unknown as MemorySqlTag
  query.begin = async <T>(
    operation: (transaction: MemorySqlTag) => Promise<T>,
  ): Promise<T> => operation(query)
  query.unsafe = async () => []
  return query as unknown as PostgresSql
}
