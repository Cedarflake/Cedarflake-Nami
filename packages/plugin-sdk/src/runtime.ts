import {
  validatePluginManifest,
  type RuntimePlatformPlugin,
} from "@i0c/plugin-api"
import {
  type RuntimeAnalyticsSinkInstallation,
  type RuntimeDataSourceInstallation,
  type RuntimeFeatureInstallation,
} from "@i0c/runtime-host/installations"

export {
  defineRuntimeInstallationConfig,
  defineRuntimePlatformInstallation,
} from "@i0c/runtime-build/config"
export {
  defineRuntimePluginInstallations,
  listDefaultRuntimePluginIds,
  listRuntimePluginManifests,
  type InstalledRuntimeAnalyticsSink,
  type RuntimeAnalyticsSinkContext,
  type RuntimeAnalyticsSinkEvent,
  type RuntimePluginInstallations,
} from "@i0c/runtime-host/installations"

export type RuntimeDataSourcePlugin = Pick<
  RuntimeDataSourceInstallation,
  "create" | "manifest"
>

export type RuntimeAnalyticsSinkPlugin = Pick<
  RuntimeAnalyticsSinkInstallation,
  "create" | "manifest"
>

export type RuntimeFeaturePlugin = Pick<
  RuntimeFeatureInstallation,
  "create" | "manifest"
>

export function defineRuntimeDataSourcePlugin<
  const TPlugin extends RuntimeDataSourcePlugin,
>(plugin: TPlugin): TPlugin {
  assertRuntimeManifest(plugin.manifest, "data-source")
  return plugin
}

export function defineRuntimeAnalyticsSinkPlugin<
  const TPlugin extends RuntimeAnalyticsSinkPlugin,
>(plugin: TPlugin): TPlugin {
  assertRuntimeManifest(plugin.manifest, "analytics-sink")
  return plugin
}

export function defineRuntimeFeaturePlugin<
  const TPlugin extends RuntimeFeaturePlugin,
>(plugin: TPlugin): TPlugin {
  assertRuntimeManifest(plugin.manifest, "feature")
  return plugin
}

export function defineRuntimePlatformPlugin<TDeployment>(
  plugin: RuntimePlatformPlugin<TDeployment>,
): RuntimePlatformPlugin<TDeployment> {
  assertRuntimeManifest(plugin.manifest, "runtime-platform")
  return plugin
}

function assertRuntimeManifest(
  manifest:
    | RuntimeDataSourcePlugin["manifest"]
    | RuntimeAnalyticsSinkPlugin["manifest"]
    | RuntimeFeaturePlugin["manifest"]
    | RuntimePlatformPlugin["manifest"],
  expectedKind:
    | "analytics-sink"
    | "data-source"
    | "feature"
    | "runtime-platform",
): void {
  const result = validatePluginManifest(manifest)
  if (!result.valid) {
    throw new TypeError(result.issues.join("\n"))
  }
  if (manifest.kind !== expectedKind || !manifest.hosts.includes("runtime")) {
    throw new TypeError(
      `Runtime ${expectedKind} plugin has an incompatible manifest`,
    )
  }
}
