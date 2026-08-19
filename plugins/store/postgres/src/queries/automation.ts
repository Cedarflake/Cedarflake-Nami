import type {
  AnalyticsAutomationDimensionPoint,
  AnalyticsAutomationLinkSummary,
  AnalyticsAutomationSeriesPoint,
  AnalyticsAutomationTotals,
  AnalyticsBotBreakdowns,
} from "@nami/analytics-domain/types"
import { resolveSeriesBucket } from "@nami/analytics-domain/range"
import {
  ANALYTICS_AUTOMATION_LINK_LIMIT,
  ANALYTICS_DIMENSION_LIMIT,
} from "@nami/analytics-domain/store"

import { getDatabase } from "../database"
import type { ResolvedQueryScope } from "../scope"
import { toIsoString, toNumber, type DatabaseNumber } from "./database-values";

interface AutomationDimensionRow {
  dimension: string;
  key: string;
  label: string | null;
  observed_requests: DatabaseNumber;
  estimated_requests: DatabaseNumber;
}

interface AutomationTotalsRow {
  observed_requests: DatabaseNumber;
  estimated_requests: DatabaseNumber;
  observed_declared_bots: DatabaseNumber;
  estimated_declared_bots: DatabaseNumber;
  observed_suspected_automation: DatabaseNumber;
  estimated_suspected_automation: DatabaseNumber;
  observed_unmatched: DatabaseNumber;
  estimated_unmatched: DatabaseNumber;
  observed_errors: DatabaseNumber;
  estimated_errors: DatabaseNumber;
}

interface AutomationSeriesRow extends AutomationTotalsRow {
  timestamp: Date | string;
}

interface AutomationLinkRow {
  analytics_id: string;
  route_path: string;
  link_type: "redirect" | "proxy";
  observed_requests: DatabaseNumber;
  estimated_requests: DatabaseNumber;
}

const emptyBotBreakdowns = (): AnalyticsBotBreakdowns => ({
  trafficClasses: [],
  categories: [],
  confidences: [],
  classifierVersions: [],
  resourceClasses: [],
  matchKinds: [],
  outcomes: [],
  probes: [],
});

function mapAutomationDimensions(rows: AutomationDimensionRow[]): AnalyticsBotBreakdowns {
  const groups = emptyBotBreakdowns();
  const dimensionMap: Record<string, keyof AnalyticsBotBreakdowns> = {
    trafficClasses: "trafficClasses",
    categories: "categories",
    confidences: "confidences",
    classifierVersions: "classifierVersions",
    resourceClasses: "resourceClasses",
    matchKinds: "matchKinds",
    outcomes: "outcomes",
    probes: "probes",
  };

  for (const row of rows) {
    const group = dimensionMap[row.dimension];
    if (!group) {
      continue;
    }

    groups[group].push({
      key: row.key,
      label: row.label ?? undefined,
      observedRequests: toNumber(row.observed_requests),
      estimatedRequests: toNumber(row.estimated_requests),
    });
  }

  return groups;
}

function toAutomationTotals(row: AutomationTotalsRow | undefined): AnalyticsAutomationTotals {
  return {
    observedRequests: toNumber(row?.observed_requests ?? null),
    estimatedRequests: toNumber(row?.estimated_requests ?? null),
    observedDeclaredBots: toNumber(row?.observed_declared_bots ?? null),
    estimatedDeclaredBots: toNumber(row?.estimated_declared_bots ?? null),
    observedSuspectedAutomation: toNumber(row?.observed_suspected_automation ?? null),
    estimatedSuspectedAutomation: toNumber(row?.estimated_suspected_automation ?? null),
    observedUnmatched: toNumber(row?.observed_unmatched ?? null),
    estimatedUnmatched: toNumber(row?.estimated_unmatched ?? null),
    observedErrors: toNumber(row?.observed_errors ?? null),
    estimatedErrors: toNumber(row?.estimated_errors ?? null),
  };
}

