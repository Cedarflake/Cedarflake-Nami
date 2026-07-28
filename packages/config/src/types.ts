export type RobotsPolicy = "allow" | "disallow"
export type WebUiAccessMode = "authenticated" | "allowlist" | "public-readonly"

export type JsonPrimitive = boolean | number | string | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type SlotBranch = Record<string, unknown>

export interface RedirectsConfig {
  Slots?: SlotBranch
  slots?: SlotBranch
  SLOT?: SlotBranch
  [key: string]: unknown
}

export interface DataSourceTarget {
  owner: string
  repository: string
  branch: string
  configPath: string
  redirectsPath: string
}

export interface GitHubDataRepositoryBootstrapConfig {
  provider: "github"
}

export interface PostgresDataRepositoryBootstrapConfig {
  provider: "postgres"
  databaseUrlBinding: string
  maxConnections: number
  idleTimeoutSeconds: number
  connectTimeoutSeconds: number
}

export interface D1DataRepositoryBootstrapConfig {
  provider: "d1"
}

export type DataRepositoryBootstrapConfig =
  | D1DataRepositoryBootstrapConfig
  | GitHubDataRepositoryBootstrapConfig
  | PostgresDataRepositoryBootstrapConfig

export interface GitHubRuntimeDataSourceBootstrapConfig {
  provider: "github"
}

export interface HttpRuntimeDataSourceBootstrapConfig {
  provider: "http"
  snapshotUrl: `https://${string}`
  requestTimeoutMs: number
  maximumFetchAttempts: number
  failureBackoffSeconds: number
}

export type RuntimeDataSourceBootstrapConfig =
  | GitHubRuntimeDataSourceBootstrapConfig
  | HttpRuntimeDataSourceBootstrapConfig

export interface BootstrapConfig {
  data: {
    github: DataSourceTarget
    repository: DataRepositoryBootstrapConfig
    source: RuntimeDataSourceBootstrapConfig
  }
  webui: {
    githubOAuthScope: string
  }
}

export interface PluginInstanceConfig {
  enabled: boolean
  version?: number
  config?: JsonObject
  secrets?: Record<string, string>
}

export interface DataConfig {
  $schema?: string
  schemaVersion: 1
  runtime: {
    canonicalOrigin: `https://${string}`
    robotsPolicy: RobotsPolicy
    configCacheTtlSeconds: number
    redirectsCacheTtlSeconds: number
  }
  analytics: {
    ingestEndpoint: `https://${string}`
    sourceId: string
  }
  webui: {
    access: {
      mode: WebUiAccessMode
      managerGitHubUserIds: readonly string[]
      blockedGitHubUserIds?: readonly string[]
    }
  }
  plugins: Record<string, PluginInstanceConfig>
}
