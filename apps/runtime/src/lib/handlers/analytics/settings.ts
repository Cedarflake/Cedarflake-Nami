/**
 * @file settings.ts
 * @description
 * [EN] Resolves and validates Runtime analytics configuration and attribution signing keys.
 * Combines versioned public settings, secret provider bindings, and delivery eligibility.
 *
 * [CN] 解析并校验 Runtime 统计配置与归因签名密钥。
 * 集中组合版本化公开配置、平台密钥绑定以及投递资格判断。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import type { JsonObject } from "@nami/plugin-api";

import { resolveRuntimePluginConfigurations } from "@/plugins/registry";

import {
  deriveAttributionHmacKey,
  normalizeAnalyticsHostname
} from "./attribution";
import { readRuntimeSecret } from "../configuration/env";
import type { ResolvedRuntime } from "../core/types";

const NAMI_SECRET = "NAMI_SECRET";
const LEGACY_ANALYTICS_WRITE_KEY = "ANALYTICS_WRITE_KEY";
const ANALYTICS_RUNTIME_SAMPLE_RATE = 0.1;

let attributionKeyCache: {
  writeKey: string;
  key: Promise<ArrayBuffer>;
} | undefined;

export interface AnalyticsDeliveryConfig {
  endpoint: string;
  pluginConfig?: JsonObject;
  pluginId: string;
  sourceId: string;
  writeKey: string;
}

export interface AnalyticsRuntimeSettings {
  attributionKey?: ArrayBuffer;
  delivery: AnalyticsDeliveryConfig | null;
  sourceHostname?: string;
  runtimeSampleRate: number;
  sourceId?: string;
}

export function createDefaultAnalyticsRuntimeSettings(): AnalyticsRuntimeSettings {
  return {
    delivery: null,
    runtimeSampleRate: ANALYTICS_RUNTIME_SAMPLE_RATE
  };
}

export async function resolveAnalyticsSettings(
  runtime: ResolvedRuntime
): Promise<AnalyticsRuntimeSettings> {
  const sourceId = normalizeAnalyticsHostname(runtime.dataConfig.analytics.sourceId) ?? undefined;
  const endpointValue = runtime.dataConfig.analytics.ingestEndpoint;
  const sinkPlugin = resolveRuntimePluginConfigurations(
    runtime.dataConfig,
    {
      platformPluginId: runtime.platformPluginId,
      pluginInstallations: runtime.pluginInstallations,
      runtimePlatformManifests: runtime.runtimePlatformManifests
    }
  ).find((plugin) => plugin.manifest.kind === "analytics-sink");
  const configuredWriteKeyBinding = sinkPlugin?.declaration.secrets?.writeKey
    ?? sinkPlugin?.manifest.secrets.writeKey?.defaultBinding
    ?? NAMI_SECRET;
  const writeKeyBinding = configuredWriteKeyBinding === LEGACY_ANALYTICS_WRITE_KEY
    ? NAMI_SECRET
    : configuredWriteKeyBinding;
  const writeKey = readRuntimeSecret(
    runtime.envBindings,
    writeKeyBinding,
    runtime.readEnvironment
  )?.trim();
  const sourceHostname = sourceId;
  let attributionKey: ArrayBuffer | undefined;
  if (writeKey && writeKey.length >= 32) {
    try {
      attributionKey = await getAttributionHmacKey(writeKey);
    } catch (error) {
      console.error("[Analytics] Failed to derive attribution key", error);
    }
  }

  let delivery: AnalyticsDeliveryConfig | null = null;
  if (sinkPlugin && endpointValue && sourceId && writeKey && writeKey.length >= 32) {
    try {
      const endpoint = new URL(endpointValue);
      const isLocalHttp = endpoint.protocol === "http:" && isLoopbackHost(endpoint.hostname);
      if ((endpoint.protocol === "https:" || isLocalHttp) && !endpoint.username && !endpoint.password) {
        delivery = {
          endpoint: endpoint.toString(),
          ...(sinkPlugin.declaration.config
            ? { pluginConfig: sinkPlugin.declaration.config }
            : {}),
          pluginId: sinkPlugin.manifest.id,
          sourceId,
          writeKey
        };
      }
    } catch {
      delivery = null;
    }
  }

  return {
    delivery,
    runtimeSampleRate: ANALYTICS_RUNTIME_SAMPLE_RATE,
    ...(attributionKey ? { attributionKey } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(sourceHostname ? { sourceHostname } : {})
  };
}

function getAttributionHmacKey(writeKey: string): Promise<ArrayBuffer> {
  if (attributionKeyCache?.writeKey === writeKey) {
    return attributionKeyCache.key;
  }

  const key = deriveAttributionHmacKey(writeKey);
  attributionKeyCache = { writeKey, key };
  void key.catch(() => {
    if (attributionKeyCache?.key === key) {
      attributionKeyCache = undefined;
    }
  });
  return key;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
}
