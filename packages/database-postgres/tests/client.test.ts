import assert from "node:assert/strict"
import test from "node:test"

import { createPostgresClient } from "../src/client"
import { createPostgresSchemaMigrationProvider } from "../src/migrations"

test("rejects invalid PostgreSQL client limits before connecting", () => {
  assert.throws(
    () => createPostgresClient("postgres://example", {
      maxConnections: 0,
      idleTimeoutSeconds: 5,
      connectTimeoutSeconds: 30,
    }),
    /maxConnections must be a positive integer/u,
  )
})

test("rejects unsafe migration table identifiers before connecting", () => {
  assert.throws(
    () => createPostgresSchemaMigrationProvider({
      advisoryLockName: "i0c.test.migrations",
      connectionString: "postgres://example",
      emptySchemaMigrationsMessage: "No migrations",
      migrationTable: "migration; DROP TABLE users",
      migrationsDirectory: ".",
    }),
    /Unsafe PostgreSQL SQL identifier/u,
  )
})
