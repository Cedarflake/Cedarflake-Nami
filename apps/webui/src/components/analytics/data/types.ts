import type { AnalyticsTrendComparison } from "@nami/analytics-domain/types"

export const analyticsRanges = [1, 7, 30, 90] as const

export type AnalyticsRange = (typeof analyticsRanges)[number]

export interface AnalyticsEntryDomainOption {
  value: string
}

export interface AnalyticsScopeViewModel {
  entryDomain: string
  availableEntryDomains: AnalyticsEntryDomainOption[]
}

export interface AnalyticsMetrics {
  estimatedNavigations: number
  estimatedEntryNavigations: number
  totalRequests: number
  entryRequests: number
  declaredBotRate: number
  suspectedAutomationRate: number
  errorCount: number
}

export interface AnalyticsTrendPoint {
  timestamp: string
  label?: string
  estimatedNavigations: number
  estimatedEntryNavigations: number
  totalRequests: number
  entryRequests: number
}

export interface AnalyticsRankedLink {
  analyticsId: string
  path: string
  kind?: string
  estimatedNavigations: number
  estimatedEntryNavigations: number
  totalRequests: number
  entryRequests: number
  trend: AnalyticsTrendComparison
}

export interface AnalyticsBreakdownItem {
  key: string
  label?: string
  value: number
  estimatedValue?: number
  share: number
  code?: string
}

export interface AnalyticsBreakdowns {
  entryDomains: AnalyticsBreakdownItem[]
  countries: AnalyticsBreakdownItem[]
  referrers: AnalyticsBreakdownItem[]
  devices: AnalyticsBreakdownItem[]
  providers: AnalyticsBreakdownItem[]
  campaigns: AnalyticsBreakdownItem[]
  upstreamLinks: AnalyticsBreakdownItem[]
  trafficClasses: AnalyticsBreakdownItem[]
  botCategories: AnalyticsBreakdownItem[]
  botConfidences: AnalyticsBreakdownItem[]
  classifierVersions: AnalyticsBreakdownItem[]
  resourceClasses: AnalyticsBreakdownItem[]
  matchKinds: AnalyticsBreakdownItem[]
  outcomes: AnalyticsBreakdownItem[]
  probes: AnalyticsBreakdownItem[]
}

export interface AnalyticsDataQuality {
  coverageStart?: string | null
  coverageEnd?: string | null
  lastEventAt?: string | null
  rawEventRetentionDays?: number | null
  unknownCountryRate?: number | null
  notes?: string[]
}

export interface AnalyticsOverviewViewModel {
  scope: AnalyticsScopeViewModel
  metrics: AnalyticsMetrics
  trend: AnalyticsTrendPoint[]
  links: AnalyticsRankedLink[]
  breakdowns: AnalyticsBreakdowns
  quality: AnalyticsDataQuality
  hasData: boolean
}

export interface AnalyticsLinkIdentity {
  analyticsId: string
  path: string
  kind?: string
}

export interface AnalyticsDetailViewModel {
  scope: AnalyticsScopeViewModel
  link: AnalyticsLinkIdentity
  metrics: AnalyticsMetrics
  trend: AnalyticsTrendPoint[]
  breakdowns: AnalyticsBreakdowns
  quality: AnalyticsDataQuality
  hasData: boolean
}

export interface AnalyticsObservedEstimate {
  observed: number
  estimated: number
}

export interface AnalyticsAutomationMetrics {
  requests: AnalyticsObservedEstimate
  declaredBots: AnalyticsObservedEstimate
  suspectedAutomation: AnalyticsObservedEstimate
  unmatched: AnalyticsObservedEstimate
  errors: AnalyticsObservedEstimate
}

export interface AnalyticsAutomationTrendPoint {
  timestamp: string
  declaredBots: AnalyticsObservedEstimate
  suspectedAutomation: AnalyticsObservedEstimate
  unmatched: AnalyticsObservedEstimate
}

export interface AnalyticsAutomationLink {
  analyticsId: string
  path: string
  kind?: string
  observedRequests: number
  estimatedRequests: number
}

export interface AnalyticsAutomationViewModel {
  scope: AnalyticsScopeViewModel
  metrics: AnalyticsAutomationMetrics
  trend: AnalyticsAutomationTrendPoint[]
  links: AnalyticsAutomationLink[]
  breakdowns: AnalyticsBreakdowns
  quality: AnalyticsDataQuality
  hasData: boolean
}
