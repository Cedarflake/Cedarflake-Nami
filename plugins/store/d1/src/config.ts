import { ANALYTICS_RAW_EVENT_RETENTION_DAYS } from "@nami/analytics-domain/store"
import type { JsonObject } from "@nami/plugin-api"

export interface D1AnalyticsStoreConfig {
  retentionDays: number
}

export const defaultD1AnalyticsStoreConfig = {
  retentionDays: ANALYTICS_RAW_EVENT_RETENTION_DAYS,
} as const satisfies D1AnalyticsStoreConfig

export const d1AnalyticsStoreConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: ["retentionDays"],
  properties: {
    retentionDays: { const: ANALYTICS_RAW_EVENT_RETENTION_DAYS },
  },
} satisfies JsonObject

export function resolveD1AnalyticsStoreConfig(
  value: JsonObject | undefined,
): D1AnalyticsStoreConfig {
  return {
    retentionDays: value?.retentionDays === ANALYTICS_RAW_EVENT_RETENTION_DAYS
      ? ANALYTICS_RAW_EVENT_RETENTION_DAYS
      : defaultD1AnalyticsStoreConfig.retentionDays,
  }
}
