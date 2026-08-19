/**
 * @file registry.ts
 * @description
 * [EN] Runtime plugin catalog projection and remote declaration validation.
 * Combines host-injected platform manifests with platform-neutral official presets.
 *
 * [CN] Runtime 插件目录投影与远程声明校验。
 * 将宿主注入的平台 Manifest 与平台无关的官方预设组合并校验。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import type { DataConfig, PluginInstanceConfig } from "@nami/config";
import { installedPluginIds } from "@nami/plugin-catalog";
import { PluginError, StaticPluginRegistry } from "@nami/plugin-api";
import {
  listDefaultRuntimePluginIds,
  listRuntimePluginManifests,
  type RuntimePluginInstallations
} from "@nami/runtime-host/installations";
import type {
  ResolvedPluginConfiguration,
  RuntimePlatformManifest
} from "@nami/plugin-api";

export interface RuntimePlatformSelection {
  platformPluginId?: string;
  pluginInstallations: RuntimePluginInstallations;
  runtimePlatformManifests: readonly RuntimePlatformManifest[];
}

export function resolveRuntimePlugins(
  config: DataConfig,
  platform: RuntimePlatformSelection
) {
  return new Set(
    resolveRuntimePluginConfigurations(config, platform).map(
      (plugin) => plugin.manifest.id
    )
  );
}

export function resolveRuntimePluginConfigurations(
  config: DataConfig,
  platform: RuntimePlatformSelection
): readonly ResolvedPluginConfiguration[] {
  const registry = createRuntimePluginRegistry(platform);
  const declarations = selectRuntimeDeclarations(config.plugins, platform);
  const result = registry.resolve("runtime", declarations);
  if (result.status === "invalid") {
    throw new PluginError(
      "@nami/runtime-host",
      "PLUGIN_CONFIG_INVALID",
      result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
      { details: { platformPluginId: platform.platformPluginId } }
    );
  }

  const enabledIds = new Set(result.plugins.map((plugin) => plugin.manifest.id));
  const dataSourcePluginId = platform.pluginInstallations.dataSource.manifest.id;
  if (!enabledIds.has(dataSourcePluginId)) {
    throw new PluginError(
      dataSourcePluginId,
      "PLUGIN_NOT_INSTALLED",
      "The Runtime data-source plugin must be enabled"
    );
  }
  if (platform.platformPluginId && !enabledIds.has(platform.platformPluginId)) {
    throw new PluginError(
      platform.platformPluginId,
      "PLUGIN_NOT_INSTALLED",
      `The Runtime platform plugin ${platform.platformPluginId} must be enabled`
    );
  }
  return result.plugins;
}

export function isRuntimePluginEnabled(
  config: DataConfig,
  platform: RuntimePlatformSelection,
  pluginId: string
): boolean {
  return resolveRuntimePlugins(config, platform).has(pluginId);
}

function createRuntimePluginRegistry(
  platform: RuntimePlatformSelection
): StaticPluginRegistry {
  const runtimePluginManifests = listRuntimePluginManifests(
    platform.pluginInstallations
  );
  return new StaticPluginRegistry(
    [...runtimePluginManifests, ...platform.runtimePlatformManifests],
    {
      recognizedPluginIds: [
        ...installedPluginIds,
        ...runtimePluginManifests.map((manifest) => manifest.id),
        ...platform.runtimePlatformManifests.map((manifest) => manifest.id)
      ]
    }
  );
}

function selectRuntimeDeclarations(
  configured: Readonly<Record<string, PluginInstanceConfig>>,
  platform: RuntimePlatformSelection
): Record<string, PluginInstanceConfig> {
  const declarations = { ...configured };
  for (const manifest of platform.runtimePlatformManifests) {
    if (manifest.id !== platform.platformPluginId) {
      delete declarations[manifest.id];
    }
  }

  for (const pluginId of listDefaultRuntimePluginIds(platform.pluginInstallations)) {
    declarations[pluginId] ??= { enabled: true };
  }
  if (platform.platformPluginId) {
    declarations[platform.platformPluginId] ??= { enabled: true };
  }
  return declarations;
}
