import type { AnalyticsProvider } from "@nami/analytics-domain"
import type { AnalyticsClassificationHookContext } from "@nami/analytics-domain/classification"
import type { DataConfig, RedirectsConfig } from "@nami/config"
import {
  validatePluginManifest,
  type AnalyticsSink,
  type JsonObject,
  type PluginLogger,
  type PluginManifest,
  type RuntimeCache,
  type RuntimeDataSource,
  type RuntimeFeatureRegistration,
} from "@nami/plugin-api"

export interface RuntimeDataSourceServices {
  cache?: RuntimeCache
  fetchImpl: typeof fetch
  fetchInit?: RequestInit
  getCurrentDataConfig(): DataConfig
  logger: PluginLogger
  now(): number
  setCurrentDataConfig(config: DataConfig): void
  validateDataConfig?(config: DataConfig): void
  waitUntil?(promise: Promise<unknown>): void
}

export interface RuntimeAnalyticsSinkEvent {
  eventKind: string
}

export interface RuntimeAnalyticsSinkContext {
  completedAt: number
  dataConfig: DataConfig
  endpoint: string
  fetchImpl: typeof fetch
  provider: AnalyticsProvider
  readSecret(bindingName: string): string | undefined
  sourceId: string
  writeKey?: string
}

export type InstalledRuntimeAnalyticsSink = AnalyticsSink<
  RuntimeAnalyticsSinkEvent,
  RuntimeAnalyticsSinkContext
>

export interface RuntimeDataSourceInstallation {
  bootstrapConfig: JsonObject
  enabledByDefault: boolean
  endpoints?: {
    config?: string
    rules?: string
  }
  manifest: PluginManifest<"data-source", "runtime">
  create(
    config: JsonObject,
    services: RuntimeDataSourceServices,
  ): RuntimeDataSource<DataConfig, RedirectsConfig>
}

export interface RuntimeAnalyticsSinkInstallation {
  enabledByDefault: boolean
  manifest: PluginManifest<"analytics-sink", "runtime">
  create(config: JsonObject | undefined): InstalledRuntimeAnalyticsSink
}

export interface RuntimeFeatureInstallation {
  enabledByDefault: boolean
  manifest: PluginManifest<"feature", "runtime">
  create(config: JsonObject | undefined): RuntimeFeatureRegistration<
    AnalyticsClassificationHookContext
  >
}

export interface RuntimePluginInstallations {
  analyticsSinks: readonly RuntimeAnalyticsSinkInstallation[]
  bundlePackages: readonly string[]
  dataSource: RuntimeDataSourceInstallation
  features: readonly RuntimeFeatureInstallation[]
}

export function defineRuntimePluginInstallations(
  installations: RuntimePluginInstallations,
): RuntimePluginInstallations {
  const pluginIds = new Set<string>()
  validateRuntimePluginInstallation(
    installations.dataSource,
    "data-source",
    pluginIds,
  )
  validateRuntimeDataSourceBootstrap(installations.dataSource)
  for (const installation of installations.analyticsSinks) {
    validateRuntimePluginInstallation(installation, "analytics-sink", pluginIds)
  }
  for (const installation of installations.features) {
    validateRuntimePluginInstallation(installation, "feature", pluginIds)
  }

  if (
    !Array.isArray(installations.bundlePackages)
    || installations.bundlePackages.some(
      (packageName) => typeof packageName !== "string" || !packageName.trim(),
    )
    || new Set(installations.bundlePackages).size !== installations.bundlePackages.length
  ) {
    throw new TypeError("Runtime plugin bundle packages must be unique non-empty strings")
  }

  return installations
}

export function listRuntimePluginManifests(
  installations: RuntimePluginInstallations,
): readonly PluginManifest[] {
  return [
    installations.dataSource.manifest,
    ...installations.analyticsSinks.map((installation) => installation.manifest),
    ...installations.features.map((installation) => installation.manifest),
  ]
}

export function listDefaultRuntimePluginIds(
  installations: RuntimePluginInstallations,
): readonly string[] {
  return [
    installations.dataSource,
    ...installations.analyticsSinks,
    ...installations.features,
  ]
    .filter((installation) => installation.enabledByDefault)
    .map((installation) => installation.manifest.id)
}

function validateRuntimePluginInstallation(
  installation:
    | RuntimeDataSourceInstallation
    | RuntimeAnalyticsSinkInstallation
    | RuntimeFeatureInstallation,
  expectedKind: "data-source" | "analytics-sink" | "feature",
  pluginIds: Set<string>,
): void {
  const result = validatePluginManifest(installation.manifest)
  if (!result.valid) {
    throw new TypeError(result.issues.join("\n"))
  }
  if (
    installation.manifest.kind !== expectedKind
    || (
      installation.manifest.slot !== expectedKind
      && expectedKind !== "feature"
    )
    || !installation.manifest.hosts.includes("runtime")
  ) {
    throw new TypeError(
      `Runtime ${expectedKind} installation has an incompatible manifest`,
    )
  }
  if (
    expectedKind === "feature"
    && installation.manifest.slot !== "feature"
    && !installation.manifest.slot.startsWith("feature:")
  ) {
    throw new TypeError("Runtime feature installation has an incompatible slot")
  }
  if (pluginIds.has(installation.manifest.id)) {
    throw new TypeError(
      `Runtime plugin ${installation.manifest.id} is installed more than once`,
    )
  }
  pluginIds.add(installation.manifest.id)
}

function validateRuntimeDataSourceBootstrap(
  installation: RuntimeDataSourceInstallation,
): void {
  if (
    !isPlainRecord(installation.bootstrapConfig)
    || (
      installation.endpoints !== undefined
      && (
        !isPlainRecord(installation.endpoints)
        || (
          installation.endpoints.config !== undefined
          && !isNonEmptyString(installation.endpoints.config)
        )
        || (
          installation.endpoints.rules !== undefined
          && !isNonEmptyString(installation.endpoints.rules)
        )
      )
    )
  ) {
    throw new TypeError(
      "Runtime data-source installation has invalid bootstrap metadata",
    )
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim())
}
