import {
  assertContinuousMigrationHistory,
  type PluginMigrationApplyInput,
  type PluginMigrationApplyResult,
  type PluginMigrationPlan,
  type PluginMigrationProvider,
  type PluginMigrationStatus,
} from "@i0c/plugin-api"

import { d1All, d1Batch } from "./operations"
import type { D1Database } from "./types"

const D1_STATEMENT_BREAKPOINT = /^\s*--\s*d1-statement-breakpoint\s*$/mu
const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u

export interface D1Migration {
  id: string
  sql: string
}

export interface D1MigrationProviderOptions {
  migrationTable: string
  emptyMigrationsMessage: string
  emptyStatementsMessage: string
}

interface AppliedMigrationRow {
  checksum: string
  id: string
}

export function createD1MigrationProvider(
  database: D1Database,
  migrations: readonly D1Migration[],
  options: D1MigrationProviderOptions,
): PluginMigrationProvider {
  assertSafeSqlIdentifier(options.migrationTable)
  const ordered = [...migrations].sort((left, right) =>
    left.id.localeCompare(right.id),
  )

  return {
    async migrationStatus(): Promise<PluginMigrationStatus> {
      const applied = await readAppliedMigrations(database, options.migrationTable)
      await validateAppliedMigrations(ordered, applied)
      const pending = ordered.filter((migration) => !applied.has(migration.id))
      return {
        currentVersion: resolveCurrentVersion(ordered, applied),
        targetVersion: resolveTargetVersion(ordered, options.emptyMigrationsMessage),
        pending: pending.length,
      }
    },
    async migrationPlan(): Promise<PluginMigrationPlan> {
      const applied = await readAppliedMigrations(database, options.migrationTable)
      await validateAppliedMigrations(ordered, applied)
      return {
        currentVersion: resolveCurrentVersion(ordered, applied),
        targetVersion: resolveTargetVersion(ordered, options.emptyMigrationsMessage),
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
      await ensureMigrationTable(database, options.migrationTable)
      const applied = await readAppliedMigrations(database, options.migrationTable)
      await validateAppliedMigrations(ordered, applied)
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

        const checksum = await createD1MigrationChecksum(migration.sql)
        const statements = splitD1MigrationStatements(
          migration.sql,
          options.emptyStatementsMessage,
        ).map((statement) => database.prepare(statement))
        try {
          await d1Batch(database, [
            ...statements,
            database.prepare(`
              INSERT INTO ${options.migrationTable} (id, checksum)
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
              options.migrationTable,
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
        currentVersion: resolveTargetVersion(ordered, options.emptyMigrationsMessage),
        applied: appliedNow,
      }
    },
  }
}

export function splitD1MigrationStatements(
  sql: string,
  emptyMigrationsMessage = "D1 migration contains no SQL statements",
): readonly string[] {
  const statements = sql
    .split(D1_STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter(Boolean)
  if (statements.length === 0) {
    throw new Error(emptyMigrationsMessage)
  }
  return statements
}

export async function createD1MigrationChecksum(sql: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sql),
  )
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

async function refreshAppliedMigrationsAfterRace(
  database: D1Database,
  migrations: readonly D1Migration[],
  applied: Map<string, string>,
  migrationId: string,
  checksum: string,
  migrationTable: string,
): Promise<boolean> {
  const refreshed = await readAppliedMigrations(database, migrationTable)
  await validateAppliedMigrations(migrations, refreshed)
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
  migrationTable: string,
): Promise<Map<string, string>> {
  const tables = await d1All<{ name: string }>(database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).bind(migrationTable))
  if (tables.length === 0) {
    return new Map()
  }

  const rows = await d1All<AppliedMigrationRow>(database.prepare(`
    SELECT id, checksum
    FROM ${migrationTable}
    ORDER BY id ASC
  `))
  return new Map(rows.map((row) => [row.id, row.checksum]))
}

async function ensureMigrationTable(
  database: D1Database,
  migrationTable: string,
): Promise<void> {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
}

async function validateAppliedMigrations(
  migrations: readonly D1Migration[],
  applied: ReadonlyMap<string, string>,
): Promise<void> {
  assertContinuousMigrationHistory(
    migrations.map((migration) => migration.id),
    new Set(applied.keys()),
  )
  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.id)
    if (!appliedChecksum) {
      continue
    }
    const expectedChecksum = await createD1MigrationChecksum(migration.sql)
    if (appliedChecksum !== expectedChecksum) {
      throw new Error(`D1 migration checksum mismatch: ${migration.id}`)
    }
  }
}

function resolveCurrentVersion(
  migrations: readonly D1Migration[],
  applied: ReadonlyMap<string, string>,
): string | null {
  return [...migrations]
    .reverse()
    .find((migration) => applied.has(migration.id))
    ?.id ?? null
}

function resolveTargetVersion(
  migrations: readonly D1Migration[],
  emptyMigrationsMessage: string,
): string {
  const target = migrations.at(-1)?.id
  if (!target) {
    throw new Error(emptyMigrationsMessage)
  }
  return target
}

function assertSafeSqlIdentifier(value: string): void {
  if (!SAFE_SQL_IDENTIFIER.test(value)) {
    throw new TypeError(`Unsafe D1 SQL identifier: ${value}`)
  }
}
