import {
  createD1SchemaMigrationProvider,
  splitD1SchemaMigrationStatements,
  type D1SchemaMigration,
} from "@i0c/database-d1/migrations"
import type { D1Database } from "@i0c/database-d1/types"
import type { PluginSchemaMigrationProvider } from "@i0c/plugin-api"

export type D1DataRepositorySchemaMigration = D1SchemaMigration

export function createD1DataRepositorySchemaMigrationProvider(
  database: D1Database,
  migrations: readonly D1DataRepositorySchemaMigration[],
): PluginSchemaMigrationProvider {
  return createD1SchemaMigrationProvider(database, migrations, {
    migrationTable: "i0c_data_repository_migration",
    emptySchemaMigrationsMessage: "No D1 data repository migrations were provided",
    emptySchemaStatementsMessage: "D1 data repository migration contains no SQL statements",
  })
}

export function splitD1DataRepositorySchemaMigrationStatements(
  sql: string,
): readonly string[] {
  return splitD1SchemaMigrationStatements(
    sql,
    "D1 data repository migration contains no SQL statements",
  )
}
