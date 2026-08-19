import type { AnalyticsDomainStoreShape } from "@nami/analytics-domain/store"
import type { AnalyticsStoreTypes } from "@nami/plugin-api"

export type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "./d1"

export type D1AnalyticsStoreTypes = AnalyticsDomainStoreShape
  & AnalyticsStoreTypes
