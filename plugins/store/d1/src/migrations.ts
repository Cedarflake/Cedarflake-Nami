import {
  createD1MigrationProvider as createSharedD1MigrationProvider,
  splitD1MigrationStatements as splitSharedD1MigrationStatements,
  type D1Migration,
} from "@i0c/database-d1/migrations"
import type { D1Database } from "@i0c/database-d1/types"
import type { PluginMigrationProvider } from "@i0c/plugin-api"

export type { D1Migration } from "@i0c/database-d1/migrations"

export function createD1MigrationProvider(
  database: D1Database,
  migrations: readonly D1Migration[],
): PluginMigrationProvider {
  return createSharedD1MigrationProvider(database, migrations, {
    migrationTable: "analytics_schema_migration",
    emptyMigrationsMessage: "No D1 analytics migrations were provided",
    emptyStatementsMessage: "D1 migration contains no SQL statements",
  })
}

export function splitD1MigrationStatements(sql: string): readonly string[] {
  return splitSharedD1MigrationStatements(sql)
}
