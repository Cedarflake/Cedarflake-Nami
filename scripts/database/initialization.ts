import { fileURLToPath } from "node:url"

import type { BootstrapConfig } from "@nami/config"
import { loadD1SchemaMigrationFiles } from "@nami/database-d1/node"
import { createD1RestDatabase } from "@nami/database-d1/rest"
import { createD1DataRepositorySchemaMigrationProvider } from "@nami/plugin-data-repository-d1/migrations"
import { createPostgresDataRepositorySchemaMigrationProvider } from "@nami/plugin-data-repository-postgres/migrations"
import { createD1SchemaMigrationProvider } from "@nami/plugin-analytics-store-d1/migrations"
import { postgresAnalyticsStoreManifest } from "@nami/plugin-analytics-store-postgres/manifest"
import { createPostgresSchemaMigrationProvider } from "@nami/plugin-analytics-store-postgres/migrations"
import type { PluginSchemaMigrationProvider } from "@nami/plugin-api"

export type DatabaseProvider = "d1" | "postgres"
export type DatabasePurpose = "analytics" | "repository"

export interface DatabaseInitializationStep {
  provider: DatabaseProvider
  purpose: DatabasePurpose
}

export interface DatabaseInitializationRuntime {
  createProvider(
    step: DatabaseInitializationStep,
  ): Promise<PluginSchemaMigrationProvider>
  log(message: string): void
}

interface ConfiguredProviderOptions {
  config: BootstrapConfig
  readEnvironment(name: string): string | undefined
}

export function resolveDatabaseInitializationPlan(
  config: BootstrapConfig,
): readonly DatabaseInitializationStep[] {
  const steps: DatabaseInitializationStep[] = []
  if (config.data.repository.provider !== "github") {
    steps.push({
      provider: config.data.repository.provider,
      purpose: "repository",
    })
  }
  steps.push({
    provider: config.webui.analyticsStore.provider,
    purpose: "analytics",
  })
  return steps
}

export function resolveDatabaseProvider(value: string | undefined): DatabaseProvider {
  if (value === "d1" || value === "postgres") {
    return value
  }
  throw new TypeError(
    "Database schema update provider must be d1 or postgres",
  )
}

export function resolveDatabasePurpose(value: string | undefined): DatabasePurpose {
  if (value === "analytics" || value === "repository") {
    return value
  }
  throw new TypeError(
    "Database schema update purpose must be analytics or repository",
  )
}

export async function initializeDatabases(
  steps: readonly DatabaseInitializationStep[],
  runtime: DatabaseInitializationRuntime,
): Promise<void> {
  for (const step of steps) {
    const label = `${step.provider} ${step.purpose}`
    const provider = await runtime.createProvider(step)
    const plan = await provider.schemaMigrationPlan()
    if (plan.actions.length === 0) {
      runtime.log(`${label} schema is already initialized at ${plan.targetVersion}`)
      continue
    }

    runtime.log(
      `Applying ${plan.actions.length} ${label} schema change(s) from ${plan.currentVersion ?? "none"} to ${plan.targetVersion}`,
    )
    const result = await provider.applySchemaMigrations({
      expectedCurrentVersion: plan.currentVersion,
    })
    runtime.log(
      `Applied ${result.applied.length} ${label} schema change(s); current version is ${result.currentVersion}`,
    )
  }
}

export async function createConfiguredSchemaMigrationProvider(
  step: DatabaseInitializationStep,
  options: ConfiguredProviderOptions,
): Promise<PluginSchemaMigrationProvider> {
  if (step.provider === "postgres") {
    const connectionString = readPostgresConnectionString(step, options)
    return step.purpose === "repository"
      ? createPostgresDataRepositorySchemaMigrationProvider({ connectionString })
      : createPostgresSchemaMigrationProvider({ connectionString })
  }

  const d1Config = options.config.webui.d1
  const apiToken = options.readEnvironment(d1Config.apiTokenBinding)?.trim()
  if (!apiToken) {
    throw new Error(
      `${d1Config.apiTokenBinding} is required to initialize Cloudflare D1`,
    )
  }
  if (!d1Config.accountId.trim()) {
    throw new Error("Cloudflare accountId is required to initialize Cloudflare D1")
  }

  const databaseId = step.purpose === "analytics"
    ? d1Config.databaseIds.analytics
    : d1Config.databaseIds.dataRepository
  if (!databaseId.trim()) {
    throw new Error(
      `Cloudflare ${step.purpose} database ID is required to initialize Cloudflare D1`,
    )
  }

  const database = createD1RestDatabase({
    accountId: d1Config.accountId,
    apiToken,
    databaseId,
    requestTimeoutMs: d1Config.requestTimeoutMs,
  })
  if (step.purpose === "repository") {
    const directory = fileURLToPath(new URL(
      "../../plugins/repository/d1/migrations/",
      import.meta.url,
    ))
    return createD1DataRepositorySchemaMigrationProvider(
      database,
      await loadD1SchemaMigrationFiles(directory),
    )
  }

  const directory = fileURLToPath(new URL(
    "../../plugins/store/d1/migrations/",
    import.meta.url,
  ))
  return createD1SchemaMigrationProvider(
    database,
    await loadD1SchemaMigrationFiles(directory),
  )
}

function readPostgresConnectionString(
  step: DatabaseInitializationStep,
  options: ConfiguredProviderOptions,
): string {
  const repository = options.config.data.repository
  const binding = step.purpose === "repository"
    && repository.provider === "postgres"
    ? repository.databaseUrlBinding
    : postgresAnalyticsStoreManifest.secrets.databaseUrl.defaultBinding
      ?? "DATABASE_URL"
  const connectionString = options.readEnvironment(binding)?.trim()
  if (!connectionString) {
    throw new Error(
      `${binding} is required to initialize the PostgreSQL ${step.purpose} database`,
    )
  }
  return connectionString
}
