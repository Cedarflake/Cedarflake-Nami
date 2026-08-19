import type { BootstrapConfig, DataConfig } from "./types"

function resolveDataRepositoryPluginId(
  repository: BootstrapConfig["data"]["repository"],
): string {
  switch (repository.provider) {
    case "d1":
      return "@nami/data-repository-d1"
    case "github":
      return "@nami/github-contents-repository"
    case "postgres":
      return "@nami/data-repository-postgres"
  }
}

export const bootstrapConfig: BootstrapConfig = {
  data: {
    github: {
      owner: "Cedarflake",
      repository: "Cedarflake-Nami",
      branch: "data",
      configPath: "config.json",
      redirectsPath: "redirects.json",
    },
    repository: {
      provider: "postgres",
      databaseUrlBinding: "DATABASE_URL",
      maxConnections: 3,
      idleTimeoutSeconds: 20,
      connectTimeoutSeconds: 30,
    },
    source: {
      provider: "http",
      snapshotUrl: "https://u.i0c.cc/api/runtime/snapshot",
      requestTimeoutMs: 5_000,
      maximumFetchAttempts: 2,
      failureBackoffSeconds: 30,
    },
  },
  webui: {
    analyticsStore: {
      provider: "postgres",
    },
    d1: {
      accountId: "",
      apiTokenBinding: "CLOUDFLARE_D1_API_TOKEN",
      databaseIds: {
        analytics: "",
        dataRepository: "",
      },
      requestTimeoutMs: 10_000,
    },
    githubOAuthScope: "read:user user:email",
  },
}

export const defaultDataConfig: DataConfig = {
  $schema: "https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/config.schema.json",
  schemaVersion: 1,
  runtime: {
    canonicalOrigin: "https://i0c.cc",
    robotsPolicy: "allow",
    configCacheTtlSeconds: 600,
    redirectsCacheTtlSeconds: 60,
  },
  analytics: {
    ingestEndpoint: "https://u.i0c.cc/api/analytics/events",
    sourceId: "i0c.cc",
  },
  webui: {
    access: {
      mode: "public-readonly",
      managerGitHubUserIds: ["59095086", "186124801", "186082640"],
      blockedGitHubUserIds: [],
    },
  },
  plugins: {
    [bootstrapConfig.data.source.provider === "http"
      ? "@nami/http-snapshot-source"
      : "@nami/github-raw-source"]: {
      enabled: true,
      version: 1,
    },
    [resolveDataRepositoryPluginId(bootstrapConfig.data.repository)]: {
      enabled: true,
      version: 1,
    },
    "@nami/runtime-cloudflare": {
      enabled: true,
      version: 1,
    },
    "@nami/runtime-vercel": {
      enabled: true,
      version: 1,
    },
    "@nami/runtime-netlify": {
      enabled: true,
      version: 1,
    },
    "@nami/analytics-sink-http": {
      enabled: true,
      version: 1,
      config: {
        maximumDeliveryAttempts: 2,
        requestTimeoutMs: 5_000,
      },
      secrets: {
        writeKey: "NAMI_SECRET",
      },
    },
    "@nami/feature-bot-classifier": {
      enabled: true,
      version: 1,
      config: {
        hookTimeoutMs: 20,
      },
    },
    "@nami/analytics-store-postgres": {
      enabled: bootstrapConfig.webui.analyticsStore.provider === "postgres",
      version: 1,
      config: {
        maxConnections: 3,
        idleTimeoutSeconds: 20,
        developmentIdleTimeoutSeconds: 0,
        connectTimeoutSeconds: 30,
        retentionDays: 181,
      },
      secrets: {
        databaseUrl: "DATABASE_URL",
      },
    },
    "@nami/analytics-store-d1": {
      enabled: bootstrapConfig.webui.analyticsStore.provider === "d1",
      version: 1,
    },
  },
}
