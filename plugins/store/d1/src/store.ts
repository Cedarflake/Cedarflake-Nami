import { resolveQueryRange, type QueryRange } from "@i0c/analytics-domain/range"
import {
  resolveAnalyticsEntryDomainCutoff,
  type AnalyticsAggregateRebuildInput,
  type AnalyticsAggregateRebuildResult,
  type AnalyticsRetentionResult,
  type AnalyticsRetentionScope,
  type AnalyticsStoreDetailInput,
  type AnalyticsStoreQueryInput,
} from "@i0c/analytics-domain/store"
import type {
  AnalyticsAutomationOverview,
  AnalyticsDetail,
  AnalyticsEntryDomainOption,
  AnalyticsOverview,
  AnalyticsScope,
} from "@i0c/analytics-domain/types"
import type {
  AnalyticsStore,
  PluginSchemaMigrationProvider,
} from "@i0c/plugin-api"

import {
  createAutomationDelivery,
  createAutomationLinks,
  createAutomationSeries,
  createAutomationTotals,
  createBotBreakdowns,
  createLinkBotBreakdowns,
  createLinkSummaries,
  createTrafficDimensions,
  createTrafficSeries,
  createTrafficTotals,
  type D1AnalyticsEventRecord,
  type D1AnalyticsLinkRecord,
} from "./aggregation"
import type { D1AnalyticsStoreConfig } from "./config"
import type { D1Database, D1PreparedStatement, D1Result } from "./d1"
import { assertD1Result, d1All, d1Batch } from "./d1"
import { d1AnalyticsStoreManifest } from "./manifest"
import type { D1AnalyticsStoreTypes } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

interface QueryContext {
  range: QueryRange
  entryDomain: string
  scope: AnalyticsScope
}

export interface D1AnalyticsStoreServices {
  database: D1Database
  schemaMigrations?: PluginSchemaMigrationProvider
  clock?: () => Date
}

export type D1AnalyticsStore = AnalyticsStore<D1AnalyticsStoreTypes> & {
  readonly configured: true
}

