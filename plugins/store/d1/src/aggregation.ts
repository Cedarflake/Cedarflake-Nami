import {
  createSeriesBucketDates,
  resolveSeriesBucketStart,
  type QueryRange,
} from "@i0c/analytics-domain/range"
import { createTrendComparison } from "@i0c/analytics-domain/trend"
import type {
  AnalyticsAutomationDimensionPoint,
  AnalyticsAutomationLinkSummary,
  AnalyticsAutomationSeriesPoint,
  AnalyticsAutomationTotals,
  AnalyticsBotBreakdowns,
  AnalyticsDimensionPoint,
  AnalyticsLinkSummary,
  AnalyticsMetricTotals,
  AnalyticsSeriesPoint,
} from "@i0c/analytics-domain/types"

export interface D1AnalyticsEventRecord {
  eventId: string
  eventKind: "link" | "runtime"
  sourceId: string
  analyticsId: string | null
  occurredAt: string
  routePath: string | null
  linkType: "redirect" | "proxy" | null
  entryDomain: string
  provider: string
  requestClass: string | null
  statusCode: number
  resourceClass: string
  matchKind: string
  matchOutcome: string
  trafficClass: string
  botCategory: string
  botConfidence: string
  classifierVersion: number
  deviceType: string
  countryCode: string | null
  referrerDomain: string | null
  campaignId: string | null
  upstreamAnalyticsId: string | null
  isEntry: number
  probeCategory: string
  sampleRate: number
  latencyMs: number
}

export interface D1AnalyticsLinkRecord {
  analyticsId: string
  routePath: string
  linkType: "redirect" | "proxy"
}

type DimensionKey = keyof AnalyticsBotBreakdowns

const botDimensionFields: Readonly<Record<DimensionKey, keyof D1AnalyticsEventRecord>> = {
  trafficClasses: "trafficClass",
  categories: "botCategory",
  confidences: "botConfidence",
  classifierVersions: "classifierVersion",
  resourceClasses: "resourceClass",
  matchKinds: "matchKind",
  outcomes: "matchOutcome",
  probes: "probeCategory",
}

export function createTrafficTotals(
  events: readonly D1AnalyticsEventRecord[],
): AnalyticsMetricTotals {
  let latencyMs = 0
  const totals = emptyTrafficTotals()
  for (const event of events) {
    totals.requests += 1
    totals.entryRequests += event.isEntry
    totals.clicks += isHuman(event) ? 1 : 0
    totals.entryClicks += event.isEntry && isHuman(event) ? 1 : 0
    totals.previews += isPreview(event) ? 1 : 0
    totals.declaredBots += isDeclaredBot(event) ? 1 : 0
    totals.suspectedAutomation += isSuspectedAutomation(event) ? 1 : 0
    totals.errors += event.statusCode >= 400 ? 1 : 0
    latencyMs += event.latencyMs
  }
  totals.bots = totals.declaredBots + totals.suspectedAutomation
  totals.avgLatencyMs = totals.requests > 0 ? latencyMs / totals.requests : null
  return totals
}

export function createTrafficSeries(
  events: readonly D1AnalyticsEventRecord[],
  range: QueryRange,
): AnalyticsSeriesPoint[] {
  const points = createSeriesMap(range, () => ({
    requests: 0,
    entryRequests: 0,
    clicks: 0,
    entryClicks: 0,
    previews: 0,
    bots: 0,
    declaredBots: 0,
    suspectedAutomation: 0,
    errors: 0,
  }))

  for (const event of events) {
    const point = points.get(resolveBucketTimestamp(event.occurredAt, range))
    if (!point) {
      continue
    }
    point.requests += 1
    point.entryRequests += event.isEntry
    point.clicks += isHuman(event) ? 1 : 0
    point.entryClicks += event.isEntry && isHuman(event) ? 1 : 0
    point.previews += isPreview(event) ? 1 : 0
    point.declaredBots += isDeclaredBot(event) ? 1 : 0
    point.suspectedAutomation += isSuspectedAutomation(event) ? 1 : 0
    point.bots = point.declaredBots + point.suspectedAutomation
    point.errors += event.statusCode >= 400 ? 1 : 0
  }

  return [...points].map(([timestamp, point]) => ({ timestamp, ...point }))
}

export function createTrafficDimensions(
  events: readonly D1AnalyticsEventRecord[],
  links: readonly D1AnalyticsLinkRecord[],
): Pick<
  import("@i0c/analytics-domain/types").AnalyticsOverview,
  "countries" | "referrers" | "devices" | "providers" | "campaigns" | "upstreamLinks"