async function getEventLinkBotBreakdowns(
  sourceId: string,
  scope: ResolvedQueryScope,
  analyticsId: string | null,
): Promise<AnalyticsBotBreakdowns> {
  const sql = getDatabase();
  const rows = await sql<AutomationDimensionRow[]>`
    WITH events AS (
      SELECT *
      FROM access_event
      WHERE source_id = ${sourceId}
        AND occurred_at >= ${scope.range.start}
        AND occurred_at < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
    ), dimensions AS (
      SELECT 'trafficClasses'::TEXT AS dimension, traffic_class::TEXT AS key,
        NULL::TEXT AS label, COUNT(*) AS observed_requests,
        SUM(1 / sample_rate) AS estimated_requests
      FROM events
      GROUP BY traffic_class

      UNION ALL
      SELECT 'categories', bot_category, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY bot_category

      UNION ALL
      SELECT 'confidences', bot_confidence, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY bot_confidence

      UNION ALL
      SELECT 'classifierVersions', classifier_version::TEXT, NULL::TEXT,
        COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY classifier_version

      UNION ALL
      SELECT 'resourceClasses', resource_class, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY resource_class

      UNION ALL
      SELECT 'matchKinds', match_kind, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY match_kind

      UNION ALL
      SELECT 'probes', probe_category, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY probe_category
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY dimension ORDER BY observed_requests DESC, key ASC
      ) AS rank
      FROM dimensions
    )
    SELECT dimension, key, label, observed_requests, estimated_requests
    FROM ranked
    WHERE rank <= ${ANALYTICS_DIMENSION_LIMIT}
    ORDER BY dimension ASC, observed_requests DESC, key ASC
  `;

  return mapAutomationDimensions(rows);
}

