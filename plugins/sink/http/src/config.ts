import type { JsonObject } from "@nami/plugin-api"

export interface HttpAnalyticsSinkConfig {
  maximumDeliveryAttempts: number
  requestTimeoutMs: number
}

export const defaultHttpAnalyticsSinkConfig = {
  maximumDeliveryAttempts: 2,
  requestTimeoutMs: 5_000,
} as const satisfies HttpAnalyticsSinkConfig

export const httpAnalyticsSinkConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: ["maximumDeliveryAttempts"],
  properties: {
    maximumDeliveryAttempts: {
      type: "integer",
      minimum: 1,
      maximum: 5,
    },
    requestTimeoutMs: {
      type: "integer",
      minimum: 100,
      maximum: 5_000,
    },
  },
} satisfies JsonObject

export function resolveHttpAnalyticsSinkConfig(
  value: JsonObject | undefined,
): HttpAnalyticsSinkConfig {
  const maximumDeliveryAttempts = value?.maximumDeliveryAttempts
  const requestTimeoutMs = value?.requestTimeoutMs
  return {
    maximumDeliveryAttempts:
      typeof maximumDeliveryAttempts === "number"
      && Number.isSafeInteger(maximumDeliveryAttempts)
      && maximumDeliveryAttempts >= 1
      && maximumDeliveryAttempts <= 5
        ? maximumDeliveryAttempts
        : defaultHttpAnalyticsSinkConfig.maximumDeliveryAttempts,
    requestTimeoutMs:
      typeof requestTimeoutMs === "number"
      && Number.isSafeInteger(requestTimeoutMs)
      && requestTimeoutMs >= 100
      && requestTimeoutMs <= 5_000
        ? requestTimeoutMs
        : defaultHttpAnalyticsSinkConfig.requestTimeoutMs,
  }
}