> {
  const linkPaths = new Map(links.map((link) => [link.analyticsId, link.routePath]))
  return {
    countries: createTrafficDimension(events, (event) => event.countryCode ?? "unknown"),
    referrers: createTrafficDimension(events, (event) => event.referrerDomain ?? "direct"),
    devices: createTrafficDimension(events, (event) => event.deviceType),
    providers: createTrafficDimension(events, (event) => event.provider),
    campaigns: createTrafficDimension(events, (event) => event.campaignId),
    upstreamLinks: createTrafficDimension(
      events,
      (event) => event.upstreamAnalyticsId,
      (key) => linkPaths.get(key),
    ),
  }
}

export function createBotBreakdowns(
  events: readonly D1AnalyticsEventRecord[],
): AnalyticsBotBreakdowns {
  const result = emptyBotBreakdowns()
  for (const [dimension, field] of Object.entries(botDimensionFields) as [
    DimensionKey,
    keyof D1AnalyticsEventRecord,
  ][]) {
    result[dimension] = createAutomationDimension(events, (event) =>
      String(event[field]),
    )
  }
  return result
}

export function createLinkSummaries(
  links: readonly D1AnalyticsLinkRecord[],
  currentEvents: readonly D1AnalyticsEventRecord[],
  previousEvents: readonly D1AnalyticsEventRecord[],
  includeEmpty: boolean,
): AnalyticsLinkSummary[] {
  const current = groupEventsByAnalyticsId(currentEvents)
  const previous = groupEventsByAnalyticsId(previousEvents)

  return links
    .filter((link) => includeEmpty || current.has(link.analyticsId))
    .map((link) => {
      const events = current.get(link.analyticsId) ?? []
      const previousEvents = previous.get(link.analyticsId) ?? []
      const previousEntryClicks = previousEvents
        .filter((event) => event.isEntry && isHuman(event)).length
      const totals = createTrafficTotals(events)
      return {
        analyticsId: link.analyticsId,
        path: link.routePath,
        linkType: link.linkType,
        ...withoutAverageLatency(totals),
        trend: createTrendComparison(
          totals.entryClicks,
          previousEntryClicks,
          previousEvents.length > 0,
        ),
      }
    })
    .sort((left, right) =>
      right.entryClicks - left.entryClicks
      || right.requests - left.requests
      || left.path.localeCompare(right.path),
    )
    .slice(0, 500)
}

export function createAutomationTotals(
  events: readonly D1AnalyticsEventRecord[],
): AnalyticsAutomationTotals {
  const totals = emptyAutomationTotals()
  for (const event of events) {
    const weight = estimatedWeight(event)
    totals.observedRequests += 1
    totals.estimatedRequests += weight
    if (isDeclaredBot(event)) {
      totals.observedDeclaredBots += 1
      totals.estimatedDeclaredBots += weight
    }
    if (isSuspectedAutomation(event)) {
      totals.observedSuspectedAutomation += 1
      totals.estimatedSuspectedAutomation += weight
    }
    if (event.matchKind === "unmatched") {
      totals.observedUnmatched += 1
      totals.estimatedUnmatched += weight
    }
    if (event.statusCode >= 400) {
      totals.observedErrors += 1
      totals.estimatedErrors += weight
    }
  }
  return totals
}

export function createAutomationSeries(
  events: readonly D1AnalyticsEventRecord[],
  range: QueryRange,
): AnalyticsAutomationSeriesPoint[] {
  const points = createSeriesMap(range, emptyAutomationTotals)
  for (const event of events) {
    const point = points.get(resolveBucketTimestamp(event.occurredAt, range))
    if (!point) {
      continue
    }
    addAutomationTotals(point, event)
  }
  return [...points].map(([timestamp, point]) => ({ timestamp, ...point }))
}

export function createAutomationLinks(
  links: readonly D1AnalyticsLinkRecord[],
  events: readonly D1AnalyticsEventRecord[],
): AnalyticsAutomationLinkSummary[] {
  const linkById = new Map(links.map((link) => [link.analyticsId, link]))
  return [...groupEventsByAnalyticsId(events.filter((event) =>
    isDeclaredBot(event) || isSuspectedAutomation(event),
  ))]
    .flatMap(([analyticsId, grouped]) => {
      const link = linkById.get(analyticsId)
      if (!link) {
        return []
      }
      return [{
        analyticsId,
        path: link.routePath,
        linkType: link.linkType,
        observedRequests: grouped.length,
        estimatedRequests: grouped.reduce(
          (total, event) => total + estimatedWeight(event),
          0,
        ),
      }]
    })
    .sort((left, right) =>
      right.observedRequests - left.observedRequests
      || left.path.localeCompare(right.path),
    )
    .slice(0, 20)
}

export function createAutomationDelivery(
  events: readonly D1AnalyticsEventRecord[],
): {
  providers: AnalyticsAutomationDimensionPoint[]
  entryDomains: AnalyticsAutomationDimensionPoint[]
} {
  return {
    providers: createAutomationDimension(events, (event) => event.provider),
    entryDomains: createAutomationDimension(events, (event) => event.entryDomain),
  }
}

