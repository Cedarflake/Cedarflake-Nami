import { fileURLToPath } from "node:url"

import {
  createPostgresMigrationProvider as createSharedPostgresMigrationProvider,
} from "@i0c/database-postgres/migrations"
import type { PluginMigrationProvider } from "@i0c/plugin-api"

export interface PostgresMigrationProviderOptions {
  connectionString: string
  migrationsDirectory?: string
}

export function createPostgresMigrationProvider(
  options: PostgresMigrationProviderOptions,
): PluginMigrationProvider {
  return createSharedPostgresMigrationProvider({
    advisoryLockName: "i0c.analytics.migrations",
    connectionString: options.connectionString,
    emptyMigrationsMessage: "No PostgreSQL analytics migrations were found",
    migrationTable: "analytics_schema_migration",
    migrationsDirectory: options.migrationsDirectory
      ?? fileURLToPath(new URL("../migrations/", import.meta.url)),
  })
}