export function createD1AnalyticsStore(
  config: D1AnalyticsStoreConfig,
  services: D1AnalyticsStoreServices,
): D1AnalyticsStore {
  const clock = services.clock ?? (() => new Date())

  return {
    configured: true,
    ...(services.schemaMigrations
      ? { schemaMigrations: services.schemaMigrations }
      : {}),
    ingest: (event) => ingestD1Event(services.database, event, clock),
    getOverview: (input) => queryOverview(services.database, input, clock),
    getAutomation: (input) => queryAutomation(services.database, input, clock),
    getEntryDomains: (input) =>
      getEntryDomains(services.database, input.sourceId, clock),
    getDetail: (input) => queryDetail(services.database, input, clock),
    rebuildAggregates: (input) => rebuildD1Aggregates(services.database, input, config),
    runRetention: (scope) => runD1Retention(services.database, scope, config, clock),
    async healthCheck() {
      try {
        const rows = await d1All<{ value: number }>(
          services.database.prepare("SELECT 1 AS value"),
        )
        return rows[0]?.value === 1
          ? { status: "healthy" }
          : { status: "unhealthy", message: "D1 health query returned no row" }
      } catch (error) {
        return {
          status: "unhealthy",
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

export const d1AnalyticsStorePlugin = {
  manifest: d1AnalyticsStoreManifest,
  create: createD1AnalyticsStore,
}

async function ingestD1Event(
  database: D1Database,
  event: D1AnalyticsStoreTypes["event"],
  clock: () => Date,
): Promise<D1AnalyticsStoreTypes["ingestResult"]> {
  const receivedAt = clock().toISOString()
  const statements: D1PreparedStatement[] = [database.prepare(`
    INSERT INTO analytics_source (source_id)
    VALUES (?)
    ON CONFLICT (source_id) DO UPDATE SET
      updated_at = ?
  `).bind(event.sourceId, receivedAt)]

  if (event.eventKind === "link") {
    statements.push(database.prepare(`
      INSERT INTO analytics_link (
        source_id,
        analytics_id,
        route_path,
        link_type,
        first_seen_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (source_id, analytics_id) DO UPDATE SET
        route_path = CASE
          WHEN excluded.last_seen_at >= analytics_link.last_seen_at
            THEN excluded.route_path
          ELSE analytics_link.route_path
        END,
        link_type = CASE
          WHEN excluded.last_seen_at >= analytics_link.last_seen_at
            THEN excluded.link_type
          ELSE analytics_link.link_type
        END,
        first_seen_at = MIN(analytics_link.first_seen_at, excluded.first_seen_at),
        last_seen_at = MAX(analytics_link.last_seen_at, excluded.last_seen_at)
    `).bind(
      event.sourceId,
      event.analyticsId,
      event.routePath,
      event.linkType,
      event.occurredAt,
      event.occurredAt,
    ))
  }

  const attribution = resolveD1Attribution(event)
  if (attribution) {
    statements.push(database.prepare(`
      INSERT INTO analytics_upstream_claim (
        source_id,
        upstream_event_id,
        downstream_event_id,
        upstream_analytics_id
      )
      SELECT ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM analytics_event WHERE event_id = ?
      )
      ON CONFLICT (source_id, upstream_event_id) DO NOTHING
    `).bind(
      event.sourceId,
      attribution.upstreamEventId,
      event.eventId,
      attribution.upstreamAnalyticsId,
      event.eventId,
    ))
  }

  const eventStatementIndex = statements.length
  statements.push(createD1EventInsertStatement(
    database,
    event,
    attribution,
    receivedAt,
  ))

  if (attribution) {
    statements.push(database.prepare(`
      UPDATE analytics_upstream_claim
      SET last_seen_at = ?
      WHERE source_id = ?
        AND upstream_event_id = ?
        AND downstream_event_id = ?
    `).bind(
      receivedAt,
      event.sourceId,
      attribution.upstreamEventId,
      event.eventId,
    ))
  }

  const results = await d1Batch(database, statements)
  const eventResult = results[eventStatementIndex]
  if (!eventResult) {
    throw new Error("D1 ingest batch returned no event result")
  }
  return { isDuplicate: readChanges(eventResult) === 0 }
}

interface D1Attribution {
  upstreamAnalyticsId: string
  upstreamEventId: string
}

function resolveD1Attribution(
  event: D1AnalyticsStoreTypes["event"],
): D1Attribution | null {
  if (
    event.eventKind !== "link"
    || !event.upstreamEventId
    || !event.upstreamAnalyticsId
    || !event.upstreamEntryDomain
    || !event.upstreamProvider
  ) {
    return null
  }

  return {
    upstreamAnalyticsId: event.upstreamAnalyticsId,
    upstreamEventId: event.upstreamEventId,
  }
}

function createD1EventInsertStatement(
  database: D1Database,
  event: D1AnalyticsStoreTypes["event"],
  attribution: D1Attribution | null,
  receivedAt: string,
): D1PreparedStatement {
  const isEntrySql = attribution
    ? `CASE WHEN EXISTS (
        SELECT 1
        FROM analytics_upstream_claim
        WHERE source_id = ?
          AND upstream_event_id = ?
          AND downstream_event_id = ?
      ) THEN 0 ELSE 1 END`
    : "?"
  const isEntryBindings: readonly unknown[] = attribution
    ? [event.sourceId, attribution.upstreamEventId, event.eventId]
    : [1]

  return database.prepare(`
    INSERT INTO analytics_event (
      event_id,
      schema_version,
      event_kind,
      source_id,
      analytics_id,
      occurred_at,
      received_at,
      route_path,
      link_type,
      entry_domain,
      provider,
      request_class,
      status_code,
      resource_class,
      match_kind,
      match_outcome,
      traffic_class,
      bot_category,
      bot_confidence,
      classifier_version,
      device_type,
      country_code,
      referrer_domain,
      campaign_id,
      upstream_event_id,
      upstream_analytics_id,
      is_entry,
      probe_category,
      sample_rate,
      latency_ms
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${isEntrySql}, ?, ?, ?
    )
    ON CONFLICT (event_id) DO NOTHING
  `).bind(
    event.eventId,
    event.schemaVersion,
    event.eventKind,
    event.sourceId,
    event.eventKind === "link" ? event.analyticsId : null,
    event.occurredAt,
    receivedAt,
    event.eventKind === "link" ? event.routePath : null,
    event.eventKind === "link" ? event.linkType : null,
    event.entryDomain,
    event.provider,
    event.eventKind === "link" ? event.legacyRequestClass : null,
    event.statusCode,
    event.resourceClass,
    event.matchKind,
    event.matchOutcome,
    event.trafficClass,
    event.botCategory,
    event.botConfidence,
    event.classifierVersion,
    event.deviceType,
    event.countryCode,
    event.eventKind === "link" ? event.referrerDomain : null,
    event.eventKind === "link" ? event.campaignId : null,
    event.eventKind === "link" ? event.upstreamEventId : null,
    event.eventKind === "link" ? event.upstreamAnalyticsId : null,
    ...isEntryBindings,
    event.probeCategory,
    event.sampleRate,
    event.latencyMs,
  )
}

async function queryOverview(
  database: D1Database,
  input: AnalyticsStoreQueryInput,
  clock: () => Date,
): Promise<AnalyticsOverview> {
  const context = await resolveQueryContext(database, input, clock)
  const [current, previous, links] = await Promise.all([
    getEvents(database, input.sourceId, context.range.start, context.range.end, {
      entryDomain: context.entryDomain,
      eventKind: "link",
    }),
    getEvents(database, input.sourceId, context.range.previousStart, context.range.previousEnd, {
      entryDomain: context.entryDomain,
      eventKind: "link",
    }),
    getLinks(database, input.sourceId),
  ])
  return {
    range: context.range.publicRange,
    scope: context.scope,
    totals: createTrafficTotals(current),
    series: createTrafficSeries(current, context.range),
    links: createLinkSummaries(links, current, previous, context.entryDomain === "all"),
    ...createTrafficDimensions(current, links),
    botBreakdowns: createLinkBotBreakdowns(current),
  }
}

async function queryDetail(
  database: D1Database,
  input: AnalyticsStoreDetailInput,
  clock: () => Date,
): Promise<AnalyticsDetail | null> {
  const links = await getLinks(database, input.sourceId)
  const link = links.find((candidate) => candidate.analyticsId === input.analyticsId)
  if (!link) {
    return null
  }
  const context = await resolveQueryContext(database, input, clock)
  const events = await getEvents(
    database,
    input.sourceId,
    context.range.start,
    context.range.end,
    {
      entryDomain: context.entryDomain,
      eventKind: "link",
      analyticsId: input.analyticsId,
    },
  )
  return {
    range: context.range.publicRange,
    scope: context.scope,
    link: {
      analyticsId: link.analyticsId,
      path: link.routePath,
      linkType: link.linkType,
    },
    totals: createTrafficTotals(events),
    series: createTrafficSeries(events, context.range),
    ...createTrafficDimensions(events, links),
    botBreakdowns: createLinkBotBreakdowns(events),
  }
}

async function queryAutomation(
  database: D1Database,
  input: AnalyticsStoreQueryInput,
  clock: () => Date,
): Promise<AnalyticsAutomationOverview> {
  const context = await resolveQueryContext(database, input, clock)
  const [events, links] = await Promise.all([
    getEvents(database, input.sourceId, context.range.start, context.range.end, {
      entryDomain: context.entryDomain,
    }),
    getLinks(database, input.sourceId),
  ])
  return {
    range: context.range.publicRange,
    scope: context.scope,
    totals: createAutomationTotals(events),
    series: createAutomationSeries(events, context.range),
    links: createAutomationLinks(links, events),
    ...createAutomationDelivery(events),
    botBreakdowns: createBotBreakdowns(events),
  }
}

async function resolveQueryContext(
  database: D1Database,
  input: AnalyticsStoreQueryInput,
  clock: () => Date,
): Promise<QueryContext> {
  const availableEntryDomains = await getEntryDomains(
    database,
    input.sourceId,
    clock,
  )
  const requested = input.query.entryDomain.trim().toLowerCase() || "all"
  const entryDomain = requested === "all"
    || availableEntryDomains.some((option) => option.value === requested)
    ? requested
    : "all"
  return {
    range: resolveQueryRange(input.query.range, clock(), input.query.timeZone),
    entryDomain,
    scope: { entryDomain, availableEntryDomains },
  }
}

async function getEntryDomains(
  database: D1Database,
  sourceId: string,
  clock: () => Date,
): Promise<AnalyticsEntryDomainOption[]> {
  const rows = await d1All<{ value: string }>(database.prepare(`
    SELECT DISTINCT entry_domain AS value
    FROM analytics_event
    WHERE source_id = ? AND occurred_at >= ?
    ORDER BY entry_domain ASC
  `).bind(sourceId, resolveAnalyticsEntryDomainCutoff(clock())))
  return rows
}

interface EventQueryOptions {
  entryDomain?: string
  eventKind?: "link" | "runtime"
  analyticsId?: string
}

async function getEvents(
  database: D1Database,
  sourceId: string,
  start: Date,
  end: Date,
  options: EventQueryOptions,
): Promise<D1AnalyticsEventRecord[]> {
  const clauses = [
    "source_id = ?",
    "occurred_at >= ?",
    "occurred_at < ?",
  ]
  const values: unknown[] = [sourceId, start.toISOString(), end.toISOString()]
  if (options.entryDomain && options.entryDomain !== "all") {
    clauses.push("entry_domain = ?")
    values.push(options.entryDomain)
  }
  if (options.eventKind) {
    clauses.push("event_kind = ?")
    values.push(options.eventKind)
  }
  if (options.analyticsId) {
    clauses.push("analytics_id = ?")
    values.push(options.analyticsId)
  }

  return d1All<D1AnalyticsEventRecord>(database.prepare(`
    SELECT
      event_id AS eventId,
      event_kind AS eventKind,
      source_id AS sourceId,
      analytics_id AS analyticsId,
      occurred_at AS occurredAt,
      route_path AS routePath,
      link_type AS linkType,
      entry_domain AS entryDomain,
      provider,
      request_class AS requestClass,
      status_code AS statusCode,
      resource_class AS resourceClass,
      match_kind AS matchKind,
      match_outcome AS matchOutcome,
      traffic_class AS trafficClass,
      bot_category AS botCategory,
      bot_confidence AS botConfidence,
      classifier_version AS classifierVersion,
      device_type AS deviceType,
      country_code AS countryCode,
      referrer_domain AS referrerDomain,
      campaign_id AS campaignId,
      upstream_analytics_id AS upstreamAnalyticsId,
      is_entry AS isEntry,
      probe_category AS probeCategory,
      sample_rate AS sampleRate,
      latency_ms AS latencyMs
    FROM analytics_event
    WHERE ${clauses.join(" AND ")}
    ORDER BY occurred_at ASC, event_id ASC
  `).bind(...values))
}

async function getLinks(
  database: D1Database,
  sourceId: string,
): Promise<D1AnalyticsLinkRecord[]> {
  return d1All<D1AnalyticsLinkRecord>(database.prepare(`
    SELECT
      analytics_id AS analyticsId,
      route_path AS routePath,
      link_type AS linkType
    FROM analytics_link
    WHERE source_id = ?
    ORDER BY route_path ASC
  `).bind(sourceId))
}

async function rebuildD1Aggregates(
  database: D1Database,
  input: AnalyticsAggregateRebuildInput,
  config: D1AnalyticsStoreConfig,
): Promise<AnalyticsAggregateRebuildResult> {
  const sourceId = input.sourceId.trim()
  if (!sourceId) {
    throw new Error("Aggregate rebuild sourceId must not be empty")
  }
  const range = normalizeMaintenanceRange(input.start, input.end, config.retentionDays)
  const counts = await countEvents(database, sourceId, range.start, range.end)
  if (input.dryRun) {
    return {
      rebuilt: false,
      sourceId,
      ...range,
      ...counts,
      aggregateRowsDeleted: 0,
    }
  }

  const statements = [
    database.prepare(`
      DELETE FROM analytics_stats_hourly
      WHERE source_id = ? AND bucket_start >= ? AND bucket_start < ?
    `).bind(sourceId, range.start, range.end),
    database.prepare(`
      DELETE FROM analytics_stats_daily
      WHERE source_id = ? AND bucket_day >= ? AND bucket_day < ?
    `).bind(sourceId, range.start.slice(0, 10), range.end.slice(0, 10)),
    database.prepare(`
      INSERT INTO analytics_stats_hourly (
        bucket_start, source_id, entry_domain, analytics_id,
        observed_requests, estimated_requests,
        error_observed_requests, error_estimated_requests
      )
      SELECT
        SUBSTR(occurred_at, 1, 13) || ':00:00.000Z',
        source_id,
        entry_domain,
        COALESCE(analytics_id, ''),
        COUNT(*),
        SUM(1.0 / sample_rate),
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END),
        SUM(CASE WHEN status_code >= 400 THEN 1.0 / sample_rate ELSE 0 END)
      FROM analytics_event
      WHERE source_id = ? AND occurred_at >= ? AND occurred_at < ?
      GROUP BY 1, 2, 3, 4
    `).bind(sourceId, range.start, range.end),
    database.prepare(`
      INSERT INTO analytics_stats_daily (
        bucket_day, source_id, entry_domain, analytics_id,
        observed_requests, estimated_requests,
        error_observed_requests, error_estimated_requests
      )
      SELECT
        SUBSTR(occurred_at, 1, 10),
        source_id,
        entry_domain,
        COALESCE(analytics_id, ''),
        COUNT(*),
        SUM(1.0 / sample_rate),
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END),
        SUM(CASE WHEN status_code >= 400 THEN 1.0 / sample_rate ELSE 0 END)
      FROM analytics_event
      WHERE source_id = ? AND occurred_at >= ? AND occurred_at < ?
      GROUP BY 1, 2, 3, 4
    `).bind(sourceId, range.start, range.end),
  ]
  const results = await database.batch(statements)
  results.forEach(assertD1Result)

  return {
    rebuilt: true,
    sourceId,
    ...range,
    ...counts,
    aggregateRowsDeleted: readChanges(results[0]) + readChanges(results[1]),
  }
}

async function runD1Retention(
  database: D1Database,
  scope: AnalyticsRetentionScope,
  config: D1AnalyticsStoreConfig,
  clock: () => Date,
): Promise<AnalyticsRetentionResult> {
  const sourceId = scope.sourceId?.trim()
  if (scope.sourceId !== undefined && !sourceId) {
    throw new Error("Analytics retention sourceId must not be empty")
  }
  const cutoffAt = new Date(clock().getTime() - config.retentionDays * DAY_MS)
    .toISOString()
  const sourceClause = sourceId ? " AND source_id = ?" : ""
  const values = sourceId ? [cutoffAt, sourceId] : [cutoffAt]
  const deleteResults = await d1Batch(database, [
    database.prepare(`
      DELETE FROM analytics_event
      WHERE event_kind = 'link' AND received_at < ?${sourceClause}
    `).bind(...values),
    database.prepare(`
      DELETE FROM analytics_event
      WHERE event_kind = 'runtime' AND received_at < ?${sourceClause}
    `).bind(...values),
    database.prepare(`
      DELETE FROM analytics_upstream_claim
      WHERE last_seen_at < ?${sourceClause}
    `).bind(...values),
  ])

  return {
    retentionDays: config.retentionDays,
    cutoffAt,
    deleted: {
      accessEvents: readChanges(deleteResults[0]),
      runtimeEvents: readChanges(deleteResults[1]),
      eventReceipts: 0,
      upstreamClaims: readChanges(deleteResults[2]),
    },
  }
}

async function countEvents(
  database: D1Database,
  sourceId: string,
  start: string,
  end: string,
): Promise<Pick<
  AnalyticsAggregateRebuildResult,
  "accessEventsReplayed" | "runtimeEventsReplayed"
>> {
  const rows = await d1All<{ eventKind: "link" | "runtime"; count: number }>(
    database.prepare(`
      SELECT event_kind AS eventKind, COUNT(*) AS count
      FROM analytics_event
      WHERE source_id = ? AND occurred_at >= ? AND occurred_at < ?
      GROUP BY event_kind
    `).bind(sourceId, start, end),
  )
  return {
    accessEventsReplayed: rows.find((row) => row.eventKind === "link")?.count ?? 0,
    runtimeEventsReplayed: rows.find((row) => row.eventKind === "runtime")?.count ?? 0,
  }
}

function normalizeMaintenanceRange(
  start: string,
  end: string,
  maximumDays: number,
): { start: string; end: string } {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw new Error("Aggregate rebuild timestamps must be valid")
  }
  const startMs = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  )
  const endFloorMs = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  )
  const endMs = endDate.getTime() === endFloorMs ? endFloorMs : endFloorMs + DAY_MS
  if (startMs >= endMs) {
    throw new Error("Aggregate rebuild start must be earlier than end")
  }
  if ((endMs - startMs) / DAY_MS > maximumDays) {
    throw new Error(`Aggregate rebuild range must not exceed ${maximumDays} days`)
  }
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}

function readChanges(result: D1Result | undefined): number {
  return result?.meta?.changes ?? 0
}
