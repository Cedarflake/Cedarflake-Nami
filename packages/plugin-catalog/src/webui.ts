import { d1AnalyticsStoreManifest } from "@nami/plugin-analytics-store-d1/manifest"
import { postgresAnalyticsStoreManifest } from "@nami/plugin-analytics-store-postgres/manifest"
import { d1DataRepositoryManifest } from "@nami/plugin-data-repository-d1/manifest"
import { postgresDataRepositoryManifest } from "@nami/plugin-data-repository-postgres/manifest"
import { githubContentsRepositoryManifest } from "@nami/plugin-github-data/manifest"
import { StaticPluginRegistry } from "@nami/plugin-api"

import { installedPluginIds } from "./ids"

export const webUiPluginManifests = [
  githubContentsRepositoryManifest,
  d1DataRepositoryManifest,
  postgresDataRepositoryManifest,
  postgresAnalyticsStoreManifest,
  d1AnalyticsStoreManifest,
] as const

export const webUiInstalledPluginRegistry = new StaticPluginRegistry(
  webUiPluginManifests,
  { recognizedPluginIds: installedPluginIds },
)
