import {
  createD1MigrationProvider,
  splitD1MigrationStatements,
  type D1Migration,
} from "@i0c/database-d1/migrations"
import type { D1Database } from "@i0c/database-d1/types"
import type { PluginMigrationProvider } from "@i0c/plugin-api"

export type D1DataRepositoryMigration = D1Migration

export function createD1DataRepositoryMigrationProvider(
  database: D1Database,
  migrations: readonly D1DataRepositoryMigration[],
): PluginMigrationProvider {
  return createD1MigrationProvider(database, migrations, {
    migrationTable: "i0c_data_repository_migration",
    emptyMigrationsMessage: "No D1 data repository migrations were provided",
    emptyStatementsMessage: "D1 data repository migration contains no SQL statements",
  })
}

export function splitD1DataRepositoryMigrationStatements(
  sql: string,
): readonly string[] {
  return splitD1MigrationStatements(
    sql,
    "D1 data repository migration contains no SQL statements",
  )
}
