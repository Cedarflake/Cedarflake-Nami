import { httpAnalyticsSinkManifest } from "@i0c/plugin-analytics-sink-http/manifest"
import { botClassifierManifest } from "@i0c/plugin-feature-bot-classifier/manifest"
import { githubRawSourceManifest } from "@i0c/plugin-github-data/manifest"
import { httpSnapshotSourceManifest } from "@i0c/plugin-http-snapshot-source/manifest"
import { cloudflareRuntimeManifest } from "@i0c/plugin-runtime-cloudflare/manifest"
import { netlifyRuntimeManifest } from "@i0c/plugin-runtime-netlify/manifest"
import { vercelRuntimeManifest } from "@i0c/plugin-runtime-vercel/manifest"
import { StaticPluginRegistry } from "@i0c/plugin-api"

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
