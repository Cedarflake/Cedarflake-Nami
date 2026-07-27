import type { DataSourceTarget } from "@i0c/config"
import type { JsonObject } from "@i0c/plugin-api"

export interface GitHubRawSourceBootstrapConfig {
  dataConfigUrl?: string
  redirectsConfigUrl: string
  dataConfigCacheTtlSeconds: number
  redirectsCacheTtlSeconds: number
  configFailureBackoffSeconds: number
  redirectsFailureBackoffSeconds: number
}

export interface GitHubContentsRepositoryBootstrapConfig extends DataSourceTarget {
  publicRevalidateSeconds: number
}

export const githubRawSourcePluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies JsonObject

export const githubContentsRepositoryPluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies JsonObject

export function resolveGitHubRawSourceBootstrapConfig(
  value: JsonObject,
): GitHubRawSourceBootstrapConfig {
  const dataConfigUrl = value.dataConfigUrl === undefined
    ? undefined
    : readHttpsUrl(value.dataConfigUrl, "dataConfigUrl")
  return {
    ...(dataConfigUrl ? { dataConfigUrl } : {}),
    redirectsConfigUrl: readHttpsUrl(
      value.redirectsConfigUrl,
      "redirectsConfigUrl",
    ),
    dataConfigCacheTtlSeconds: readPositiveInteger(
      value.dataConfigCacheTtlSeconds,
      "dataConfigCacheTtlSeconds",
    ),
    redirectsCacheTtlSeconds: readPositiveInteger(
      value.redirectsCacheTtlSeconds,
      "redirectsCacheTtlSeconds",
    ),
    configFailureBackoffSeconds: readPositiveInteger(
      value.configFailureBackoffSeconds,
      "configFailureBackoffSeconds",
    ),
    redirectsFailureBackoffSeconds: readPositiveInteger(
      value.redirectsFailureBackoffSeconds,
      "redirectsFailureBackoffSeconds",
    ),
  }
}

function readHttpsUrl(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be an HTTPS URL`)
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TypeError(`${name} must be an HTTPS URL`)
  }
  if (url.protocol !== "https:") {
    throw new TypeError(`${name} must be an HTTPS URL`)
  }
  return url.toString()
}

function readPositiveInteger(value: unknown, name: string): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value <= 0
  ) {
    throw new TypeError(`${name} must be a positive integer`)
  }
  return value
}
