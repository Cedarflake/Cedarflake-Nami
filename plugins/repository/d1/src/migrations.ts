import {
  assertContinuousMigrationHistory,
  type PluginMigrationApplyInput,
  type PluginMigrationApplyResult,
  type PluginMigrationPlan,
  type PluginMigrationProvider,
  type PluginMigrationStatus,
} from "@i0c/plugin-api"

import type { D1Database } from "./d1"
import { d1All, d1Batch } from "./d1"

const D1_STATEMENT_BREAKPOINT = /^\s*--\s*d1-statement-breakpoint\s*$/mu

export interface D1DataRepositoryMigration {
  id: string
  sql: string
}

interface AppliedMigrationRow {
  checksum: string
  id: string
}

export function createD1DataRepositoryMigrationProvider(
  database: D1Database,
  migrations: readonly D1DataRepositoryMigration[],
): PluginMigrationProvider {
  const ordered = [...migrations].sort((left, right) =>
    left.id.localeCompare(right.id),
  )

  return {
    async migrationStatus(): Promise<PluginMigrationStatus> {
      const applied = await readAppliedMigrations(database)
      validateAppliedHistory(ordered, applied)
      await verifyAppliedMigrationChecksums(ordered, applied)
      const pending = ordered.filter((migration) => !applied.has(migration.id))
      return {
        currentVersion: resolveCurrentVersion(ordered, applied),
        targetVersion: resolveTargetVersion(ordered),
        pending: pending.length,
      }
    },
    async migrationPlan(): Promise<PluginMigrationPlan> {
      const applied = await readAppliedMigrations(database)
      validateAppliedHistory(ordered, applied)
      await verifyAppliedMigrationChecksums(ordered, applied)
      return {
        currentVersion: resolveCurrentVersion(ordered, applied),
        targetVersion: resolveTargetVersion(ordered),
        actions: ordered
          .filter((migration) => !applied.has(migration.id))
          .map((migration) => ({
            id: migration.id,
            description: `Apply ${migration.id}`,
            destructive: false,
          })),
      }
    },
    async applyMigrations(
      input: PluginMigrationApplyInput = {},
    ): Promise<PluginMigrationApplyResult> {
      await ensureMigrationTable(database)
      const applied = await readAppliedMigrations(database)
      validateAppliedHistory(ordered, applied)
      await verifyAppliedMigrationChecksums(ordered, applied)
      const previousVersion = resolveCurrentVersion(ordered, applied)
      if (
        input.expectedCurrentVersion !== undefined
        && input.expectedCurrentVersion !== previousVersion
      ) {
        throw new Error(
          `Expected migration version ${input.expectedCurrentVersion ?? "none"}, found ${previousVersion ?? "none"}`,
        )
      }

      const appliedNow: string[] = []
      for (const migration of ordered) {
        if (applied.has(migration.id)) {
          continue
        }

        const checksum = await createMigrationChecksum(migration.sql)
        const statements = splitD1DataRepositoryMigrationStatements(
          migration.sql,
        ).map((statement) => database.prepare(statement))
        try {
          await d1Batch(database, [
            ...statements,
            database.prepare(`
              INSERT INTO i0c_data_repository_migration (id, checksum)
              VALUES (?, ?)
            `).bind(migration.id, checksum),
          ])
        } catch (error) {
          if (
            input.expectedCurrentVersion !== undefined
            || !await refreshAppliedMigrationsAfterRace(
              database,
              ordered,
              applied,
              migration.id,
              checksum,
            )
          ) {
            throw error
          }
          continue
        }
        applied.set(migration.id, checksum)
        appliedNow.push(migration.id)
      }

      return {
        previousVersion,
        currentVersion: resolveTargetVersion(ordered),
        applied: appliedNow,
      }
    },
  }
}

export function splitD1DataRepositoryMigrationStatements(
  sql: string,
): readonly string[] {
  const statements = sql
    .split(D1_STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter(Boolean)
  if (statements.length === 0) {
    throw new Error("D1 data repository migration contains no SQL statements")
  }
  return statements
}

async function refreshAppliedMigrationsAfterRace(
  database: D1Database,
  migrations: readonly D1DataRepositoryMigration[],
  applied: Map<string, string>,
  migrationId: string,
  checksum: string,
): Promise<boolean> {
  const refreshed = await readAppliedMigrations(database)
  validateAppliedHistory(migrations, refreshed)
  await verifyAppliedMigrationChecksums(migrations, refreshed)
  if (refreshed.get(migrationId) !== checksum) {
    return false
  }

  applied.clear()
  for (const [id, appliedChecksum] of refreshed) {
    applied.set(id, appliedChecksum)
  }
  return true
}

async function readAppliedMigrations(
  database: D1Database,
): Promise<Map<string, string>> {
  const tables = await d1All<{ name: string }>(database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'i0c_data_repository_migration'
  `))
  if (tables.length === 0) {
    return new Map()
  }

  const rows = await d1All<AppliedMigrationRow>(database.prepare(`
    SELECT id, checksum
    FROM i0c_data_repository_migration
    ORDER BY id ASC
  `))
  return new Map(rows.map((row) => [row.id, row.checksum]))
}

async function ensureMigrationTable(database: D1Database): Promise<void> {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS i0c_data_repository_migration (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
}

async function verifyAppliedMigrationChecksums(
  migrations: readonly D1DataRepositoryMigration[],
  applied: ReadonlyMap<string, string>,
): Promise<void> {
  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.id)
    if (!appliedChecksum) {
      continue
    }
    const expectedChecksum = await createMigrationChecksum(migration.sql)
    if (appliedChecksum !== expectedChecksum) {
      throw new Error(`D1 data repository migration checksum mismatch: ${migration.id}`)
    }
  }
}

function validateAppliedHistory(
  migrations: readonly D1DataRepositoryMigration[],
  applied: ReadonlyMap<string, string>,
): void {
  assertContinuousMigrationHistory(
    migrations.map((migration) => migration.id),
    new Set(applied.keys()),
  )
}

function resolveCurrentVersion(
  migrations: readonly D1DataRepositoryMigration[],
  applied: ReadonlyMap<string, string>,
): string | null {
  return [...migrations]
    .reverse()
    .find((migration) => applied.has(migration.id))
    ?.id ?? null
}

function resolveTargetVersion(
  migrations: readonly D1DataRepositoryMigration[],
): string {
  const target = migrations.at(-1)?.id
  if (!target) {
    throw new Error("No D1 data repository migrations were provided")
  }
  return target
}

async function createMigrationChecksum(sql: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sql),
  )
  return toHex(digest)
}

function toHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("")
}
