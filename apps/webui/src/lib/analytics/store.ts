import "server-only";

import type { DataConfig } from "@nami/config";
import {
  PluginError,
  type PluginConfigurationDeclaration
} from "@nami/plugin-api";
import { webUiPluginInstallations } from "@nami/webui-config";

import { getEffectiveDataConfig } from "@/lib/configuration/data-config";
import type { WebUiAnalyticsStore } from "@/lib/plugins/installations";
import { resolveWebUiPlugins } from "@/lib/plugins/registry";

export interface AnalyticsStoreSelection {
  declaration: PluginConfigurationDeclaration;
  pluginId: string;
}

export type { WebUiAnalyticsStore } from "@/lib/plugins/installations";

const analyticsStoreBindings = new Map<string, unknown>();
let analyticsStoreCache:
  | { key: string; storePromise: Promise<WebUiAnalyticsStore | null> }
  | undefined;

export function configureAnalyticsStoreBinding(
  pluginId: string,
  binding: unknown
): void {
  analyticsStoreBindings.set(pluginId, binding);
  analyticsStoreCache = undefined;
}

export function resolveAnalyticsStoreSelection(
  config: DataConfig,
): AnalyticsStoreSelection | undefined {
  const selected = resolveWebUiPlugins(config)
    .find((plugin) => plugin.manifest.slot === "analytics-store");
  return selected
    ? {
        declaration: selected.declaration,
        pluginId: selected.manifest.id,
      }
    : undefined;
}

function getAnalyticsStoreCacheKey(
  selection: AnalyticsStoreSelection | undefined,
): string {
  return JSON.stringify(selection ?? null);
}

export async function getAnalyticsStore(
  config?: DataConfig,
): Promise<WebUiAnalyticsStore | null> {
  const dataConfig = config ?? await getEffectiveDataConfig();
  return getAnalyticsStoreForSelection(resolveAnalyticsStoreSelection(dataConfig));
}

export async function getAnalyticsStoreForSelection(
  selected: AnalyticsStoreSelection | undefined,
): Promise<WebUiAnalyticsStore | null> {
  const cacheKey = getAnalyticsStoreCacheKey(selected);
  if (analyticsStoreCache?.key === cacheKey) {
    return analyticsStoreCache.storePromise;
  }

  if (!selected) {
    const storePromise = Promise.resolve(null);
    analyticsStoreCache = { key: cacheKey, storePromise };
    return storePromise;
  }
  const installation = webUiPluginInstallations.analyticsStores.find(
    (candidate) => candidate.manifest.id === selected.pluginId
  );
  if (!installation) {
    throw new PluginError(
      selected.pluginId,
      "PLUGIN_NOT_INSTALLED",
      "The selected analytics store has no WebUI factory"
    );
  }

  const storePromise = Promise.resolve(installation.create({
    bindings: analyticsStoreBindings,
    declaration: selected.declaration,
    development: process.env.NODE_ENV === "development",
    readEnvironment: (name) => process.env[name]
  }));
  analyticsStoreCache = { key: cacheKey, storePromise };
  try {
    return await storePromise;
  } catch (error) {
    if (analyticsStoreCache?.storePromise === storePromise) {
      analyticsStoreCache = undefined;
    }
    throw error;
  }
}

export async function getRequiredAnalyticsStore(): Promise<WebUiAnalyticsStore> {
  const store = await getAnalyticsStore();
  return requireAnalyticsStore(store);
}

export async function getRequiredAnalyticsStoreForSelection(
  selection: AnalyticsStoreSelection | undefined,
): Promise<WebUiAnalyticsStore> {
  const store = await getAnalyticsStoreForSelection(selection);
  return requireAnalyticsStore(store);
}

function requireAnalyticsStore(
  store: WebUiAnalyticsStore | null,
): WebUiAnalyticsStore {
  if (!store) {
    throw new PluginError(
      "@nami/webui-host",
      "PLUGIN_NOT_INSTALLED",
      "The selected analytics store is unavailable"
    );
  }
  return store;
}

export async function isAnalyticsStoreConfigured(): Promise<boolean> {
  const store = await getAnalyticsStore();
  return store?.configured === true;
}
