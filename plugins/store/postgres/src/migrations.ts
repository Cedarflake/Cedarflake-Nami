import { fileURLToPath } from "node:url"

import {
  createPostgresSchemaMigrationProvider as createSharedPostgresSchemaMigrationProvider,
} from "@i0c/database-postgres/migrations"
import type { PluginSchemaMigrationProvider } from "@i0c/plugin-api"

export interface PostgresSchemaMigrationProviderOptions {
  connectionString: string
  migrationsDirectory?: string
}

export function createPostgresSchemaMigrationProvider(
  options: PostgresSchemaMigrationProviderOptions,
): PluginSchemaMigrationProvider {
  return createSharedPostgresSchemaMigrationProvider({
    advisoryLockName: "i0c.analytics.migrations",
    connectionString: options.connectionString,
    emptySchemaMigrationsMessage: "No PostgreSQL analytics migrations were found",
    migrationTable: "analytics_schema_migration",
    migrationsDirectory: options.migrationsDirectory
      ?? fileURLToPath(new URL("../migrations/", import.meta.url)),
  })
}
