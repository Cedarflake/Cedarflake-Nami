import {
  assertBootstrapConfigCompatibility,
  bootstrapConfig,
} from "@i0c/config"
import type { D1Database } from "@i0c/plugin-data-repository-d1/d1"
import type { GitHubFetch } from "@i0c/plugin-github-data/webui"
import {
  defineWebUiPluginInstallations,
  type WebUiDataRepositoryCreateContext,
} from "@i0c/plugin-sdk/webui"

import { webUiPluginDescriptors } from "./i0c.webui.manifests"

const webuiFetch: GitHubFetch = (input, init) => fetch(input, init)

assertBootstrapConfigCompatibility(bootstrapConfig)

export const webUiPluginInstallations = defineWebUiPluginInstallations({
  dataRepository: {
    ...webUiPluginDescriptors.dataRepository,
    create: createConfiguredDataRepository,
  },
  analyticsStores: [
    {
      ...webUiPluginDescriptors.analyticsStores[0],
      create: async ({ declaration, development, readEnvironment }) => {
        const [
          { resolvePostgresAnalyticsStoreConfig },
          { createPostgresAnalyticsStore },
        ] = await Promise.all([
          import("@i0c/plugin-analytics-store-postgres/config"),
          import("@i0c/plugin-analytics-store-postgres/store"),
        ])
        const databaseUrlBinding = declaration.secrets?.databaseUrl
          ?? webUiPluginDescriptors.analyticsStores[0].manifest
            .secrets.databaseUrl.defaultBinding
          ?? "DATABASE_URL"
        return createPostgresAnalyticsStore(
          resolvePostgresAnalyticsStoreConfig(declaration.config),
          {
            connectionString: readEnvironment(databaseUrlBinding)?.trim() || null,
            development,
          },
        )
      },
    },
    {
      ...webUiPluginDescriptors.analyticsStores[1],
      create: async ({ bindings, declaration }) => {
        const database = bindings.get(
          webUiPluginDescriptors.analyticsStores[1].manifest.id,
        )
        if (!isD1Database(database)) {
          return null
        }
        const [
          { resolveD1AnalyticsStoreConfig },
          { createD1AnalyticsStore },
        ] = await Promise.all([
          import("@i0c/plugin-analytics-store-d1/config"),
          import("@i0c/plugin-analytics-store-d1/store"),
        ])
        return createD1AnalyticsStore(
          resolveD1AnalyticsStoreConfig(declaration.config),
          { database },
        )
      },
    },
  ],
})

async function createConfiguredDataRepository(
  context: WebUiDataRepositoryCreateContext,
) {
  const repository = bootstrapConfig.data.repository
  if (repository.provider === "postgres") {
    const { createPostgresDataRepository } = await import(
      "@i0c/plugin-data-repository-postgres/repository"
    )
    const connectionString = context
      .readEnvironment(repository.databaseUrlBinding)
      ?.trim() ?? ""
    return createPostgresDataRepository({
      connectionString,
      maxConnections: repository.maxConnections,
      idleTimeoutSeconds: repository.idleTimeoutSeconds,
      connectTimeoutSeconds: repository.connectTimeoutSeconds,
    })
  }
  if (repository.provider === "d1") {
    const database = context.bindings.get(
      webUiPluginDescriptors.dataRepository.manifest.id,
    )
    if (!isD1Database(database)) {
      throw new TypeError(
        "The D1 data repository requires a D1Database host binding",
      )
    }
    const { createD1DataRepository } = await import(
      "@i0c/plugin-data-repository-d1/repository"
    )
    return createD1DataRepository(database)
  }
  const { createGitHubContentsRepository } = await import(
    "@i0c/plugin-github-data/webui"
  )
  return createGitHubContentsRepository(
    {
      ...bootstrapConfig.data.github,
      publicRevalidateSeconds: 60,
    },
    { fetchImpl: webuiFetch },
  )
}

function isD1Database(value: unknown): value is D1Database {
  return typeof value === "object"
    && value !== null
    && "prepare" in value
    && typeof value.prepare === "function"
    && "batch" in value
    && typeof value.batch === "function"
}
