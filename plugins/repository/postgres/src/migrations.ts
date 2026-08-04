import { fileURLToPath } from "node:url"

import {
  createPostgresMigrationProvider,
} from "@i0c/database-postgres/migrations"
import type { PluginMigrationProvider } from "@i0c/plugin-api"

export interface PostgresDataRepositoryMigrationProviderOptions {
  connectionString: string
  migrationsDirectory?: string
}

export function createPostgresDataRepositoryMigrationProvider(
  options: PostgresDataRepositoryMigrationProviderOptions,
): PluginMigrationProvider {
  return createPostgresMigrationProvider({
    advisoryLockName: "i0c.data-repository.migrations",
    connectionString: options.connectionString,
    emptyMigrationsMessage: "No PostgreSQL data repository migrations were found",
    migrationTable: "i0c_data_repository_migration",
    migrationsDirectory: options.migrationsDirectory
      ?? fileURLToPath(new URL("../migrations/", import.meta.url)),
  })
}
