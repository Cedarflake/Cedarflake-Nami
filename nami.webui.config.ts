import {
  assertBootstrapConfigCompatibility,
  bootstrapConfig,
} from "@nami/config"
import type { D1Database } from "@nami/database-d1"
import { createD1RestDatabase } from "@nami/database-d1/rest"
import type { GitHubFetch } from "@nami/plugin-github-data/webui"
import {
  defineWebUiPluginInstallations,
  type WebUiDataRepositoryCreateContext,
} from "@nami/plugin-sdk/webui"

import { webUiPluginDescriptors } from "./nami.webui.manifests"

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
          import("@nami/plugin-analytics-store-postgres/config"),
          import("@nami/plugin-analytics-store-postgres/store"),
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
      create: async ({
        bindings,
        declaration,
        readEnvironment,
      }) => {
        const database = resolveConfiguredD1Database(
          bindings,
          readEnvironment,
          webUiPluginDescriptors.analyticsStores[1].manifest.id,
          bootstrapConfig.webui.d1.databaseIds.analytics,
        )
        const [
          { resolveD1AnalyticsStoreConfig },
          { createD1AnalyticsStore },
        ] = await Promise.all([
          import("@nami/plugin-analytics-store-d1/config"),
          import("@nami/plugin-analytics-store-d1/store"),
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
      "@nami/plugin-data-repository-postgres/repository"
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
    const database = resolveConfiguredD1Database(
      context.bindings,
      context.readEnvironment,
      webUiPluginDescriptors.dataRepository.manifest.id,
      bootstrapConfig.webui.d1.databaseIds.dataRepository,
    )
    const { createD1DataRepository } = await import(
      "@nami/plugin-data-repository-d1/repository"
    )
    return createD1DataRepository(database)
  }
  const { createGitHubContentsRepository } = await import(
    "@nami/plugin-github-data/webui"
  )
  return createGitHubContentsRepository(
    {
      ...bootstrapConfig.data.github,
      publicRevalidateSeconds: 60,
    },
    { fetchImpl: webuiFetch },
  )
}

function resolveConfiguredD1Database(
  bindings: ReadonlyMap<string, unknown>,
  readEnvironment: (name: string) => string | undefined,
  pluginId: string,
  databaseId: string,
): D1Database {
  const binding = bindings.get(pluginId)
  if (isD1Database(binding)) {
    return binding
  }
  if (bindings.has(pluginId)) {
    throw new TypeError(
      `The ${pluginId} host binding must implement the D1Database contract`,
    )
  }

  const config = bootstrapConfig.webui.d1
  return createD1RestDatabase({
    accountId: config.accountId,
    apiToken: readEnvironment(config.apiTokenBinding) ?? "",
    databaseId,
    requestTimeoutMs: config.requestTimeoutMs,
  })
}

function isD1Database(value: unknown): value is D1Database {
  return typeof value === "object"
    && value !== null
    && "prepare" in value
    && typeof value.prepare === "function"
    && "batch" in value
    && typeof value.batch === "function"
    && "exec" in value
    && typeof value.exec === "function"
}
