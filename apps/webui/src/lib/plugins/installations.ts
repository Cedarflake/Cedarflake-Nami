import type { AnalyticsDomainStoreShape } from "@i0c/analytics-domain/store";
import {
  validatePluginManifest,
  type AnalyticsStore,
  type AnalyticsStoreTypes,
  type PluginConfigurationDeclaration,
  type PluginManifest,
} from "@i0c/plugin-api";

import type { AppDataRepository } from "@/lib/data/repository";

export type WebUiAnalyticsStore = AnalyticsStore<
  AnalyticsDomainStoreShape & AnalyticsStoreTypes
> & {
  readonly configured: boolean;
};

export interface WebUiAnalyticsStoreCreateContext {
  bindings: ReadonlyMap<string, unknown>;
  declaration: PluginConfigurationDeclaration;
  development: boolean;
  readEnvironment(name: string): string | undefined;
}

export interface WebUiDataRepositoryCreateContext {
  bindings: ReadonlyMap<string, unknown>;
  readEnvironment(name: string): string | undefined;
}

export interface WebUiDataRepositoryInstallation {
  enabledByDefault: boolean;
  manifest: PluginManifest<"data-repository", "webui">;
  create(
    context: WebUiDataRepositoryCreateContext,
  ): AppDataRepository | Promise<AppDataRepository>;
}

export interface WebUiAnalyticsStoreInstallation {
  enabledByDefault: boolean;
  manifest: PluginManifest<"analytics-store", "webui" | "collector">;
  create(
    context: WebUiAnalyticsStoreCreateContext,
  ): WebUiAnalyticsStore | null | Promise<WebUiAnalyticsStore | null>;
}

export interface WebUiPluginInstallations {
  analyticsStores: readonly WebUiAnalyticsStoreInstallation[];
  dataRepository: WebUiDataRepositoryInstallation;
}

export function defineWebUiPluginInstallations(
  installations: WebUiPluginInstallations,
): WebUiPluginInstallations {
  const pluginIds = new Set<string>();
  validateInstallation(
    installations.dataRepository,
    "data-repository",
    pluginIds,
  );
  for (const installation of installations.analyticsStores) {
    validateInstallation(installation, "analytics-store", pluginIds);
  }
  return installations;
}

export function listWebUiPluginManifests(
  installations: WebUiPluginInstallations,
): readonly PluginManifest[] {
  return [
    installations.dataRepository.manifest,
    ...installations.analyticsStores.map((installation) => installation.manifest),
  ];
}

export function listDefaultWebUiPluginIds(
  installations: WebUiPluginInstallations,
): readonly string[] {
  return [installations.dataRepository, ...installations.analyticsStores]
    .filter((installation) => installation.enabledByDefault)
    .map((installation) => installation.manifest.id);
}

function validateInstallation(
  installation:
    | WebUiDataRepositoryInstallation
    | WebUiAnalyticsStoreInstallation,
  expectedKind: "data-repository" | "analytics-store",
  pluginIds: Set<string>,
): void {
  const result = validatePluginManifest(installation.manifest);
  if (!result.valid) {
    throw new TypeError(result.issues.join("\n"));
  }
  if (
    installation.manifest.kind !== expectedKind
    || installation.manifest.slot !== expectedKind
    || !installation.manifest.hosts.includes("webui")
  ) {
    throw new TypeError(
      `WebUI ${expectedKind} installation has an incompatible manifest`,
    );
  }
  if (pluginIds.has(installation.manifest.id)) {
    throw new TypeError(
      `WebUI plugin ${installation.manifest.id} is installed more than once`,
    );
  }
  pluginIds.add(installation.manifest.id);
}
