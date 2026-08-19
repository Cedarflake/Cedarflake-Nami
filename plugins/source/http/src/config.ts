import type { JsonObject } from "@nami/plugin-api"

export interface HttpSnapshotSourceBootstrapConfig {
  snapshotUrl: string
  requestTimeoutMs: number
  maximumFetchAttempts: number
  failureBackoffSeconds: number
}

export const httpSnapshotSourcePluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies JsonObject

export function resolveHttpSnapshotSourceBootstrapConfig(
  value: JsonObject,
): HttpSnapshotSourceBootstrapConfig {
  const snapshotUrl = readHttpsUrl(value.snapshotUrl, "snapshotUrl")
  return {
    snapshotUrl,
    requestTimeoutMs: readIntegerInRange(
      value.requestTimeoutMs,
      "requestTimeoutMs",
      100,
      30_000,
    ),
    maximumFetchAttempts: readIntegerInRange(
      value.maximumFetchAttempts,
      "maximumFetchAttempts",
      1,
      3,
    ),
    failureBackoffSeconds: readIntegerInRange(
      value.failureBackoffSeconds,
      "failureBackoffSeconds",
      1,
      300,
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

function readIntegerInRange(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new TypeError(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    )
  }
  return value
}
