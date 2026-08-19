import { bootstrapConfig } from "@nami/config"
import { d1AnalyticsStoreManifest } from "@nami/plugin-analytics-store-d1/manifest"
import { postgresAnalyticsStoreManifest } from "@nami/plugin-analytics-store-postgres/manifest"
import { d1DataRepositoryManifest } from "@nami/plugin-data-repository-d1/manifest"
import { postgresDataRepositoryManifest } from "@nami/plugin-data-repository-postgres/manifest"
import { githubContentsRepositoryManifest } from "@nami/plugin-github-data/manifest"

function resolveDataRepositoryManifest() {
  switch (bootstrapConfig.data.repository.provider) {
    case "d1":
      return d1DataRepositoryManifest
    case "github":
      return githubContentsRepositoryManifest
    case "postgres":
      return postgresDataRepositoryManifest
  }
}

const dataRepositoryManifest = resolveDataRepositoryManifest()

export const webUiPluginDescriptors = {
  dataRepository: {
    enabledByDefault: true,
    manifest: dataRepositoryManifest,
  },
  analyticsStores: [
    {
      enabledByDefault: bootstrapConfig.webui.analyticsStore.provider === "postgres",
      manifest: postgresAnalyticsStoreManifest,
    },
    {
      enabledByDefault: bootstrapConfig.webui.analyticsStore.provider === "d1",
      manifest: d1AnalyticsStoreManifest,
    },
  ],
} as const

export const webUiPluginManifests = [
  webUiPluginDescriptors.dataRepository.manifest,
  ...webUiPluginDescriptors.analyticsStores.map(
    (installation) => installation.manifest,
  ),
] as const