async function getEventRuntimeBotBreakdowns(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsBotBreakdowns> {
  const sql = getDatabase();
  const rows = await sql<AutomationDimensionRow[]>`
    WITH events AS (
      SELECT
        traffic_class,
        bot_category,
        bot_confidence,
        classifier_version,
        resource_class,
        match_kind,
        'matched'::TEXT AS match_outcome,
        probe_category,
        sample_rate
      FROM access_event
      WHERE source_id = ${sourceId}
        AND occurred_at >= ${scope.range.start}
        AND occurred_at < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})

      UNION ALL

      SELECT
        traffic_class,
        bot_category,
        bot_confidence,
        classifier_version,
        resource_class,
        match_kind,
        match_outcome,
        probe_category,
        sample_rate
      FROM runtime_event
      WHERE source_id = ${sourceId}
        AND occurred_at >= ${scope.range.start}
        AND occurred_at < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
    ), dimensions AS (
      SELECT 'trafficClasses'::TEXT AS dimension, traffic_class::TEXT AS key,
        NULL::TEXT AS label, COUNT(*) AS observed_requests,
        SUM(1 / sample_rate) AS estimated_requests
      FROM events
      GROUP BY traffic_class

      UNION ALL
      SELECT 'categories', bot_category, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY bot_category

      UNION ALL
      SELECT 'confidences', bot_confidence, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY bot_confidence

      UNION ALL
      SELECT 'classifierVersions', classifier_version::TEXT, NULL::TEXT,
        COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY classifier_version

      UNION ALL
      SELECT 'resourceClasses', resource_class, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY resource_class

      UNION ALL
      SELECT 'matchKinds', match_kind, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY match_kind

      UNION ALL
      SELECT 'outcomes', match_outcome, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY match_outcome

      UNION ALL
      SELECT 'probes', probe_category, NULL::TEXT, COUNT(*), SUM(1 / sample_rate)
      FROM events
      GROUP BY probe_category
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY dimension ORDER BY observed_requests DESC, key ASC
      ) AS rank
      FROM dimensions
    )
    SELECT dimension, key, label, observed_requests, estimated_requests
    FROM ranked
    WHERE rank <= 10
    ORDER BY dimension ASC, observed_requests DESC, key ASC
  `;

  return mapAutomationDimensions(rows);
}

async function getEventAutomationLinks(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsAutomationLinkSummary[]> {
  const sql = getDatabase();
  const rows = await sql<AutomationLinkRow[]>`
    SELECT
      link.analytics_id,
      link.route_path,
      link.link_type,
      COUNT(*) AS observed_requests,
      SUM(1 / event.sample_rate) AS estimated_requests
    FROM access_event AS event
    INNER JOIN analytics_link AS link
      ON link.source_id = event.source_id
     AND link.analytics_id = event.analytics_id
    WHERE event.source_id = ${sourceId}
      AND event.occurred_at >= ${scope.range.start}
      AND event.occurred_at < ${scope.range.end}
      AND (${scope.entryDomain === "all"} OR event.entry_domain = ${scope.entryDomain})
      AND event.traffic_class IN ('declared_bot', 'suspected_automation')
    GROUP BY link.analytics_id, link.route_path, link.link_type
    ORDER BY COUNT(*) DESC, link.route_path ASC
    LIMIT ${ANALYTICS_AUTOMATION_LINK_LIMIT}
  `;

  return rows.map((row) => ({
    analyticsId: row.analytics_id,
    path: row.route_path,
    linkType: row.link_type,
    observedRequests: toNumber(row.observed_requests),
    estimatedRequests: toNumber(row.estimated_requests),
  }));
}

export async function getLinkBotBreakdowns(
  sourceId: string,
  scope: ResolvedQueryScope,
  analyticsId: string | null,
): Promise<AnalyticsBotBreakdowns> {
  if (
    scope.range.publicRange.key === "1d"
    || scope.range.publicRange.timeZone !== "UTC"
  ) {
    return getEventLinkBotBreakdowns(sourceId, scope, analyticsId);
  }

  const sql = getDatabase();
  const rows = await sql<AutomationDimensionRow[]>`
    WITH dimensions AS (
      SELECT 'trafficClasses'::TEXT AS dimension, traffic_class::TEXT AS key,
        NULL::TEXT AS label, SUM(observed_requests) AS observed_requests,
        SUM(estimated_requests) AS estimated_requests
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId}
        AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY traffic_class

      UNION ALL
      SELECT 'categories', bot_category, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY bot_category

      UNION ALL
      SELECT 'confidences', bot_confidence, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY bot_confidence

      UNION ALL
      SELECT 'classifierVersions', classifier_version::TEXT, NULL::TEXT,
        SUM(observed_requests), SUM(estimated_requests)
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY classifier_version

      UNION ALL
      SELECT 'resourceClasses', resource_class, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY resource_class

      UNION ALL
      SELECT 'matchKinds', match_kind, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY match_kind

      UNION ALL
      SELECT 'probes', probe_category, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM link_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY probe_category
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY dimension ORDER BY observed_requests DESC, key ASC
      ) AS rank
      FROM dimensions
    )
    SELECT dimension, key, label, observed_requests, estimated_requests
    FROM ranked
    WHERE rank <= ${ANALYTICS_DIMENSION_LIMIT}
    ORDER BY dimension ASC, observed_requests DESC, key ASC
  `;

  return mapAutomationDimensions(rows);
}

export async function getAutomationTotals(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsAutomationTotals> {
  const sql = getDatabase();
  const [row] = await sql<AutomationTotalsRow[]>`
    SELECT
      COALESCE(SUM(observed_requests), 0) AS observed_requests,
      COALESCE(SUM(estimated_requests), 0) AS estimated_requests,
      COALESCE(SUM(declared_bot_observed_requests), 0) AS observed_declared_bots,
      COALESCE(SUM(declared_bot_estimated_requests), 0) AS estimated_declared_bots,
      COALESCE(SUM(suspected_automation_observed_requests), 0) AS observed_suspected_automation,
      COALESCE(SUM(suspected_automation_estimated_requests), 0) AS estimated_suspected_automation,
      COALESCE(SUM(observed_requests) FILTER (WHERE match_kind = 'unmatched'), 0) AS observed_unmatched,
      COALESCE(SUM(estimated_requests) FILTER (WHERE match_kind = 'unmatched'), 0) AS estimated_unmatched,
      COALESCE(SUM(error_observed_requests), 0) AS observed_errors,
      COALESCE(SUM(error_estimated_requests), 0) AS estimated_errors
    FROM runtime_stats_hourly
    WHERE source_id = ${sourceId}
      AND bucket_start >= ${scope.range.start}
      AND bucket_start < ${scope.range.end}
      AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
  `;

  return toAutomationTotals(row);
}

export async function getAutomationSeries(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsAutomationSeriesPoint[]> {
  const sql = getDatabase();
  const bucket = resolveSeriesBucket(scope.range.publicRange.key);
  const timeZone = scope.range.publicRange.timeZone;
  const bucketSeries = bucket.unit === "day"
    ? sql`
        SELECT local_bucket AT TIME ZONE ${timeZone} AS bucket_time
        FROM generate_series(
          ${scope.range.seriesStart}::TIMESTAMPTZ AT TIME ZONE ${timeZone},
          ${scope.range.seriesEnd}::TIMESTAMPTZ AT TIME ZONE ${timeZone},
          ${bucket.step}::INTERVAL
        ) AS series(local_bucket)
      `
    : sql`
        SELECT generate_series(
          ${scope.range.seriesStart}::TIMESTAMPTZ,
          ${scope.range.seriesEnd}::TIMESTAMPTZ,
          ${bucket.step}::INTERVAL
        ) AS bucket_time
      `;
  const bucketTime = bucket.unit === "day"
    ? sql`date_trunc('day', bucket_start AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone}`
    : sql`date_trunc('hour', bucket_start AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;
  const rows = await sql<AutomationSeriesRow[]>`
    WITH buckets AS (
      ${bucketSeries}
    ), stats AS (
      SELECT
        ${bucketTime} AS bucket_time,
        SUM(observed_requests) AS observed_requests,
        SUM(estimated_requests) AS estimated_requests,
        SUM(declared_bot_observed_requests) AS observed_declared_bots,
        SUM(declared_bot_estimated_requests) AS estimated_declared_bots,
        SUM(suspected_automation_observed_requests) AS observed_suspected_automation,
        SUM(suspected_automation_estimated_requests) AS estimated_suspected_automation,
        SUM(observed_requests) FILTER (WHERE match_kind = 'unmatched') AS observed_unmatched,
        SUM(estimated_requests) FILTER (WHERE match_kind = 'unmatched') AS estimated_unmatched,
        SUM(error_observed_requests) AS observed_errors,
        SUM(error_estimated_requests) AS estimated_errors
      FROM runtime_stats_hourly
      WHERE source_id = ${sourceId}
        AND bucket_start >= ${scope.range.start}
        AND bucket_start < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY 1
    )
    SELECT
      buckets.bucket_time AS timestamp,
      COALESCE(stats.observed_requests, 0) AS observed_requests,
      COALESCE(stats.estimated_requests, 0) AS estimated_requests,
      COALESCE(stats.observed_declared_bots, 0) AS observed_declared_bots,
      COALESCE(stats.estimated_declared_bots, 0) AS estimated_declared_bots,
      COALESCE(stats.observed_suspected_automation, 0) AS observed_suspected_automation,
      COALESCE(stats.estimated_suspected_automation, 0) AS estimated_suspected_automation,
      COALESCE(stats.observed_unmatched, 0) AS observed_unmatched,
      COALESCE(stats.estimated_unmatched, 0) AS estimated_unmatched,
      COALESCE(stats.observed_errors, 0) AS observed_errors,
      COALESCE(stats.estimated_errors, 0) AS estimated_errors
    FROM buckets
    LEFT JOIN stats USING (bucket_time)
    ORDER BY buckets.bucket_time ASC
  `;

  return rows.map((row) => ({
    timestamp: toIsoString(row.timestamp),
    ...toAutomationTotals(row),
  }));
}

export async function getRuntimeBotBreakdowns(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsBotBreakdowns> {
  if (
    scope.range.publicRange.key === "1d"
    || scope.range.publicRange.timeZone !== "UTC"
  ) {
    return getEventRuntimeBotBreakdowns(sourceId, scope);
  }

  const sql = getDatabase();
  const rows = await sql<AutomationDimensionRow[]>`
    WITH dimensions AS (
      SELECT 'trafficClasses'::TEXT AS dimension, traffic_class::TEXT AS key,
        NULL::TEXT AS label, SUM(observed_requests) AS observed_requests,
        SUM(estimated_requests) AS estimated_requests
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY traffic_class

      UNION ALL
      SELECT 'categories', bot_category, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY bot_category

      UNION ALL
      SELECT 'confidences', bot_confidence, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY bot_confidence

      UNION ALL
      SELECT 'classifierVersions', classifier_version::TEXT, NULL::TEXT,
        SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY classifier_version

      UNION ALL
      SELECT 'resourceClasses', resource_class, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY resource_class

      UNION ALL
      SELECT 'matchKinds', match_kind, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY match_kind

      UNION ALL
      SELECT 'outcomes', match_outcome, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY match_outcome

      UNION ALL
      SELECT 'probes', probe_category, NULL::TEXT, SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_daily_bot
      WHERE source_id = ${sourceId} AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY probe_category
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY dimension ORDER BY observed_requests DESC, key ASC
      ) AS rank
      FROM dimensions
    )
    SELECT dimension, key, label, observed_requests, estimated_requests
    FROM ranked
    WHERE rank <= ${ANALYTICS_DIMENSION_LIMIT}
    ORDER BY dimension ASC, observed_requests DESC, key ASC
  `;

  return mapAutomationDimensions(rows);
}

export async function getAutomationDeliveryDimensions(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<{
  providers: AnalyticsAutomationDimensionPoint[];
  entryDomains: AnalyticsAutomationDimensionPoint[];
}> {
  const sql = getDatabase();
  const rows = await sql<AutomationDimensionRow[]>`
    WITH dimensions AS (
      SELECT 'providers'::TEXT AS dimension, provider::TEXT AS key, NULL::TEXT AS label,
        SUM(observed_requests) AS observed_requests, SUM(estimated_requests) AS estimated_requests
      FROM runtime_stats_hourly
      WHERE source_id = ${sourceId} AND bucket_start >= ${scope.range.start}
        AND bucket_start < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY provider

      UNION ALL

      SELECT 'entryDomains', entry_domain, NULL::TEXT,
        SUM(observed_requests), SUM(estimated_requests)
      FROM runtime_stats_hourly
      WHERE source_id = ${sourceId} AND bucket_start >= ${scope.range.start}
        AND bucket_start < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY entry_domain
    )
    SELECT dimension, key, label, observed_requests, estimated_requests
    FROM dimensions
    ORDER BY dimension ASC, observed_requests DESC, key ASC
  `;

  const providers: AnalyticsAutomationDimensionPoint[] = [];
  const entryDomains: AnalyticsAutomationDimensionPoint[] = [];
  for (const row of rows) {
    const item = {
      key: row.key,
      label: row.label ?? undefined,
      observedRequests: toNumber(row.observed_requests),
      estimatedRequests: toNumber(row.estimated_requests),
    };
    if (row.dimension === "providers") {
      providers.push(item);
    } else if (row.dimension === "entryDomains") {
      entryDomains.push(item);
    }
  }

  return { providers, entryDomains };
}

export async function getAutomationLinks(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsAutomationLinkSummary[]> {
  if (
    scope.range.publicRange.key === "1d"
    || scope.range.publicRange.timeZone !== "UTC"
  ) {
    return getEventAutomationLinks(sourceId, scope);
  }

  const sql = getDatabase();
  const rows = await sql<AutomationLinkRow[]>`
    SELECT
      link.analytics_id,
      link.route_path,
      link.link_type,
      SUM(stats.observed_requests) AS observed_requests,
      SUM(stats.estimated_requests) AS estimated_requests
    FROM link_stats_daily_bot AS stats
    INNER JOIN analytics_link AS link
      ON link.source_id = stats.source_id
     AND link.analytics_id = stats.analytics_id
    WHERE stats.source_id = ${sourceId}
      AND stats.bucket_day >= ${scope.range.startDay}
      AND stats.bucket_day < ${scope.range.endDay}
      AND (${scope.entryDomain === "all"} OR stats.entry_domain = ${scope.entryDomain})
      AND stats.traffic_class IN ('declared_bot', 'suspected_automation')
    GROUP BY link.analytics_id, link.route_path, link.link_type
    ORDER BY SUM(stats.observed_requests) DESC, link.route_path ASC
    LIMIT ${ANALYTICS_AUTOMATION_LINK_LIMIT}
  `;

  return rows.map((row) => ({
    analyticsId: row.analytics_id,
    path: row.route_path,
    linkType: row.link_type,
    observedRequests: toNumber(row.observed_requests),
    estimatedRequests: toNumber(row.estimated_requests),
  }));
}
