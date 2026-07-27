import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import postgres, { type Sql } from "postgres"

import {
  assertContinuousMigrationHistory,
  type PluginMigrationAction,
  type PluginMigrationApplyInput,
  type PluginMigrationApplyResult,
  type PluginMigrationPlan,
  type PluginMigrationProvider,
  type PluginMigrationStatus,
} from "@i0c/plugin-api"

interface MigrationFile {
  checksum: string
  filename: string
  sql: string
}

interface AppliedMigrationRow {
  checksum: string
  filename: string
}

export interface PostgresDataRepositoryMigrationProviderOptions {
  connectionString: string
  migrationsDirectory?: string
}

export function createPostgresDataRepositoryMigrationProvider(
  options: PostgresDataRepositoryMigrationProviderOptions,
): PluginMigrationProvider {
  const migrationsDirectory = options.migrationsDirectory
    ?? fileURLToPath(new URL("../migrations/", import.meta.url))

  return {
    async migrationStatus(): Promise<PluginMigrationStatus> {
      return withMigrationClient(options.connectionString, async (sql) => {
        const files = await readMigrationFiles(migrationsDirectory)
        const applied = await readAppliedMigrations(sql)
        validateAppliedHistory(files, applied)
        validateAppliedChecksums(files, applied)
        return {
          currentVersion: resolveCurrentVersion(files, applied),
          targetVersion: resolveTargetVersion(files),
          pending: files.filter((file) => !applied.has(file.filename)).length,
        }
      })
    },
    async migrationPlan(): Promise<PluginMigrationPlan> {
      return withMigrationClient(options.connectionString, async (sql) => {
        const files = await readMigrationFiles(migrationsDirectory)
        const applied = await readAppliedMigrations(sql)
        validateAppliedHistory(files, applied)
        validateAppliedChecksums(files, applied)
        return {
          currentVersion: resolveCurrentVersion(files, applied),
          targetVersion: resolveTargetVersion(files),
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
        const files = await readMigrationFiles(migrationsDirectory)
        return withMigrationLock(sql, async () => {
          await ensureMigrationTable(sql)
          const applied = await readAppliedMigrations(sql)
          validateAppliedHistory(files, applied)
          validateAppliedChecksums(files, applied)
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
              await transaction`
                INSERT INTO i0c_data_repository_migration (filename, checksum)
                VALUES (${file.filename}, ${file.checksum})
              `
            })
            appliedNow.push(file.filename)
          }
          return {
            previousVersion,
            currentVersion: resolveTargetVersion(files),
            applied: appliedNow,
          }
        })
      })
    },
  }
}

async function withMigrationClient<T>(
  connectionString: string,
  operation: (sql: Sql) => Promise<T>,
): Promise<T> {
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 30,
    prepare: false,
  })
  try {
    return await operation(sql)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function withMigrationLock<T>(
  sql: Sql,
  operation: () => Promise<T>,
): Promise<T> {
  await sql`SELECT pg_advisory_lock(hashtext('i0c.data-repository.migrations'))`
  try {
    return await operation()
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext('i0c.data-repository.migrations'))`
  }
}

async function readMigrationFiles(directory: string): Promise<MigrationFile[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+.*\.sql$/.test(filename))
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

async function readAppliedMigrations(
  sql: Sql,
): Promise<Map<string, string>> {
  const [table] = await sql<{ exists: boolean }[]>`
    SELECT TO_REGCLASS('i0c_data_repository_migration') IS NOT NULL AS exists
  `
  if (!table?.exists) {
    return new Map()
  }
  const rows = await sql<AppliedMigrationRow[]>`
    SELECT filename, checksum
    FROM i0c_data_repository_migration
    ORDER BY filename ASC
  `
  return new Map(rows.map((row) => [row.filename, row.checksum]))
}

async function ensureMigrationTable(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS i0c_data_repository_migration (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

function validateAppliedChecksums(
  files: readonly MigrationFile[],
  applied: ReadonlyMap<string, string>,
): void {
  for (const file of files) {
    const checksum = applied.get(file.filename)
    if (checksum !== undefined && checksum !== file.checksum) {
      throw new Error(`Applied migration has changed: ${file.filename}`)
    }
  }
}

function validateAppliedHistory(
  files: readonly MigrationFile[],
  applied: ReadonlyMap<string, string>,
): void {
  assertContinuousMigrationHistory(
    files.map((file) => file.filename),
    new Set(applied.keys()),
  )
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

function resolveTargetVersion(files: readonly MigrationFile[]): string {
  const target = files.at(-1)?.filename
  if (!target) {
    throw new Error("No PostgreSQL data repository migrations were found")
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
