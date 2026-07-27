import { d1AnalyticsStoreManifest } from "@i0c/plugin-analytics-store-d1/manifest"
import { postgresAnalyticsStoreManifest } from "@i0c/plugin-analytics-store-postgres/manifest"
import { postgresDataRepositoryManifest } from "@i0c/plugin-data-repository-postgres/manifest"
import { githubContentsRepositoryManifest } from "@i0c/plugin-github-data/manifest"
import { StaticPluginRegistry } from "@i0c/plugin-api"

import { installedPluginIds } from "./ids"

export const webUiPluginManifests = [
  githubContentsRepositoryManifest,
  postgresDataRepositoryManifest,
  postgresAnalyticsStoreManifest,
  d1AnalyticsStoreManifest,
] as const

export const webUiInstalledPluginRegistry = new StaticPluginRegistry(
  webUiPluginManifests,
  { recognizedPluginIds: installedPluginIds },
)
