import { ANALYTICS_RAW_EVENT_RETENTION_DAYS } from "@nami/analytics-domain/store"
import type { JsonObject } from "@nami/plugin-api"

export interface PostgresAnalyticsStoreConfig {
  maxConnections: number
  idleTimeoutSeconds: number
  developmentIdleTimeoutSeconds: number
  connectTimeoutSeconds: number
  retentionDays: number
}

export const defaultPostgresAnalyticsStoreConfig = {
  maxConnections: 3,
  idleTimeoutSeconds: 20,
  developmentIdleTimeoutSeconds: 0,
  connectTimeoutSeconds: 30,
  retentionDays: ANALYTICS_RAW_EVENT_RETENTION_DAYS,
} as const satisfies PostgresAnalyticsStoreConfig

export const postgresAnalyticsStoreConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "maxConnections",
    "idleTimeoutSeconds",
    "developmentIdleTimeoutSeconds",
    "connectTimeoutSeconds",
    "retentionDays",
  ],
  properties: {
    maxConnections: { type: "integer", minimum: 1, maximum: 20 },
    idleTimeoutSeconds: { type: "integer", minimum: 0, maximum: 300 },
    developmentIdleTimeoutSeconds: { type: "integer", minimum: 0, maximum: 300 },
    connectTimeoutSeconds: { type: "integer", minimum: 1, maximum: 120 },
    retentionDays: { const: ANALYTICS_RAW_EVENT_RETENTION_DAYS },
  },
} satisfies JsonObject

export function resolvePostgresAnalyticsStoreConfig(
  value: JsonObject | undefined,
): PostgresAnalyticsStoreConfig {
  return {
    maxConnections: readInteger(value, "maxConnections"),
    idleTimeoutSeconds: readInteger(value, "idleTimeoutSeconds"),
    developmentIdleTimeoutSeconds: readInteger(
      value,
      "developmentIdleTimeoutSeconds",
    ),
    connectTimeoutSeconds: readInteger(value, "connectTimeoutSeconds"),
    retentionDays: readInteger(value, "retentionDays"),
  }
}

function readInteger(
  value: JsonObject | undefined,
  key: keyof PostgresAnalyticsStoreConfig,
): number {
  const candidate = value?.[key]
  return typeof candidate === "number" && Number.isSafeInteger(candidate)
    ? candidate
    : defaultPostgresAnalyticsStoreConfig[key]
}
