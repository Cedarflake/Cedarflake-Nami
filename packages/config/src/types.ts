export type RobotsPolicy = "allow" | "disallow"
export type WebUiAccessMode = "authenticated" | "allowlist" | "public-readonly"
export type ProxyProfile = "isolated" | "asset" | "trusted-api"
export type ProxyCookieMode = "strip" | "allowlist"
export type ProxyCredentialMode = "strip" | "preserve"
export type ProxySourceHeaderMode = "strip" | "preserve" | "target"
export type ProxyResponseCookieAttributeMode = "remove" | "preserve"
export type ProxyResponseCookiePathMode = ProxyResponseCookieAttributeMode | "proxy-base"
export type ProxySecurityHeadersMode = "preserve"
export type ProxyCacheMode = "bypass" | "public"
export type ProxyRedirectMode = "manual" | "follow"

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

export interface ProxyCookiePolicy {
  mode: ProxyCookieMode
  names?: readonly string[]
}

export interface ProxyRequestPolicy {
  methods?: readonly string[]
  cookies?: ProxyCookiePolicy
  authorization?: ProxyCredentialMode
  origin?: ProxySourceHeaderMode
  referer?: ProxySourceHeaderMode
  clientIp?: "strip"
}

export interface ProxyResponseCookiePolicy extends ProxyCookiePolicy {
  domain?: ProxyResponseCookieAttributeMode
  path?: ProxyResponseCookiePathMode
}

export interface ProxyResponsePolicy {
  cookies?: ProxyResponseCookiePolicy
  securityHeaders?: ProxySecurityHeadersMode
}

export interface ProxyCachePolicy {
  mode: ProxyCacheMode
  edgeTtlSeconds?: number
  browserTtlSeconds?: number
}

export interface ProxyRedirectPolicy {
  mode: ProxyRedirectMode
  maxHops?: number
  allowedOrigins?: readonly string[]
}

export interface ProxyLimitPolicy {
  timeoutMs?: number
  maxRequestBodyBytes?: number
}

export interface ProxyPolicy {
  profile: ProxyProfile
  request?: ProxyRequestPolicy
  response?: ProxyResponsePolicy
  cache?: ProxyCachePolicy
  redirects?: ProxyRedirectPolicy
  limits?: ProxyLimitPolicy
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
