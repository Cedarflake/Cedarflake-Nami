import { fileURLToPath } from "node:url"

import {
  createPostgresSchemaMigrationProvider,
} from "@i0c/database-postgres/migrations"
import type { PluginSchemaMigrationProvider } from "@i0c/plugin-api"

export interface PostgresDataRepositorySchemaMigrationProviderOptions {
  connectionString: string
  migrationsDirectory?: string
}

export function createPostgresDataRepositorySchemaMigrationProvider(
  options: PostgresDataRepositorySchemaMigrationProviderOptions,
): PluginSchemaMigrationProvider {
  return createPostgresSchemaMigrationProvider({
    advisoryLockName: "i0c.data-repository.migrations",
    connectionString: options.connectionString,
    emptySchemaMigrationsMessage: "No PostgreSQL data repository migrations were found",
    migrationTable: "i0c_data_repository_migration",
    migrationsDirectory: options.migrationsDirectory
      ?? fileURLToPath(new URL("../migrations/", import.meta.url)),
  })
}
