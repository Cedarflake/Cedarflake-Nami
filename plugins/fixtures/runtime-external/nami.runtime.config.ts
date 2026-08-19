import {
  resolveHttpAnalyticsSinkConfig,
} from "@nami/plugin-analytics-sink-http/config"
import { httpAnalyticsSinkManifest } from "@nami/plugin-analytics-sink-http/manifest"
import { createHttpAnalyticsSink } from "@nami/plugin-analytics-sink-http/runtime"
import { resolveBotClassifierConfig } from "@nami/plugin-feature-bot-classifier/config"
import { botClassifierManifest } from "@nami/plugin-feature-bot-classifier/manifest"
import { createBotClassifierFeature } from "@nami/plugin-feature-bot-classifier/runtime"
import {
  resolveGitHubRawSourceBootstrapConfig,
} from "@nami/plugin-github-data/config"
import { githubRawSourcePlugin } from "@nami/plugin-github-data/runtime"
import {
  defineRuntimeInstallationConfig,
  type RuntimeAnalyticsSinkContext,
  type RuntimeAnalyticsSinkEvent,
  type RuntimePluginInstallations,
} from "@nami/plugin-sdk/runtime"

import { externalRuntimeFeaturePlugin } from "./src/feature"
import { externalRuntimeInstallation } from "./src/installation"

export const runtimePluginInstallations = {
  bundlePackages: [
    "@nami/plugin-analytics-sink-http",
    "@nami/plugin-feature-bot-classifier",
    "@nami/plugin-github-data",
    "@nami/runtime-fixture-external",
  ],
  dataSource: {
    bootstrapConfig: {
      dataConfigUrl:
        "https://raw.githubusercontent.com/Revaea/i0c.cc/data/config.json",
      redirectsConfigUrl:
        "https://raw.githubusercontent.com/Revaea/i0c.cc/data/redirects.json",
      dataConfigCacheTtlSeconds: 600,
      redirectsCacheTtlSeconds: 60,
      configFailureBackoffSeconds: 30,
      redirectsFailureBackoffSeconds: 10,
    },
    enabledByDefault: true,
    manifest: githubRawSourcePlugin.manifest,
    create: (config, services) => githubRawSourcePlugin.create(
      resolveGitHubRawSourceBootstrapConfig(config),
      services,
    ),
  },
  analyticsSinks: [
    {
      enabledByDefault: true,
      manifest: httpAnalyticsSinkManifest,
      create: (config) => createHttpAnalyticsSink<
        RuntimeAnalyticsSinkEvent,
        RuntimeAnalyticsSinkContext
      >(resolveHttpAnalyticsSinkConfig(config)),
    },
  ],
  features: [
    {
      enabledByDefault: true,
      manifest: botClassifierManifest,
      create: (config) => createBotClassifierFeature(
        resolveBotClassifierConfig(config),
      ),
    },
    {
      enabledByDefault: true,
      manifest: externalRuntimeFeaturePlugin.manifest,
      create: externalRuntimeFeaturePlugin.create,
    },
  ],
} satisfies RuntimePluginInstallations

export const runtimeInstallationConfig = defineRuntimeInstallationConfig({
  platforms: [externalRuntimeInstallation],
})
