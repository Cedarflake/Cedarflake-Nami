import { httpAnalyticsSinkManifest } from "@nami/plugin-analytics-sink-http/manifest"
import { botClassifierManifest } from "@nami/plugin-feature-bot-classifier/manifest"
import { githubRawSourceManifest } from "@nami/plugin-github-data/manifest"
import { httpSnapshotSourceManifest } from "@nami/plugin-http-snapshot-source/manifest"
import { cloudflareRuntimeManifest } from "@nami/plugin-runtime-cloudflare/manifest"
import { netlifyRuntimeManifest } from "@nami/plugin-runtime-netlify/manifest"
import { vercelRuntimeManifest } from "@nami/plugin-runtime-vercel/manifest"
import { StaticPluginRegistry } from "@nami/plugin-api"

import { installedPluginIds } from "./ids"

export const runtimePluginManifests = [
  githubRawSourceManifest,
  httpSnapshotSourceManifest,
  cloudflareRuntimeManifest,
  vercelRuntimeManifest,
  netlifyRuntimeManifest,
  httpAnalyticsSinkManifest,
  botClassifierManifest,
] as const

export const runtimeInstalledPluginRegistry = new StaticPluginRegistry(
  runtimePluginManifests,
  { recognizedPluginIds: installedPluginIds },
)
