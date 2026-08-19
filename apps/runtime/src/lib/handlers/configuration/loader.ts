/**
 * @file loader.ts
 * @description
 * [EN] Runtime data-source orchestration.
 * Resolves host options and delegates remote configuration loading to the selected source plugin.
 *
 * [CN] Runtime 数据源编排。
 * 解析宿主选项，并将远程配置加载委托给选中的数据源插件。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import { defaultDataConfig } from "@nami/config";
import type { DataConfig } from "@nami/config";
import type { JsonObject } from "@nami/plugin-api";
import {
  runtimePluginInstallations as defaultRuntimePluginInstallations
} from "@nami/runtime-config";

import { runtimePluginLogger } from "@/plugins/logger";
import { createRuntimeFeaturePipeline } from "@/plugins/features";
import { resolveRuntimePlugins } from "@/plugins/registry";

import { DEFAULT_CACHE_TTL_SECONDS } from "../core/constants";
import type {
  HandlerOptions,
  RedirectsConfig,
  ResolvedRuntime
} from "../core/types";

export function resolveRuntimeOptions(options: HandlerOptions): ResolvedRuntime {
  const fetchImpl: typeof fetch =
    options.fetchImpl ??
    (typeof globalThis.fetch === "function"
      ? (globalThis.fetch.bind(globalThis) as typeof fetch)
      : ((() => {
          throw new Error("fetch is not available in this environment");
        }) as unknown as typeof fetch));
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? (() => Math.random());
  const pluginInstallations = options.pluginInstallations
    ?? defaultRuntimePluginInstallations;
  const redirectsConfigUrl = options.redirectsConfigUrl
    ?? options.configUrl
    ?? pluginInstallations.dataSource.endpoints?.rules;
  const dataConfigUrl = options.dataConfigUrl === null
    ? undefined
    : options.dataConfigUrl
      ?? (options.configUrl
        ? undefined
        : pluginInstallations.dataSource.endpoints?.config);
  const dataConfigCacheTtlSeconds = options.dataConfigCacheTtlSeconds
    ?? defaultDataConfig.runtime.configCacheTtlSeconds;
  const redirectsCacheTtlSeconds = options.redirectsCacheTtlSeconds
    ?? options.cacheTtlSeconds
    ?? defaultDataConfig.runtime.redirectsCacheTtlSeconds
    ?? DEFAULT_CACHE_TTL_SECONDS;
  let currentDataConfig: DataConfig = defaultDataConfig;
  const provider = options.provider ?? "unknown";
  const runtimeFeatures = options.runtimeFeatures ?? [];
  const dataSourceBootstrapConfig: JsonObject = {
    ...pluginInstallations.dataSource.bootstrapConfig
  };
  if (dataConfigUrl) {
    dataSourceBootstrapConfig.dataConfigUrl = dataConfigUrl;
  } else if (options.dataConfigUrl === null || options.configUrl) {
    delete dataSourceBootstrapConfig.dataConfigUrl;
  }
  if (redirectsConfigUrl) {
    dataSourceBootstrapConfig.redirectsConfigUrl = redirectsConfigUrl;
  }
  if (options.dataConfigCacheTtlSeconds !== undefined) {
    dataSourceBootstrapConfig.dataConfigCacheTtlSeconds =
      dataConfigCacheTtlSeconds;
  }
  if (
    options.redirectsCacheTtlSeconds !== undefined
    || options.cacheTtlSeconds !== undefined
  ) {
    dataSourceBootstrapConfig.redirectsCacheTtlSeconds =
      redirectsCacheTtlSeconds;
  }

  const dataSource = options.dataSource ?? pluginInstallations.dataSource.create(
    dataSourceBootstrapConfig,
    {
      cache: options.cache,
      fetchImpl,
      fetchInit: options.fetchInit,
      getCurrentDataConfig: () => currentDataConfig,
      logger: runtimePluginLogger,
      now,
      setCurrentDataConfig: (config) => {
        currentDataConfig = config;
      },
      validateDataConfig: (config) => {
        resolveRuntimePlugins(config, {
          platformPluginId: options.platformPluginId,
          pluginInstallations,
          runtimePlatformManifests: options.runtimePlatformManifests ?? []
        });
      },
      waitUntil: options.waitUntil
    }
  );

  return {
    ...(redirectsConfigUrl
      ? {
          configUrl: redirectsConfigUrl,
          redirectsConfigUrl
        }
      : {}),
    dataConfig: currentDataConfig,
    ...(dataConfigUrl ? { dataConfigUrl } : {}),
    dataSource,
    ...(options.analyticsSink ? { analyticsSink: options.analyticsSink } : {}),
    featurePipeline: createRuntimeFeaturePipeline(
      currentDataConfig,
      {
        platformPluginId: options.platformPluginId,
        pluginInstallations,
        runtimePlatformManifests: options.runtimePlatformManifests ?? []
      },
      runtimeFeatures
    ),
    runtimeFeatures,
    cache: options.cache,
    cacheTtlSeconds: redirectsCacheTtlSeconds,
    fetchImpl,
    fetchInit: options.fetchInit,
    envBindings: options.envBindings,
    readEnvironment: options.readEnvironment,
    provider,
    platformPluginId: options.platformPluginId,
    pluginInstallations,
    runtimePlatformManifests: options.runtimePlatformManifests ?? [],
    country: options.country,
    waitUntil: options.waitUntil,
    now,
    random
  };
}

export async function loadDataConfig(runtime: ResolvedRuntime): Promise<DataConfig> {
  const config = await runtime.dataSource.loadConfig();
  const resolved = config ?? runtime.dataConfig;
  resolveRuntimePlugins(resolved, {
    platformPluginId: runtime.platformPluginId,
    pluginInstallations: runtime.pluginInstallations,
    runtimePlatformManifests: runtime.runtimePlatformManifests
  });
  return resolved;
}

export async function loadRedirects(runtime: ResolvedRuntime): Promise<RedirectsConfig | null> {
  return runtime.dataSource.loadRules();
}

export async function loadConfig(runtime: ResolvedRuntime): Promise<RedirectsConfig | null> {
  return loadRedirects(runtime);
}
