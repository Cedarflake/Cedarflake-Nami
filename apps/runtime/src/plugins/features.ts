/**
 * @file features.ts
 * @description
 * [EN] Builds the ordered Runtime feature pipeline from validated remote plugin declarations.
 * Keeps optional feature failures isolated from redirect execution.
 *
 * [CN] 根据已校验的远程插件声明构建有序 Runtime Feature 管线。
 * 将可选功能故障与重定向执行隔离。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import type { AnalyticsClassificationHookContext } from "@nami/analytics-domain/classification";
import type { DataConfig } from "@nami/config";
import { PluginError, RuntimeFeaturePipeline } from "@nami/plugin-api";
import type { RuntimeFeatureRegistration } from "@nami/plugin-api";

import type {
  RuntimeAnalyticsFeaturePipeline,
  RuntimeFeatureRegistrationInput
} from "@handlers/core/types";

import { runtimePluginLogger } from "./logger";
import {
  resolveRuntimePluginConfigurations,
  type RuntimePlatformSelection
} from "./registry";

export function createRuntimeFeaturePipeline(
  config: DataConfig,
  platform: RuntimePlatformSelection,
  additionalRegistrations: readonly RuntimeFeatureRegistrationInput[] = []
): RuntimeAnalyticsFeaturePipeline {
  const configuredPlugins = resolveRuntimePluginConfigurations(config, platform);
  const registrations: RuntimeFeatureRegistration<
    AnalyticsClassificationHookContext
  >[] = [...additionalRegistrations];
  for (const plugin of configuredPlugins) {
    if (plugin.manifest.kind !== "feature") {
      continue;
    }
    const installation = platform.pluginInstallations.features.find(
      (candidate) => candidate.manifest.id === plugin.manifest.id
    );
    if (!installation) {
      throw new PluginError(
        plugin.manifest.id,
        "PLUGIN_NOT_INSTALLED",
        "The configured Runtime feature has no installed factory"
      );
    }
    registrations.push(installation.create(plugin.declaration.config));
  }

  return new RuntimeFeaturePipeline(registrations, runtimePluginLogger);
}
