import {
  assertContinuousSchemaMigrationHistory,
  type PluginSchemaMigrationApplyInput,
  type PluginSchemaMigrationApplyResult,
  type PluginSchemaMigrationPlan,
  type PluginSchemaMigrationProvider,
  type PluginSchemaMigrationStatus,
} from "@nami/plugin-api"

import { d1All, d1Batch } from "./operations"
import type { D1Database } from "./types"

const D1_STATEMENT_BREAKPOINT = /^\s*--\s*d1-statement-breakpoint\s*$/mu
const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u

export interface D1SchemaMigration {
  id: string
  sql: string
}

export interface D1SchemaMigrationProviderOptions {
  migrationTable: string
  emptySchemaMigrationsMessage: string
  emptySchemaStatementsMessage: string
}

interface AppliedSchemaMigrationRow {
  checksum: string
  id: string
}

export function createD1SchemaMigrationProvider(
  database: D1Database,
  migrations: readonly D1SchemaMigration[],
  options: D1SchemaMigrationProviderOptions,
): PluginSchemaMigrationProvider {
  assertSafeSqlIdentifier(options.migrationTable)
  const ordered = [...migrations].sort((left, right) =>
    left.id.localeCompare(right.id),
  )

  return {
    async schemaMigrationStatus(): Promise<PluginSchemaMigrationStatus> {
      const applied = await readAppliedSchemaMigrations(database, options.migrationTable)
      await validateAppliedSchemaMigrations(ordered, applied)
      const pending = ordered.filter((migration) => !applied.has(migration.id))
      return {
        currentVersion: resolveCurrentVersion(ordered, applied),
        targetVersion: resolveTargetVersion(ordered, options.emptySchemaMigrationsMessage),
        pending: pending.length,
      }
    },
    async schemaMigrationPlan(): Promise<PluginSchemaMigrationPlan> {
      const applied = await readAppliedSchemaMigrations(database, options.migrationTable)
      await validateAppliedSchemaMigrations(ordered, applied)
      return {
        currentVersion: resolveCurrentVersion(ordered, applied),
        targetVersion: resolveTargetVersion(ordered, options.emptySchemaMigrationsMessage),
        actions: ordered
          .filter((migration) => !applied.has(migration.id))
          .map((migration) => ({
            id: migration.id,
            description: `Apply ${migration.id}`,
            destructive: false,
          })),
      }
    },
    async applySchemaMigrations(
      input: PluginSchemaMigrationApplyInput = {},
    ): Promise<PluginSchemaMigrationApplyResult> {
      await ensureSchemaMigrationTable(database, options.migrationTable)
      const applied = await readAppliedSchemaMigrations(database, options.migrationTable)
      await validateAppliedSchemaMigrations(ordered, applied)
      const previousVersion = resolveCurrentVersion(ordered, applied)
      if (
        input.expectedCurrentVersion !== undefined
        && input.expectedCurrentVersion !== previousVersion
      ) {
        throw new Error(
          `Expected schema migration version ${input.expectedCurrentVersion ?? "none"}, found ${previousVersion ?? "none"}`,
        )
      }

      const appliedNow: string[] = []
      for (const migration of ordered) {
        if (applied.has(migration.id)) {
          continue
        }

        const checksum = await createD1SchemaMigrationChecksum(migration.sql)
        const statements = splitD1SchemaMigrationStatements(
          migration.sql,
          options.emptySchemaStatementsMessage,
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
            || !await refreshAppliedSchemaMigrationsAfterRace(
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
        currentVersion: resolveTargetVersion(ordered, options.emptySchemaMigrationsMessage),
        applied: appliedNow,
      }
    },
  }
}

export function splitD1SchemaMigrationStatements(
  sql: string,
  emptySchemaMigrationsMessage = "D1 migration contains no SQL statements",
): readonly string[] {
  const statements = sql
    .split(D1_STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter(Boolean)
  if (statements.length === 0) {
    throw new Error(emptySchemaMigrationsMessage)
  }
  return statements
}

export async function createD1SchemaMigrationChecksum(sql: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sql),
  )
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

async function refreshAppliedSchemaMigrationsAfterRace(
  database: D1Database,
  migrations: readonly D1SchemaMigration[],
  applied: Map<string, string>,
  migrationId: string,
  checksum: string,
  migrationTable: string,
): Promise<boolean> {
  const refreshed = await readAppliedSchemaMigrations(database, migrationTable)
  await validateAppliedSchemaMigrations(migrations, refreshed)
  if (refreshed.get(migrationId) !== checksum) {
    return false
  }

  applied.clear()
  for (const [id, appliedChecksum] of refreshed) {
    applied.set(id, appliedChecksum)
  }
  return true
}

async function readAppliedSchemaMigrations(
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

  const rows = await d1All<AppliedSchemaMigrationRow>(database.prepare(`
    SELECT id, checksum
    FROM ${migrationTable}
    ORDER BY id ASC
  `))
  return new Map(rows.map((row) => [row.id, row.checksum]))
}

async function ensureSchemaMigrationTable(
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

async function validateAppliedSchemaMigrations(
  migrations: readonly D1SchemaMigration[],
  applied: ReadonlyMap<string, string>,
): Promise<void> {
  assertContinuousSchemaMigrationHistory(
    migrations.map((migration) => migration.id),
    new Set(applied.keys()),
  )
  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.id)
    if (!appliedChecksum) {
      continue
    }
    const expectedChecksum = await createD1SchemaMigrationChecksum(migration.sql)
    if (appliedChecksum !== expectedChecksum) {
      throw new Error(`D1 migration checksum mismatch: ${migration.id}`)
    }
  }
}

function resolveCurrentVersion(
  migrations: readonly D1SchemaMigration[],
  applied: ReadonlyMap<string, string>,
): string | null {
  return [...migrations]
    .reverse()
    .find((migration) => applied.has(migration.id))
    ?.id ?? null
}

function resolveTargetVersion(
  migrations: readonly D1SchemaMigration[],
  emptySchemaMigrationsMessage: string,
): string {
  const target = migrations.at(-1)?.id
  if (!target) {
    throw new Error(emptySchemaMigrationsMessage)
  }
  return target
}

function assertSafeSqlIdentifier(value: string): void {
  if (!SAFE_SQL_IDENTIFIER.test(value)) {
    throw new TypeError(`Unsafe D1 SQL identifier: ${value}`)
  }
}
