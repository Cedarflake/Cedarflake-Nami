import {
  createD1SchemaMigrationProvider as createSharedD1SchemaMigrationProvider,
  splitD1SchemaMigrationStatements as splitSharedD1SchemaMigrationStatements,
  type D1SchemaMigration,
} from "@i0c/database-d1/migrations"
import type { D1Database } from "@i0c/database-d1/types"
import type { PluginSchemaMigrationProvider } from "@i0c/plugin-api"

export type { D1SchemaMigration } from "@i0c/database-d1/migrations"

export function createD1SchemaMigrationProvider(
  database: D1Database,
  migrations: readonly D1SchemaMigration[],
): PluginSchemaMigrationProvider {
  return createSharedD1SchemaMigrationProvider(database, migrations, {
    migrationTable: "analytics_schema_migration",
    emptySchemaMigrationsMessage: "No D1 analytics migrations were provided",
    emptySchemaStatementsMessage: "D1 migration contains no SQL statements",
  })
}

export function splitD1SchemaMigrationStatements(sql: string): readonly string[] {
  return splitSharedD1SchemaMigrationStatements(sql)
}
