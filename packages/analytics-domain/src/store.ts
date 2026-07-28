import type { CanonicalAnalyticsEvent } from "./events"
import type {
  AnalyticsAutomationOverview,
  AnalyticsDetail,
  AnalyticsEntryDomainOption,
  AnalyticsOverview,
  AnalyticsQueryScope,
} from "./types"

export const ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS = 90
export const ANALYTICS_RAW_EVENT_RETENTION_DAYS = 181
export const ANALYTICS_DIMENSION_LIMIT = 10
export const ANALYTICS_LINK_SUMMARY_LIMIT = 500
export const ANALYTICS_AUTOMATION_LINK_LIMIT = 20

export function resolveAnalyticsEntryDomainCutoff(now: Date): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS + 1,
  )).toISOString()
}

export interface AnalyticsStoreQueryInput {
  sourceId: string
  query: AnalyticsQueryScope
}

export interface AnalyticsStoreDetailInput extends AnalyticsStoreQueryInput {
  analyticsId: string
}

export interface AnalyticsAggregateRebuildInput {
  sourceId: string
  start: string
  end: string
  dryRun?: boolean
}

export interface AnalyticsAggregateRebuildResult {
  rebuilt: boolean
  sourceId: string
  start: string
  end: string
  accessEventsReplayed: number
  runtimeEventsReplayed: number
  aggregateRowsDeleted: number
}

export interface AnalyticsRetentionScope {
  sourceId?: string
}

export interface AnalyticsRetentionResult {
  retentionDays: number
  cutoffAt: string
  deleted: {
    accessEvents: number
    runtimeEvents: number
    eventReceipts: number
    upstreamClaims: number
  }
}

export interface AnalyticsDomainStoreShape {
  event: CanonicalAnalyticsEvent
  ingestResult: { isDuplicate: boolean }
  scope: AnalyticsStoreQueryInput
  overview: AnalyticsOverview
  automation: AnalyticsAutomationOverview
  entryDomain: AnalyticsEntryDomainOption
  detailInput: AnalyticsStoreDetailInput
  detail: AnalyticsDetail | null
  rebuildInput: AnalyticsAggregateRebuildInput
  rebuildResult: AnalyticsAggregateRebuildResult
  retentionScope: AnalyticsRetentionScope
  retentionResult: AnalyticsRetentionResult
}
