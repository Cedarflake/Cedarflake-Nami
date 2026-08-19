import {
  validateDataConfig,
  type DataConfigValidationResult,
} from "@nami/config";
import {
  validateInstalledPluginDeclarations,
  validateRuntimeRequiredPluginDeclarations,
  validateWebUiRequiredPluginDeclarations,
} from "@nami/plugin-catalog";
import {
  webUiPluginDescriptors,
  webUiPluginManifests,
} from "@nami/webui-manifests";

import {
  runtimePlatformManifests,
  runtimePluginManifests,
  runtimePluginDescriptors,
} from "../../../../../nami.runtime.manifests";

export const installedInstancePluginManifests = [
  ...runtimePluginManifests,
  ...webUiPluginManifests,
  ...runtimePlatformManifests,
];

export const requiredInstancePluginIds: ReadonlySet<string> = new Set([
  runtimePluginDescriptors.dataSource.manifest.id,
  webUiPluginDescriptors.dataRepository.manifest.id,
]);

export const compatibilityEnabledInstancePluginIds: ReadonlySet<string> = new Set([
  ...[
    runtimePluginDescriptors.dataSource,
    ...runtimePluginDescriptors.analyticsSinks,
    ...runtimePluginDescriptors.features,
    webUiPluginDescriptors.dataRepository,
    ...webUiPluginDescriptors.analyticsStores,
  ]
    .filter((descriptor) => descriptor.enabledByDefault)
    .map((descriptor) => descriptor.manifest.id),
  ...runtimePlatformManifests.map((manifest) => manifest.id),
]);

export function validateInstanceDataConfig(value: unknown): DataConfigValidationResult {
  const coreResult = validateDataConfig(value);
  if (coreResult.status === "invalid") {
    return coreResult;
  }

  const pluginIssues = validateInstalledPluginDeclarations(
    coreResult.config.plugins,
    installedInstancePluginManifests
  );
  const runtimeRequirementIssues = validateRuntimeRequiredPluginDeclarations(
    coreResult.config.plugins,
    {
      dataSourcePluginId: runtimePluginDescriptors.dataSource.manifest.id,
      runtimePlatformManifests: [],
    }
  );
  const webUiRequirementIssues = validateWebUiRequiredPluginDeclarations(
    coreResult.config.plugins,
    webUiPluginDescriptors.dataRepository.manifest.id,
  );
  const issues = [
    ...pluginIssues,
    ...runtimeRequirementIssues,
    ...webUiRequirementIssues,
  ];
  return issues.length > 0
    ? { status: "invalid", issues }
    : coreResult;
}
