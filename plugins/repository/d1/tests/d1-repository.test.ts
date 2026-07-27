import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  assertManagedDataRepositoryBehaviorContract,
  assertMigrationState,
  assertPluginManifest,
} from "@i0c/plugin-testkit"

import { d1All } from "../src/d1"
import { d1DataRepositoryManifest } from "../src/manifest"
import {
  createD1DataRepositoryMigrationProvider,
  type D1DataRepositoryMigration,
} from "../src/migrations"
import { createD1DataRepository } from "../src/repository"
import { SQLiteD1Database } from "./sqlite-d1"

test("declares a valid D1 data repository manifest", () => {
  assertPluginManifest(d1DataRepositoryManifest)
})

test("owns and applies independent D1 data repository migrations", async () => {
  const database = new SQLiteD1Database()
  try {
    const provider = createD1DataRepositoryMigrationProvider(
      database,
      await loadMigrations(),
    )
    await assertMigrationState(provider, "002_data_document_history.sql")
    const result = await provider.applyMigrations({
      expectedCurrentVersion: null,
    })
    assert.deepEqual(result.applied, [
      "001_data_documents.sql",
      "002_data_document_history.sql",
    ])
    await assertMigrationState(provider, "002_data_document_history.sql")
  } finally {
    database.close()
  }
})

test("satisfies the managed data repository behavior contract", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1DataRepositoryMigrationProvider(
      database,
      await loadMigrations(),
    ).applyMigrations()
    await assertManagedDataRepositoryBehaviorContract(
      createD1DataRepository(database),
    )
  } finally {
    database.close()
  }
})

test("rolls back a document write when its history insert fails", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1DataRepositoryMigrationProvider(
      database,
      await loadMigrations(),
    ).applyMigrations()
    const repository = createD1DataRepository(database)
    await repository.management.initialize({
      actorGitHubUserId: "123",
      configContent: "{\"schemaVersion\":1}",
      redirectsContent: "{\"Slots\":{}}",
    })
    const before = await repository.readSnapshot({})

    database.failNextBatchAt(1)
    await assert.rejects(
      repository.write("config", {
        actorGitHubUserId: "123",
        content: "{\"schemaVersion\":1,\"mustNotPersist\":true}",
        expectedRevision: "1",
      }),
      /Injected D1 batch failure/,
    )

    assert.deepEqual(await repository.readSnapshot({}), before)
    assert.deepEqual(
      (await repository.management.listRevisions({
        kind: "config",
        limit: 10,
      })).map((revision) => revision.revision),
      ["1"],
    )
  } finally {
    database.close()
  }
})

test("rolls back both imported documents when history insertion fails", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1DataRepositoryMigrationProvider(
      database,
      await loadMigrations(),
    ).applyMigrations()
    const repository = createD1DataRepository(database)
    await repository.management.initialize({
      actorGitHubUserId: "123",
      configContent: "{\"schemaVersion\":1}",
      redirectsContent: "{\"Slots\":{}}",
    })
    const before = await repository.readSnapshot({})

    database.failNextBatchAt(1)
    await assert.rejects(
      repository.management.importSnapshot({
        actorGitHubUserId: "123",
        configContent: "{\"schemaVersion\":1,\"mustNotPersist\":true}",
        expectedConfigRevision: "1",
        expectedRedirectsRevision: "1",
        redirectsContent: "{\"Slots\":{\"/\":\"https://example.com\"}}",
      }),
      /Injected D1 batch failure/,
    )

    assert.deepEqual(await repository.readSnapshot({}), before)
  } finally {
    database.close()
  }
})

test("rolls back a failed D1 data repository migration and version record", async () => {
  const database = new SQLiteD1Database()
  try {
    const provider = createD1DataRepositoryMigrationProvider(database, [{
      id: "001_failure.sql",
      sql: `
        CREATE TABLE partial_data_repository_migration (id TEXT PRIMARY KEY);
        -- d1-statement-breakpoint
        INSERT INTO missing_table (id) VALUES ('failure');
      `,
    }])

    await assert.rejects(
      async () => provider.applyMigrations(),
      /missing_table/,
    )

    assert.deepEqual(
      await d1All<{ name: string }>(database.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'partial_data_repository_migration'
      `)),
      [],
    )
    assert.equal(
      (await d1All<{ count: number }>(database.prepare(`
        SELECT COUNT(*) AS count
        FROM i0c_data_repository_migration
      `)))[0]?.count,
      0,
    )
  } finally {
    database.close()
  }
})

test("rejects drift, gaps, and future D1 data repository migrations", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations = await loadMigrations()
    const provider = createD1DataRepositoryMigrationProvider(
      database,
      migrations,
    )
    await provider.applyMigrations()

    const drifted = createD1DataRepositoryMigrationProvider(database, [
      migrations[0],
      {
        ...migrations[1],
        sql: `${migrations[1]?.sql ?? ""}\n-- drift`,
      },
    ].filter((migration): migration is D1DataRepositoryMigration =>
      migration !== undefined
    ))
    await assert.rejects(
      async () => drifted.migrationStatus(),
      /migration checksum mismatch/,
    )

    database.database.prepare(`
      UPDATE i0c_data_repository_migration
      SET checksum = ?
      WHERE id = '002_data_document_history.sql'
    `).run(await checksum(migrations[1]?.sql ?? ""))
    database.database.prepare(`
      DELETE FROM i0c_data_repository_migration
      WHERE id = '001_data_documents.sql'
    `).run()
    await assert.rejects(
      async () => provider.migrationPlan(),
      /not a continuous prefix/,
    )

    database.database.prepare(`
      DELETE FROM i0c_data_repository_migration
    `).run()
    database.database.prepare(`
      INSERT INTO i0c_data_repository_migration (id, checksum)
      VALUES ('999_future.sql', 'future')
    `).run()
    await assert.rejects(
      async () => provider.migrationStatus(),
      /unknown applied migration/,
    )
  } finally {
    database.close()
  }
})

async function loadMigrations(): Promise<D1DataRepositoryMigration[]> {
  return Promise.all([
    "001_data_documents.sql",
    "002_data_document_history.sql",
  ].map(async (id) => ({
    id,
    sql: await readFile(
      fileURLToPath(new URL(`../migrations/${id}`, import.meta.url)),
      "utf8",
    ),
  })))
}

async function checksum(sql: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sql),
  )
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("")
}
