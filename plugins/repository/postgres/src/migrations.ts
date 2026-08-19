import { fileURLToPath } from "node:url"

import {
  createPostgresSchemaMigrationProvider,
} from "@nami/database-postgres/migrations"
import type { PluginSchemaMigrationProvider } from "@nami/plugin-api"

export interface PostgresDataRepositorySchemaMigrationProviderOptions {
  connectionString: string
  migrationsDirectory?: string
}

export function createPostgresDataRepositorySchemaMigrationProvider(
  options: PostgresDataRepositorySchemaMigrationProviderOptions,
): PluginSchemaMigrationProvider {
  return createPostgresSchemaMigrationProvider({
    advisoryLockName: "nami.data-repository.migrations",
    connectionString: options.connectionString,
    emptySchemaMigrationsMessage: "No PostgreSQL data repository migrations were found",
    migrationTable: "nami_data_repository_migration",
    migrationsDirectory: options.migrationsDirectory
      ?? fileURLToPath(new URL("../migrations/", import.meta.url)),
  })
}
