import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  assertContinuousMigrationHistory,
  type PluginMigrationAction,
  type PluginMigrationApplyInput,
  type PluginMigrationApplyResult,
  type PluginMigrationPlan,
  type PluginMigrationProvider,
  type PluginMigrationStatus,
} from "@i0c/plugin-api"

import {
  createPostgresClient,
  type PostgresSql,
} from "./client"

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u

interface MigrationFile {
  checksum: string
  filename: string
  sql: string
}

interface AppliedMigrationRow {
  checksum: string
  filename: string
}

export interface PostgresMigrationProviderOptions {
  advisoryLockName: string
  connectionString: string
  emptyMigrationsMessage: string
  migrationTable: string
  migrationsDirectory: string
}

export function createPostgresMigrationProvider(
  options: PostgresMigrationProviderOptions,
): PluginMigrationProvider {
  assertSafeSqlIdentifier(options.migrationTable)
  const advisoryLockName = requireValue(
    options.advisoryLockName,
    "PostgreSQL migration advisory lock name",
  )

  return {
    async migrationStatus(): Promise<PluginMigrationStatus> {
      return withMigrationClient(options.connectionString, async (sql) => {
        const files = await readPostgresMigrationFiles(options.migrationsDirectory)
        const applied = await readAppliedMigrations(sql, options.migrationTable)
        validateAppliedMigrations(files, applied)
        return {
          currentVersion: resolveCurrentVersion(files, applied),
          targetVersion: resolveTargetVersion(files, options.emptyMigrationsMessage),
          pending: files.filter((file) => !applied.has(file.filename)).length,
        }
      })
    },
    async migrationPlan(): Promise<PluginMigrationPlan> {
      return withMigrationClient(options.connectionString, async (sql) => {
        const files = await readPostgresMigrationFiles(options.migrationsDirectory)
        const applied = await readAppliedMigrations(sql, options.migrationTable)
        validateAppliedMigrations(files, applied)
        return {
          currentVersion: resolveCurrentVersion(files, applied),
          targetVersion: resolveTargetVersion(files, options.emptyMigrationsMessage),
          actions: files
            .filter((file) => !applied.has(file.filename))
            .map(toMigrationAction),
        }
      })
    },
    async applyMigrations(
      input: PluginMigrationApplyInput = {},
    ): Promise<PluginMigrationApplyResult> {
      return withMigrationClient(options.connectionString, async (sql) => {
        const files = await readPostgresMigrationFiles(options.migrationsDirectory)
        return withMigrationLock(sql, advisoryLockName, async () => {
          await ensureMigrationTable(sql, options.migrationTable)
          const applied = await readAppliedMigrations(sql, options.migrationTable)
          validateAppliedMigrations(files, applied)
          const previousVersion = resolveCurrentVersion(files, applied)
          if (
            input.expectedCurrentVersion !== undefined
            && input.expectedCurrentVersion !== previousVersion
          ) {
            throw new Error(
              `Expected migration version ${input.expectedCurrentVersion ?? "none"}, found ${previousVersion ?? "none"}`,
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
            currentVersion: resolveTargetVersion(files, options.emptyMigrationsMessage),
            applied: appliedNow,
          }
        })
      })
    },
  }
}

export async function readPostgresMigrationFiles(
  directory: string,
): Promise<readonly MigrationFile[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+.*\.sql$/u.test(filename))
    .sort((left, right) => left.localeCompare(right))
  const files: MigrationFile[] = []
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

async function withMigrationClient<T>(
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

async function withMigrationLock<T>(
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

async function readAppliedMigrations(
  sql: PostgresSql,
  migrationTable: string,
): Promise<Map<string, string>> {
  const [table] = await sql<{ exists: boolean }[]>`
    SELECT TO_REGCLASS(${migrationTable}) IS NOT NULL AS exists
  `
  if (!table?.exists) {
    return new Map()
  }
  const rows = await sql.unsafe<AppliedMigrationRow[]>(`
    SELECT filename, checksum
    FROM ${migrationTable}
    ORDER BY filename ASC
  `)
  return new Map(rows.map((row) => [row.filename, row.checksum]))
}

async function ensureMigrationTable(
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

function validateAppliedMigrations(
  files: readonly MigrationFile[],
  applied: ReadonlyMap<string, string>,
): void {
  assertContinuousMigrationHistory(
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
  files: readonly MigrationFile[],
  applied: ReadonlyMap<string, string>,
): string | null {
  return [...files]
    .reverse()
    .find((file) => applied.has(file.filename))
    ?.filename ?? null
}

function resolveTargetVersion(
  files: readonly MigrationFile[],
  emptyMigrationsMessage: string,
): string {
  const target = files.at(-1)?.filename
  if (!target) {
    throw new Error(emptyMigrationsMessage)
  }
  return target
}

function toMigrationAction(file: MigrationFile): PluginMigrationAction {
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
