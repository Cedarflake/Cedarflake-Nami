/**
 * @file delivery.ts
 * @description
 * [EN] Analytics sink orchestration.
 * Selects the configured sink plugin and keeps best-effort delivery failures outside redirect flow.
 *
 * [CN] 统计 Sink 编排。
 * 选择配置的 Sink 插件，并将尽力而为的投递失败隔离在重定向流程之外。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { PluginError } from "@nami/plugin-api";

import type {
  ResolvedRuntime,
  RuntimeAnalyticsSink
} from "../core/types";
import type { AnalyticsEventV2 } from "./events";
import type { AnalyticsDeliveryConfig } from "./settings";
import { readRuntimeSecret } from "../configuration/env";

interface AnalyticsDispatchSettings {
  delivery: AnalyticsDeliveryConfig | null;
  sourceId: string;
}

const analyticsSinkCache = new Map<string, RuntimeAnalyticsSink>();

export function scheduleAnalyticsEvent(
  event: AnalyticsEventV2,
  runtime: ResolvedRuntime,
  settings: AnalyticsDispatchSettings,
  completedAt: number
): void {
  if (!runtime.analyticsSink && !settings.delivery) {
    return;
  }
  const sink = runtime.analyticsSink ?? getInstalledAnalyticsSink(
    runtime,
    settings.delivery
  );
  const task = sink.emit(event, {
    completedAt,
    dataConfig: runtime.dataConfig,
    endpoint: settings.delivery?.endpoint ?? runtime.dataConfig.analytics.ingestEndpoint,
    fetchImpl: runtime.fetchImpl,
    provider: runtime.provider,
    readSecret: (bindingName) => readRuntimeSecret(
      runtime.envBindings,
      bindingName,
      runtime.readEnvironment
    ),
    sourceId: settings.sourceId,
    ...(settings.delivery ? { writeKey: settings.delivery.writeKey } : {})
  }).catch((error: unknown) => {
    console.error(`[Analytics] Failed to emit ${event.eventKind} event`, error);
  });
  if (!runtime.waitUntil) {
    void task;
    return;
  }
  try {
    runtime.waitUntil(task);
  } catch (error) {
    console.error(`[Analytics] Failed to schedule ${event.eventKind} event`, error);
  }
}

function getInstalledAnalyticsSink(
  runtime: ResolvedRuntime,
  delivery: AnalyticsDeliveryConfig | null
): RuntimeAnalyticsSink {
  if (!delivery) {
    throw new PluginError(
      "@nami/runtime-host",
      "PLUGIN_NOT_INSTALLED",
      "The Runtime analytics sink is not configured"
    );
  }
  const installation = runtime.pluginInstallations.analyticsSinks.find(
    (candidate) => candidate.manifest.id === delivery.pluginId
  );
  if (!installation) {
    throw new PluginError(
      delivery.pluginId,
      "PLUGIN_NOT_INSTALLED",
      "The configured Runtime analytics sink has no installed factory"
    );
  }
  const cacheKey = `${delivery.pluginId}:${JSON.stringify(delivery.pluginConfig ?? null)}`;
  const existing = analyticsSinkCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const sink = installation.create(delivery.pluginConfig);
  analyticsSinkCache.set(cacheKey, sink);
  return sink;
}
