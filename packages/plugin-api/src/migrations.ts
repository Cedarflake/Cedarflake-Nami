import type { Awaitable, JsonObject } from "./types"

export interface PluginSchemaMigrationStatus {
  currentVersion: string | null
  targetVersion: string
  pending: number
}

export interface PluginSchemaMigrationAction {
  id: string
  description: string
  destructive: boolean
  details?: JsonObject
}

export interface PluginSchemaMigrationPlan {
  currentVersion: string | null
  targetVersion: string
  actions: readonly PluginSchemaMigrationAction[]
}

export interface PluginSchemaMigrationApplyInput {
  expectedCurrentVersion?: string | null
  allowDestructive?: boolean
}

export interface PluginSchemaMigrationApplyResult {
  previousVersion: string | null
  currentVersion: string
  applied: readonly string[]
}

export interface PluginSchemaMigrationProvider {
  schemaMigrationStatus(): Awaitable<PluginSchemaMigrationStatus>
  schemaMigrationPlan(): Awaitable<PluginSchemaMigrationPlan>
  applySchemaMigrations(
    input?: PluginSchemaMigrationApplyInput,
  ): Awaitable<PluginSchemaMigrationApplyResult>
}

export function assertContinuousSchemaMigrationHistory(
  orderedMigrationIds: readonly string[],
  appliedMigrationIds: ReadonlySet<string>,
): void {
  const knownMigrationIds = new Set(orderedMigrationIds)
  if (knownMigrationIds.size !== orderedMigrationIds.length) {
    throw new Error("Local schema migration IDs must be unique")
  }

  for (const appliedId of appliedMigrationIds) {
    if (!knownMigrationIds.has(appliedId)) {
      throw new Error(
        `Database contains an unknown applied schema migration: ${appliedId}`,
      )
    }
  }

  let foundPendingMigration = false
  for (const migrationId of orderedMigrationIds) {
    if (!appliedMigrationIds.has(migrationId)) {
      foundPendingMigration = true
      continue
    }
    if (foundPendingMigration) {
      throw new Error(
        `Applied schema migration history is not a continuous prefix: ${migrationId}`,
      )
    }
  }
}
