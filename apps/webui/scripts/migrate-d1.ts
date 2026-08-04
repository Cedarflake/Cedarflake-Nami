import process from "node:process"
import { fileURLToPath } from "node:url"

import { bootstrapConfig } from "@i0c/config"
import { loadD1MigrationFiles } from "@i0c/database-d1/node"
import { createD1RestDatabase } from "@i0c/database-d1/rest"
import { createD1DataRepositoryMigrationProvider } from "@i0c/plugin-data-repository-d1/migrations"
import { createD1MigrationProvider } from "@i0c/plugin-analytics-store-d1/migrations"
import type { PluginMigrationProvider } from "@i0c/plugin-api"

type D1MigrationTarget = "analytics" | "repository"

const target = resolveTarget(process.argv[2])
const d1Config = bootstrapConfig.webui.d1
const apiToken = process.env[d1Config.apiTokenBinding]?.trim()
if (!apiToken) {
  throw new Error(
    `${d1Config.apiTokenBinding} is required to migrate Cloudflare D1`,
  )
}

const databaseId = target === "analytics"
  ? d1Config.databaseIds.analytics
  : d1Config.databaseIds.dataRepository
const database = createD1RestDatabase({
  accountId: d1Config.accountId,
  apiToken,
  databaseId,
  requestTimeoutMs: d1Config.requestTimeoutMs,
})
const provider = await createMigrationProvider(target, database)
const plan = await provider.migrationPlan()
if (plan.actions.length === 0) {
  console.info(`${target} D1 database is already at ${plan.targetVersion}`)
} else {
  console.info(
    `Applying ${plan.actions.length} ${target} D1 migration(s) from ${plan.currentVersion ?? "none"} to ${plan.targetVersion}`,
  )
  const result = await provider.applyMigrations({
    expectedCurrentVersion: plan.currentVersion,
  })
  console.info(
    `Applied ${result.applied.length} migration(s); current version is ${result.currentVersion}`,
  )
}

async function createMigrationProvider(
  target: D1MigrationTarget,
  database: Parameters<typeof createD1MigrationProvider>[0],
): Promise<PluginMigrationProvider> {
  if (target === "analytics") {
    const directory = fileURLToPath(new URL(
      "../../../plugins/store/d1/migrations/",
      import.meta.url,
    ))
    return createD1MigrationProvider(
      database,
      await loadD1MigrationFiles(directory),
    )
  }

  const directory = fileURLToPath(new URL(
    "../../../plugins/repository/d1/migrations/",
    import.meta.url,
  ))
  return createD1DataRepositoryMigrationProvider(
    database,
    await loadD1MigrationFiles(directory),
  )
}

function resolveTarget(value: string | undefined): D1MigrationTarget {
  if (value === "analytics" || value === "repository") {
    return value
  }
  throw new TypeError("D1 migration target must be analytics or repository")
}
