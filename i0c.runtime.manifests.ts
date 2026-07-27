import { bootstrapConfig } from "@i0c/config"
import { botClassifierManifest } from "@i0c/plugin-feature-bot-classifier/manifest"
import { githubRawSourceManifest } from "@i0c/plugin-github-data/manifest"
import { httpSnapshotSourceManifest } from "@i0c/plugin-http-snapshot-source/manifest"
import { httpAnalyticsSinkManifest } from "@i0c/plugin-analytics-sink-http/manifest"
import { cloudflareRuntimeManifest } from "@i0c/plugin-runtime-cloudflare/manifest"
import { netlifyRuntimeManifest } from "@i0c/plugin-runtime-netlify/manifest"
import { vercelRuntimeManifest } from "@i0c/plugin-runtime-vercel/manifest"

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
