export const analyticsRanges = ["1d", "7d", "30d", "90d"] as const

export type AnalyticsRange = (typeof analyticsRanges)[number];

export interface AnalyticsDateRange {
  key: AnalyticsRange;
  start: string;
  end: string;
  timeZone: string;
}

export interface AnalyticsQueryScope {
  range: AnalyticsRange;
  entryDomain: string;
  timeZone: string;
}

export interface AnalyticsEntryDomainOption {
  value: string;
}

export interface AnalyticsScope {
  entryDomain: string;
  availableEntryDomains: AnalyticsEntryDomainOption[];
}

export interface AnalyticsMetricTotals {
  requests: number;
  entryRequests: number;
  clicks: number;
  entryClicks: number;
  previews: number;
  bots: number;
  declaredBots: number;
  suspectedAutomation: number;
  errors: number;
  avgLatencyMs: number | null;
}

export interface AnalyticsSeriesPoint {
  timestamp: string;
  requests: number;
  entryRequests: number;
  clicks: number;
  entryClicks: number;
  previews: number;
  bots: number;
  declaredBots: number;
  suspectedAutomation: number;
  errors: number;
}

export interface AnalyticsDimensionPoint {
  key: string;
  label?: string;
  requests: number;
  clicks: number;
}

export interface AnalyticsAutomationDimensionPoint {
  key: string;
  label?: string;
  observedRequests: number;
  estimatedRequests: number;
}

export interface AnalyticsBotBreakdowns {
  trafficClasses: AnalyticsAutomationDimensionPoint[];
  categories: AnalyticsAutomationDimensionPoint[];
  confidences: AnalyticsAutomationDimensionPoint[];
  classifierVersions: AnalyticsAutomationDimensionPoint[];
  resourceClasses: AnalyticsAutomationDimensionPoint[];
  matchKinds: AnalyticsAutomationDimensionPoint[];
  outcomes: AnalyticsAutomationDimensionPoint[];
  probes: AnalyticsAutomationDimensionPoint[];
}

export interface AnalyticsLinkSummary {
  analyticsId: string;
  path: string;
  linkType: "redirect" | "proxy";
  requests: number;
  entryRequests: number;
  clicks: number;
  entryClicks: number;
  previews: number;
  bots: number;
  declaredBots: number;
  suspectedAutomation: number;
  errors: number;
  trend?: AnalyticsTrendComparison;
  trendPercent?: number | null;
}

export type AnalyticsTrendComparison =
  | { status: "unavailable" }
  | { status: "unchanged" }
  | { status: "started"; currentValue: number }
  | { status: "percentage"; percent: number };

export interface AnalyticsOverview {
  range: AnalyticsDateRange;
  scope: AnalyticsScope;
  totals: AnalyticsMetricTotals;
  series: AnalyticsSeriesPoint[];
  links: AnalyticsLinkSummary[];
  countries: AnalyticsDimensionPoint[];
  referrers: AnalyticsDimensionPoint[];
  devices: AnalyticsDimensionPoint[];
  providers: AnalyticsDimensionPoint[];
  campaigns: AnalyticsDimensionPoint[];
  upstreamLinks: AnalyticsDimensionPoint[];
  botBreakdowns: AnalyticsBotBreakdowns;
}

export interface AnalyticsLink {
  analyticsId: string;
  path: string;
  linkType: "redirect" | "proxy";
}

export interface AnalyticsDetail {
  range: AnalyticsDateRange;
  scope: AnalyticsScope;
  link: AnalyticsLink;
  totals: AnalyticsMetricTotals;
  series: AnalyticsSeriesPoint[];
  countries: AnalyticsDimensionPoint[];
  referrers: AnalyticsDimensionPoint[];
  devices: AnalyticsDimensionPoint[];
  providers: AnalyticsDimensionPoint[];
  campaigns: AnalyticsDimensionPoint[];
  upstreamLinks: AnalyticsDimensionPoint[];
  botBreakdowns: AnalyticsBotBreakdowns;
}

export interface AnalyticsAutomationTotals {
  observedRequests: number;
  estimatedRequests: number;
  observedDeclaredBots: number;
  estimatedDeclaredBots: number;
  observedSuspectedAutomation: number;
  estimatedSuspectedAutomation: number;
  observedUnmatched: number;
  estimatedUnmatched: number;
  observedErrors: number;
  estimatedErrors: number;
}

export interface AnalyticsAutomationSeriesPoint extends AnalyticsAutomationTotals {
  timestamp: string;
}

export interface AnalyticsAutomationLinkSummary {
  analyticsId: string;
  path: string;
  linkType: "redirect" | "proxy";
  observedRequests: number;
  estimatedRequests: number;
}

export interface AnalyticsAutomationOverview {
  range: AnalyticsDateRange;
  scope: AnalyticsScope;
  totals: AnalyticsAutomationTotals;
  series: AnalyticsAutomationSeriesPoint[];
  links: AnalyticsAutomationLinkSummary[];
  providers: AnalyticsAutomationDimensionPoint[];
  entryDomains: AnalyticsAutomationDimensionPoint[];
  botBreakdowns: AnalyticsBotBreakdowns;
}
