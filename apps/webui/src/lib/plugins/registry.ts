import type { DataConfig, PluginInstanceConfig } from "@nami/config";
import { installedPluginIds } from "@nami/plugin-catalog";
import { PluginError, StaticPluginRegistry } from "@nami/plugin-api";
import {
  webUiPluginDescriptors,
  webUiPluginManifests,
} from "@nami/webui-manifests";

const webUiInstalledPluginRegistry = new StaticPluginRegistry(
  webUiPluginManifests,
  {
    recognizedPluginIds: [
      ...installedPluginIds,
      ...webUiPluginManifests.map((manifest) => manifest.id)
    ]
  }
);

export function resolveWebUiPlugins(config: DataConfig) {
  const declarations = withWebUiCompatibilityDefaults(config.plugins);
  const result = webUiInstalledPluginRegistry.resolve("webui", declarations);
  if (result.status === "invalid") {
    throw new PluginError(
      "@nami/webui-host",
      "PLUGIN_CONFIG_INVALID",
      result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")
    );
  }
  const repositoryPluginId = webUiPluginDescriptors.dataRepository.manifest.id;
  if (!result.plugins.some((plugin) => plugin.manifest.id === repositoryPluginId)) {
    throw new PluginError(
      repositoryPluginId,
      "PLUGIN_NOT_INSTALLED",
      "The WebUI data-repository plugin must be enabled"
    );
  }
  return result.plugins;
}

function withWebUiCompatibilityDefaults(
  configured: Readonly<Record<string, PluginInstanceConfig>>
): Record<string, PluginInstanceConfig> {
  const declarations = { ...configured };
  const repository = webUiPluginDescriptors.dataRepository;
  if (repository.enabledByDefault) {
    declarations[repository.manifest.id] ??= { enabled: true };
  }
  const analyticsStores = webUiPluginDescriptors.analyticsStores;
  if (!analyticsStores.some((store) => store.manifest.id in declarations)) {
    for (const store of analyticsStores) {
      if (store.enabledByDefault) {
        declarations[store.manifest.id] = { enabled: true };
      }
    }
  }
  return declarations;
}
