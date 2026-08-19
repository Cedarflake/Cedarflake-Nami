import {
  assertBootstrapConfigCompatibility,
  bootstrapConfig,
  defaultDataConfig,
} from "@nami/config"
import { defineRuntimeInstallationConfig } from "@nami/runtime-build/config"
import {
  resolveHttpAnalyticsSinkConfig,
} from "@nami/plugin-analytics-sink-http/config"
import {
  createHttpAnalyticsSink,
} from "@nami/plugin-analytics-sink-http/runtime"
import {
  resolveBotClassifierConfig,
} from "@nami/plugin-feature-bot-classifier/config"
import {
  createBotClassifierFeature,
} from "@nami/plugin-feature-bot-classifier/runtime"
import {
  githubRawSourcePlugin,
} from "@nami/plugin-github-data/runtime"
import {
  resolveGitHubRawSourceBootstrapConfig,
} from "@nami/plugin-github-data/config"
import {
  resolveHttpSnapshotSourceBootstrapConfig,
} from "@nami/plugin-http-snapshot-source/config"
import {
  httpSnapshotSourcePlugin,
} from "@nami/plugin-http-snapshot-source/runtime"
import type { JsonObject } from "@nami/plugin-api"
import { cloudflareRuntimeInstallation } from "@nami/plugin-runtime-cloudflare/installation"
import { netlifyRuntimeInstallation } from "@nami/plugin-runtime-netlify/installation"
import { vercelRuntimeInstallation } from "@nami/plugin-runtime-vercel/installation"
import {
  defineRuntimePluginInstallations,
  type RuntimeAnalyticsSinkContext,
  type RuntimeAnalyticsSinkEvent,
} from "@nami/runtime-host/installations"

import { runtimePluginDescriptors } from "./nami.runtime.manifests"

const githubTarget = bootstrapConfig.data.github
const githubBaseUrl = `https://raw.githubusercontent.com/${githubTarget.owner}/${githubTarget.repository}/${githubTarget.branch}`
assertBootstrapConfigCompatibility(bootstrapConfig)
const dataSourceSelection = createRuntimeDataSourceSelection()

export const runtimePluginInstallations = defineRuntimePluginInstallations({
  bundlePackages: [
    "@nami/plugin-analytics-sink-http",
    "@nami/plugin-feature-bot-classifier",
    "@nami/plugin-github-data",
    "@nami/plugin-http-snapshot-source",
  ],
  dataSource: {
    ...runtimePluginDescriptors.dataSource,
    bootstrapConfig: dataSourceSelection.bootstrapConfig,
    endpoints: dataSourceSelection.endpoints,
    create: (config, services) => dataSourceSelection.provider === "http"
      ? httpSnapshotSourcePlugin.create(
          resolveHttpSnapshotSourceBootstrapConfig(config),
          services,
        )
      : githubRawSourcePlugin.create(
          resolveGitHubRawSourceBootstrapConfig(config),
          services,
        ),
  },
  analyticsSinks: [
    {
      ...runtimePluginDescriptors.analyticsSinks[0],
      create: (config) => createHttpAnalyticsSink<
        RuntimeAnalyticsSinkEvent,
        RuntimeAnalyticsSinkContext
      >(resolveHttpAnalyticsSinkConfig(config)),
    },
  ],
  features: [
    {
      ...runtimePluginDescriptors.features[0],
      create: (config) => createBotClassifierFeature(
        resolveBotClassifierConfig(config),
      ),
    },
  ],
})

export { runtimePluginManifests } from "./nami.runtime.manifests"

export const runtimeInstallationConfig = /* @__PURE__ */ defineRuntimeInstallationConfig({
  platforms: [
    cloudflareRuntimeInstallation,
    vercelRuntimeInstallation,
    netlifyRuntimeInstallation,
  ],
})

export { runtimePlatformManifests } from "./nami.runtime.manifests"

interface RuntimeDataSourceSelection {
  bootstrapConfig: JsonObject
  endpoints: {
    config: string
    rules: string
  }
  provider: "github" | "http"
}

function createRuntimeDataSourceSelection(): RuntimeDataSourceSelection {
  const source = bootstrapConfig.data.source
  if (source.provider === "http") {
    return {
      provider: "http",
      bootstrapConfig: {
        snapshotUrl: source.snapshotUrl,
        requestTimeoutMs: source.requestTimeoutMs,
        maximumFetchAttempts: source.maximumFetchAttempts,
        failureBackoffSeconds: source.failureBackoffSeconds,
      },
      endpoints: {
        config: source.snapshotUrl,
        rules: source.snapshotUrl,
      },
    }
  }

  const dataConfigUrl = `${githubBaseUrl}/${githubTarget.configPath}`
  const redirectsConfigUrl = `${githubBaseUrl}/${githubTarget.redirectsPath}`
  return {
    provider: "github",
    bootstrapConfig: {
      dataConfigUrl,
      redirectsConfigUrl,
      dataConfigCacheTtlSeconds:
        defaultDataConfig.runtime.configCacheTtlSeconds,
      redirectsCacheTtlSeconds:
        defaultDataConfig.runtime.redirectsCacheTtlSeconds,
      configFailureBackoffSeconds: 30,
      redirectsFailureBackoffSeconds: 10,
    },
    endpoints: {
      config: dataConfigUrl,
      rules: redirectsConfigUrl,
    },
  }
}