function createTrafficDimension(
  events: readonly D1AnalyticsEventRecord[],
  selectKey: (event: D1AnalyticsEventRecord) => string | null,
  selectLabel?: (key: string) => string | undefined,
): AnalyticsDimensionPoint[] {
  const groups = new Map<string, { requests: number; clicks: number }>()
  for (const event of events) {
    const key = selectKey(event)
    if (key === null) {
      continue
    }
    const current = groups.get(key) ?? { requests: 0, clicks: 0 }
    current.requests += 1
    current.clicks += isHuman(event) ? 1 : 0
    groups.set(key, current)
  }
  return [...groups]
    .map(([key, totals]) => ({
      key,
      ...(selectLabel?.(key) ? { label: selectLabel(key) } : {}),
      ...totals,
    }))
    .sort((left, right) =>
      right.requests - left.requests || left.key.localeCompare(right.key),
    )
    .slice(0, 10)
}

function createAutomationDimension(
  events: readonly D1AnalyticsEventRecord[],
  selectKey: (event: D1AnalyticsEventRecord) => string,
): AnalyticsAutomationDimensionPoint[] {
  const groups = new Map<string, { observedRequests: number; estimatedRequests: number }>()
  for (const event of events) {
    const key = selectKey(event)
    const current = groups.get(key) ?? {
      observedRequests: 0,
      estimatedRequests: 0,
    }
    current.observedRequests += 1
    current.estimatedRequests += estimatedWeight(event)
    groups.set(key, current)
  }
  return [...groups]
    .map(([key, totals]) => ({ key, ...totals }))
    .sort((left, right) =>
      right.observedRequests - left.observedRequests
      || left.key.localeCompare(right.key),
    )
    .slice(0, 10)
}

function createSeriesMap<T>(
  range: QueryRange,
  createPoint: () => T,
): Map<string, T> {
  const points = new Map<string, T>()
  for (const date of createSeriesBucketDates(range)) {
    points.set(date.toISOString(), createPoint())
  }
  return points
}

function resolveBucketTimestamp(timestamp: string, range: QueryRange): string {
  return resolveSeriesBucketStart(new Date(timestamp), range).toISOString()
}

function addAutomationTotals(
  totals: AnalyticsAutomationTotals,
  event: D1AnalyticsEventRecord,
): void {
  const addition = createAutomationTotals([event])
  for (const key of Object.keys(totals) as (keyof AnalyticsAutomationTotals)[]) {
    totals[key] += addition[key]
  }
}

function groupEventsByAnalyticsId(
  events: readonly D1AnalyticsEventRecord[],
): Map<string, D1AnalyticsEventRecord[]> {
  const groups = new Map<string, D1AnalyticsEventRecord[]>()
  for (const event of events) {
    if (!event.analyticsId) {
      continue
    }
    const group = groups.get(event.analyticsId) ?? []
    group.push(event)
    groups.set(event.analyticsId, group)
  }
  return groups
}

function withoutAverageLatency(totals: AnalyticsMetricTotals): Omit<
  AnalyticsMetricTotals,
  "avgLatencyMs"
> {
  const { avgLatencyMs: _avgLatencyMs, ...rest } = totals
  return rest
}

function emptyTrafficTotals(): AnalyticsMetricTotals {
  return {
    requests: 0,
    entryRequests: 0,
    clicks: 0,
    entryClicks: 0,
    previews: 0,
    bots: 0,
    declaredBots: 0,
    suspectedAutomation: 0,
    errors: 0,
    avgLatencyMs: null,
  }
}

function emptyAutomationTotals(): AnalyticsAutomationTotals {
  return {
    observedRequests: 0,
    estimatedRequests: 0,
    observedDeclaredBots: 0,
    estimatedDeclaredBots: 0,
    observedSuspectedAutomation: 0,
    estimatedSuspectedAutomation: 0,
    observedUnmatched: 0,
    estimatedUnmatched: 0,
    observedErrors: 0,
    estimatedErrors: 0,
  }
}

function emptyBotBreakdowns(): AnalyticsBotBreakdowns {
  return {
    trafficClasses: [],
    categories: [],
    confidences: [],
    classifierVersions: [],
    resourceClasses: [],
    matchKinds: [],
    outcomes: [],
    probes: [],
  }
}

function isHuman(event: D1AnalyticsEventRecord): boolean {
  return event.trafficClass === "browser_like"
}

function isPreview(event: D1AnalyticsEventRecord): boolean {
  return event.requestClass === "link_preview"
}

function isDeclaredBot(event: D1AnalyticsEventRecord): boolean {
  return event.trafficClass === "declared_bot"
}

function isSuspectedAutomation(event: D1AnalyticsEventRecord): boolean {
  return event.trafficClass === "suspected_automation"
}

function estimatedWeight(event: D1AnalyticsEventRecord): number {
  return 1 / event.sampleRate
}
