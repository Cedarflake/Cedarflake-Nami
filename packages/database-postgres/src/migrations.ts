import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  assertContinuousSchemaMigrationHistory,
  type PluginSchemaMigrationAction,
  type PluginSchemaMigrationApplyInput,
  type PluginSchemaMigrationApplyResult,
  type PluginSchemaMigrationPlan,
  type PluginSchemaMigrationProvider,
  type PluginSchemaMigrationStatus,
} from "@i0c/plugin-api"

import {
  createPostgresClient,
  type PostgresSql,
} from "./client"

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u

interface SchemaMigrationFile {
  checksum: string
  filename: string
  sql: string
}

interface AppliedSchemaMigrationRow {
  checksum: string
  filename: string
}

export interface PostgresSchemaMigrationProviderOptions {
  advisoryLockName: string
  connectionString: string
  emptySchemaMigrationsMessage: string
  migrationTable: string
  migrationsDirectory: string
}

export function createPostgresSchemaMigrationProvider(
  options: PostgresSchemaMigrationProviderOptions,
): PluginSchemaMigrationProvider {
  assertSafeSqlIdentifier(options.migrationTable)
  const advisoryLockName = requireValue(
    options.advisoryLockName,
    "PostgreSQL migration advisory lock name",
  )

  return {
    async schemaMigrationStatus(): Promise<PluginSchemaMigrationStatus> {
      return withSchemaMigrationClient(options.connectionString, async (sql) => {
        const files = await readPostgresSchemaMigrationFiles(options.migrationsDirectory)
        const applied = await readAppliedSchemaMigrations(sql, options.migrationTable)
        validateAppliedSchemaMigrations(files, applied)
        return {
          currentVersion: resolveCurrentVersion(files, applied),
          targetVersion: resolveTargetVersion(files, options.emptySchemaMigrationsMessage),
          pending: files.filter((file) => !applied.has(file.filename)).length,
        }
      })
    },
    async schemaMigrationPlan(): Promise<PluginSchemaMigrationPlan> {
      return withSchemaMigrationClient(options.connectionString, async (sql) => {
        const files = await readPostgresSchemaMigrationFiles(options.migrationsDirectory)
        const applied = await readAppliedSchemaMigrations(sql, options.migrationTable)
        validateAppliedSchemaMigrations(files, applied)
        return {
          currentVersion: resolveCurrentVersion(files, applied),
          targetVersion: resolveTargetVersion(files, options.emptySchemaMigrationsMessage),
          actions: files
            .filter((file) => !applied.has(file.filename))
            .map(toSchemaMigrationAction),
        }
      })
    },
    async applySchemaMigrations(
      input: PluginSchemaMigrationApplyInput = {},
    ): Promise<PluginSchemaMigrationApplyResult> {
      return withSchemaMigrationClient(options.connectionString, async (sql) => {
        const files = await readPostgresSchemaMigrationFiles(options.migrationsDirectory)
        return withSchemaMigrationLock(sql, advisoryLockName, async () => {
          await ensureSchemaMigrationTable(sql, options.migrationTable)
          const applied = await readAppliedSchemaMigrations(sql, options.migrationTable)
          validateAppliedSchemaMigrations(files, applied)
          const previousVersion = resolveCurrentVersion(files, applied)
          if (
            input.expectedCurrentVersion !== undefined
            && input.expectedCurrentVersion !== previousVersion
          ) {
            throw new Error(
              `Expected schema migration version ${input.expectedCurrentVersion ?? "none"}, found ${previousVersion ?? "none"}`,
            )
          }

          const appliedNow: string[] = []
          for (const file of files) {
            if (applied.has(file.filename)) {
              continue
            }
            await sql.begin(async (transaction) => {
              await transaction.unsafe(file.sql)
              await transaction.unsafe(
                `INSERT INTO ${options.migrationTable} (filename, checksum) VALUES ($1, $2)`,
                [file.filename, file.checksum],
              )
            })
            appliedNow.push(file.filename)
          }
          return {
            previousVersion,
            currentVersion: resolveTargetVersion(files, options.emptySchemaMigrationsMessage),
            applied: appliedNow,
          }
        })
      })
    },
  }
}

export async function readPostgresSchemaMigrationFiles(
  directory: string,
): Promise<readonly SchemaMigrationFile[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+.*\.sql$/u.test(filename))
    .sort((left, right) => left.localeCompare(right))
  const files: SchemaMigrationFile[] = []
  for (const filename of filenames) {
    const sql = await readFile(join(directory, filename), "utf8")
    files.push({
      checksum: createHash("sha256").update(sql).digest("hex"),
      filename,
      sql,
    })
  }
  return files
}

async function withSchemaMigrationClient<T>(
  connectionString: string,
  operation: (sql: PostgresSql) => Promise<T>,
): Promise<T> {
  const sql = createPostgresClient(connectionString, {
    maxConnections: 1,
    idleTimeoutSeconds: 5,
    connectTimeoutSeconds: 30,
  })
  try {
    return await operation(sql)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function withSchemaMigrationLock<T>(
  sql: PostgresSql,
  advisoryLockName: string,
  operation: () => Promise<T>,
): Promise<T> {
  await sql`SELECT pg_advisory_lock(hashtext(${advisoryLockName}))`
  try {
    return await operation()
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext(${advisoryLockName}))`
  }
}

async function readAppliedSchemaMigrations(
  sql: PostgresSql,
  migrationTable: string,
): Promise<Map<string, string>> {
  const [table] = await sql<{ exists: boolean }[]>`
    SELECT TO_REGCLASS(${migrationTable}) IS NOT NULL AS exists
  `
  if (!table?.exists) {
    return new Map()
  }
  const rows = await sql.unsafe<AppliedSchemaMigrationRow[]>(`
    SELECT filename, checksum
    FROM ${migrationTable}
    ORDER BY filename ASC
  `)
  return new Map(rows.map((row) => [row.filename, row.checksum]))
}

async function ensureSchemaMigrationTable(
  sql: PostgresSql,
  migrationTable: string,
): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

function validateAppliedSchemaMigrations(
  files: readonly SchemaMigrationFile[],
  applied: ReadonlyMap<string, string>,
): void {
  assertContinuousSchemaMigrationHistory(
    files.map((file) => file.filename),
    new Set(applied.keys()),
  )
  for (const file of files) {
    const checksum = applied.get(file.filename)
    if (checksum !== undefined && checksum !== file.checksum) {
      throw new Error(`Applied migration has changed: ${file.filename}`)
    }
  }
}

function resolveCurrentVersion(
  files: readonly SchemaMigrationFile[],
  applied: ReadonlyMap<string, string>,
): string | null {
  return [...files]
    .reverse()
    .find((file) => applied.has(file.filename))
    ?.filename ?? null
}

function resolveTargetVersion(
  files: readonly SchemaMigrationFile[],
  emptySchemaMigrationsMessage: string,
): string {
  const target = files.at(-1)?.filename
  if (!target) {
    throw new Error(emptySchemaMigrationsMessage)
  }
  return target
}

function toSchemaMigrationAction(file: SchemaMigrationFile): PluginSchemaMigrationAction {
  return {
    id: file.filename,
    description: `Apply ${file.filename}`,
    destructive: false,
    details: { checksum: file.checksum },
  }
}

function assertSafeSqlIdentifier(value: string): void {
  if (!SAFE_SQL_IDENTIFIER.test(value)) {
    throw new TypeError(`Unsafe PostgreSQL SQL identifier: ${value}`)
  }
}

function requireValue(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new TypeError(`${label} is missing`)
  }
  return normalized
}
