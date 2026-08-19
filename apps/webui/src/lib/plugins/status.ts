import "server-only";

import type { DataConfig, PluginInstanceConfig } from "@nami/config";
import { installedPluginManifests } from "@nami/plugin-catalog";
import type { PluginManifest } from "@nami/plugin-api";

import { runtimePlatformManifests } from "../../../../../nami.runtime.manifests";

import {
  getAnalyticsStore,
  resolveAnalyticsStoreSelection,
} from "@/lib/analytics/store";
import { getEffectiveDataConfig } from "@/lib/configuration/data-config";

import type {
  PluginConfigurationState,
  PluginStatusHealth,
  WebUiPluginStatus,
  WebUiPluginStatusSnapshot,
} from "./status-types";

const POSTGRES_ANALYTICS_STORE_PLUGIN_ID = "@nami/analytics-store-postgres";
const D1_ANALYTICS_STORE_PLUGIN_ID = "@nami/analytics-store-d1";
const compatibilityEnabledPluginIds = new Set([
  ...runtimePlatformManifests.map((manifest) => manifest.id),
  "@nami/analytics-sink-http",
  "@nami/feature-bot-classifier",
]);
const HEALTH_CHECK_TIMEOUT_MS = 3_000;

export async function getWebUiPluginStatusSnapshot(): Promise<WebUiPluginStatusSnapshot> {
  const config = await getEffectiveDataConfig();
  const selectedStoreId = resolveAnalyticsStoreSelection(config)?.pluginId;
  const selectedStoreHealth = selectedStoreId
    ? await resolveSelectedStoreHealth()
    : "disabled";

  return {
    plugins: mergeInstalledManifests()
      .map((manifest) => createPluginStatus(
        manifest,
        config,
        selectedStoreId,
        selectedStoreHealth,
      ))
      .sort((left, right) =>
        left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
      ),
  };
}

function mergeInstalledManifests(): readonly PluginManifest[] {
  const manifests = new Map<string, PluginManifest>(
    installedPluginManifests.map((manifest) => [manifest.id, manifest])
  );
  for (const manifest of runtimePlatformManifests) {
    manifests.set(manifest.id, manifest);
  }
  return [...manifests.values()];
}

function createPluginStatus(
  manifest: PluginManifest,
  config: DataConfig,
  selectedStoreId: string | undefined,
  selectedStoreHealth: PluginStatusHealth,
): WebUiPluginStatus {
  const declaration = resolveEffectiveDeclaration(manifest.id, config);
  const configurationState = resolveConfigurationState(manifest.id, config, declaration);
  const isEnabled = declaration.enabled;
  const bindingsObservable = manifest.hosts.some(
    (host) => host === "collector" || host === "webui"
  );
  const missingSecretBindings = isEnabled && bindingsObservable
    ? resolveMissingSecretBindings(manifest, declaration)
    : [];
  const health = !isEnabled
    ? "disabled"
    : manifest.id === selectedStoreId
      ? selectedStoreHealth
      : "not-supported";

  return {
    apiVersion: manifest.apiVersion,
    bindingsObservable,
    capabilities: manifest.capabilities,
    configurationState,
    description: manifest.description,
    health,
    hosts: manifest.hosts,
    id: manifest.id,
    kind: manifest.kind,
    missingSecretBindings,
    name: manifest.name,
    version: manifest.version,
  };
}

function resolveEffectiveDeclaration(
  pluginId: string,
  config: DataConfig,
): PluginInstanceConfig {
  const configured = config.plugins[pluginId];
  if (configured) {
    return configured;
  }
  if (
    pluginId === POSTGRES_ANALYTICS_STORE_PLUGIN_ID
    && !(D1_ANALYTICS_STORE_PLUGIN_ID in config.plugins)
  ) {
    return { enabled: true };
  }
  return { enabled: compatibilityEnabledPluginIds.has(pluginId) };
}

function resolveConfigurationState(
  pluginId: string,
  config: DataConfig,
  declaration: PluginInstanceConfig,
): PluginConfigurationState {
  if (pluginId in config.plugins) {
    return declaration.enabled ? "configured" : "disabled";
  }
  return declaration.enabled ? "compatibility" : "disabled";
}

function resolveMissingSecretBindings(
  manifest: PluginManifest,
  declaration: PluginInstanceConfig,
): string[] {
  const missing: string[] = [];
  for (const [key, requirement] of Object.entries(manifest.secrets)) {
    if (!requirement.required) {
      continue;
    }
    const binding = declaration.secrets?.[key] ?? requirement.defaultBinding;
    if (!binding || !process.env[binding]?.trim()) {
      missing.push(binding ?? key);
    }
  }
  return missing;
}

async function resolveSelectedStoreHealth(): Promise<PluginStatusHealth> {
  try {
    const store = await getAnalyticsStore();
    if (!store) {
      return "unavailable";
    }
    const report = await withTimeout(
      Promise.resolve(store.healthCheck()),
      HEALTH_CHECK_TIMEOUT_MS,
    );
    return report.status;
  } catch {
    return "unavailable";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Plugin health check timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
