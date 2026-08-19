import { bootstrapConfig } from "@nami/config"
import { botClassifierManifest } from "@nami/plugin-feature-bot-classifier/manifest"
import { githubRawSourceManifest } from "@nami/plugin-github-data/manifest"
import { httpSnapshotSourceManifest } from "@nami/plugin-http-snapshot-source/manifest"
import { httpAnalyticsSinkManifest } from "@nami/plugin-analytics-sink-http/manifest"
import { cloudflareRuntimeManifest } from "@nami/plugin-runtime-cloudflare/manifest"
import { netlifyRuntimeManifest } from "@nami/plugin-runtime-netlify/manifest"
import { vercelRuntimeManifest } from "@nami/plugin-runtime-vercel/manifest"

export const runtimePluginDescriptors = {
  dataSource: {
    enabledByDefault: true,
    manifest: bootstrapConfig.data.source.provider === "http"
      ? httpSnapshotSourceManifest
      : githubRawSourceManifest,
  },
  analyticsSinks: [
    {
      enabledByDefault: true,
      manifest: httpAnalyticsSinkManifest,
    },
  ],
  features: [
    {
      enabledByDefault: true,
      manifest: botClassifierManifest,
    },
  ],
} as const

export const runtimePluginManifests = [
  runtimePluginDescriptors.dataSource.manifest,
  ...runtimePluginDescriptors.analyticsSinks.map(
    (installation) => installation.manifest,
  ),
  ...runtimePluginDescriptors.features.map(
    (installation) => installation.manifest,
  ),
] as const

export const runtimePlatformManifests = [
  cloudflareRuntimeManifest,
  vercelRuntimeManifest,
  netlifyRuntimeManifest,
] as const
