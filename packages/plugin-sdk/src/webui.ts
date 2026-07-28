import {
  validatePluginManifest,
  webUiExtensionSlots,
  type PluginConfigurationDeclaration,
  type PluginManifest,
  type WebUiExtensionRegistration,
} from "@i0c/plugin-api"

import type { I0cAnalyticsStore, I0cDataRepository } from "./contracts"

export { StaticWebUiExtensionRegistry } from "@i0c/plugin-api"

export type WebUiAnalyticsStore = I0cAnalyticsStore

export interface WebUiAnalyticsStoreCreateContext {
  bindings: ReadonlyMap<string, unknown>
  declaration: PluginConfigurationDeclaration
  development: boolean
  readEnvironment(name: string): string | undefined
}

export interface WebUiDataRepositoryCreateContext {
  bindings: ReadonlyMap<string, unknown>
  readEnvironment(name: string): string | undefined
}

export interface WebUiDataRepositoryInstallation {
  enabledByDefault: boolean
  manifest: PluginManifest<"data-repository", "webui">
  create(
    context: WebUiDataRepositoryCreateContext,
  ): I0cDataRepository | Promise<I0cDataRepository>
}

export interface WebUiAnalyticsStoreInstallation {
  enabledByDefault: boolean
  manifest: PluginManifest<"analytics-store", "webui" | "collector">
  create(
    context: WebUiAnalyticsStoreCreateContext,
  ): WebUiAnalyticsStore | null | Promise<WebUiAnalyticsStore | null>
}

export interface WebUiPluginInstallations {
  analyticsStores: readonly WebUiAnalyticsStoreInstallation[]
  dataRepository: WebUiDataRepositoryInstallation
}

export type WebUiDataRepositoryPlugin = Omit<
  WebUiDataRepositoryInstallation,
  "enabledByDefault"
>

export type WebUiAnalyticsStorePlugin = Omit<
  WebUiAnalyticsStoreInstallation,
  "enabledByDefault"
>

export function defineWebUiDataRepositoryPlugin<
  const TPlugin extends WebUiDataRepositoryPlugin,
>(plugin: TPlugin): TPlugin {
  assertWebUiManifest(plugin.manifest, "data-repository")
  return plugin
}

export function defineWebUiAnalyticsStorePlugin<
  const TPlugin extends WebUiAnalyticsStorePlugin,
>(plugin: TPlugin): TPlugin {
  assertWebUiManifest(plugin.manifest, "analytics-store")
  return plugin
}

export function defineWebUiPluginInstallations(
  installations: WebUiPluginInstallations,
): WebUiPluginInstallations {
  const pluginIds = new Set<string>()
  validateInstallation(
    installations.dataRepository,
    "data-repository",
    pluginIds,
  )
  for (const installation of installations.analyticsStores) {
    validateInstallation(installation, "analytics-store", pluginIds)
  }
  return installations
}

export function defineWebUiExtension<
  const TValue,
  const TExtension extends WebUiExtensionRegistration<TValue>,
>(extension: TExtension): TExtension {
  if (!extension.id.trim() || !extension.pluginId.trim()) {
    throw new TypeError("WebUI extension and plugin IDs must not be empty")
  }
  if (!Number.isSafeInteger(extension.order) || extension.order < 0) {
    throw new TypeError("WebUI extension order must be a non-negative integer")
  }
  if (!webUiExtensionSlots.includes(extension.slot)) {
    throw new TypeError(`Unsupported WebUI extension slot ${extension.slot}`)
  }
  return extension
}

export function listWebUiPluginManifests(
  installations: WebUiPluginInstallations,
): readonly PluginManifest[] {
  return [
    installations.dataRepository.manifest,
    ...installations.analyticsStores.map((installation) => installation.manifest),
  ]
}

export function listDefaultWebUiPluginIds(
  installations: WebUiPluginInstallations,
): readonly string[] {
  return [installations.dataRepository, ...installations.analyticsStores]
    .filter((installation) => installation.enabledByDefault)
    .map((installation) => installation.manifest.id)
}

function validateInstallation(
  installation:
    | WebUiDataRepositoryInstallation
    | WebUiAnalyticsStoreInstallation,
  expectedKind: "data-repository" | "analytics-store",
  pluginIds: Set<string>,
): void {
  assertWebUiManifest(installation.manifest, expectedKind)
  if (pluginIds.has(installation.manifest.id)) {
    throw new TypeError(
      `WebUI plugin ${installation.manifest.id} is installed more than once`,
    )
  }
  pluginIds.add(installation.manifest.id)
}

function assertWebUiManifest(
  manifest:
    | WebUiDataRepositoryInstallation["manifest"]
    | WebUiAnalyticsStoreInstallation["manifest"],
  expectedKind: "data-repository" | "analytics-store",
): void {
  const result = validatePluginManifest(manifest)
  if (!result.valid) {
    throw new TypeError(result.issues.join("\n"))
  }
  if (
    manifest.kind !== expectedKind
    || manifest.slot !== expectedKind
    || !manifest.hosts.includes("webui")
  ) {
    throw new TypeError(
      `WebUI ${expectedKind} plugin has an incompatible manifest`,
    )
  }
}
