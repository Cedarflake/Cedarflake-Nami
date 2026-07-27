import type {
  AnalyticsDimensionPoint,
  AnalyticsLinkSummary,
  AnalyticsMetricTotals,
  AnalyticsSeriesPoint,
} from "@i0c/analytics-domain/types"
import { resolveSeriesBucket } from "@i0c/analytics-domain/range"
import { createTrendComparison } from "@i0c/analytics-domain/trend"

import { getDatabase } from "../database"
import type { ResolvedQueryScope } from "../scope"
import { toIsoString, toNumber, type DatabaseNumber } from "./database-values";

interface MetricsRow {
  requests: DatabaseNumber;
  entry_requests: DatabaseNumber;
  clicks: DatabaseNumber;
  entry_clicks: DatabaseNumber;
  previews: DatabaseNumber;
  bots: DatabaseNumber;
  suspected_automation: DatabaseNumber;
  errors: DatabaseNumber;
  latency_ms_sum: DatabaseNumber;
}

interface SeriesRow extends MetricsRow {
  timestamp: Date | string;
}

interface DimensionRow {
  dimension: string;
  key: string;
  label: string | null;
  requests: DatabaseNumber;
  clicks: DatabaseNumber;
}

interface LinkSummaryRow {
  analytics_id: string;
  route_path: string;
  link_type: "redirect" | "proxy";
  requests: DatabaseNumber;
  entry_requests: DatabaseNumber;
  clicks: DatabaseNumber;
  entry_clicks: DatabaseNumber;
  previews: DatabaseNumber;
  bots: DatabaseNumber;
  suspected_automation: DatabaseNumber;
  errors: DatabaseNumber;
  previous_requests: DatabaseNumber;
  previous_clicks: DatabaseNumber;
}

export interface AnalyticsLinkIdentity {
  analyticsId: string;
  path: string;
  linkType: "redirect" | "proxy";
}

interface LinkRow {
  analytics_id: string;
  route_path: string;
  link_type: "redirect" | "proxy";
}

interface DimensionGroups {
  countries: AnalyticsDimensionPoint[];
  referrers: AnalyticsDimensionPoint[];
  devices: AnalyticsDimensionPoint[];
  providers: AnalyticsDimensionPoint[];
  campaigns: AnalyticsDimensionPoint[];
  upstreamLinks: AnalyticsDimensionPoint[];
}

function toMetricTotals(row: MetricsRow | undefined): AnalyticsMetricTotals {
  const requests = toNumber(row?.requests ?? null);
  const bots = toNumber(row?.bots ?? null);
  const previews = toNumber(row?.previews ?? null);
  const suspectedAutomation = toNumber(row?.suspected_automation ?? null);
  const latencyMsSum = toNumber(row?.latency_ms_sum ?? null);

  return {
    requests,
    entryRequests: toNumber(row?.entry_requests ?? null),
    clicks: toNumber(row?.clicks ?? null),
    entryClicks: toNumber(row?.entry_clicks ?? null),
    previews,
    bots: bots + previews + suspectedAutomation,
    declaredBots: bots + previews,
    suspectedAutomation,
    errors: toNumber(row?.errors ?? null),
    avgLatencyMs: requests > 0 ? latencyMsSum / requests : null,
  };
}

function mapSeries(rows: SeriesRow[]): AnalyticsSeriesPoint[] {
  return rows.map((row) => {
    const bots = toNumber(row.bots);
    const previews = toNumber(row.previews);
    const suspectedAutomation = toNumber(row.suspected_automation);

    return {
      timestamp: toIsoString(row.timestamp),
      requests: toNumber(row.requests),
      entryRequests: toNumber(row.entry_requests),
      clicks: toNumber(row.clicks),
      entryClicks: toNumber(row.entry_clicks),
      previews,
      bots: bots + previews + suspectedAutomation,
      declaredBots: bots + previews,
      suspectedAutomation,
      errors: toNumber(row.errors),
    };
  });
}

function mapDimensions(rows: DimensionRow[]): DimensionGroups {
  const groups: DimensionGroups = {
    countries: [],
    referrers: [],
    devices: [],
    providers: [],
    campaigns: [],
    upstreamLinks: [],
  };

  for (const row of rows) {
    const key = row.dimension as keyof DimensionGroups;
    if (!(key in groups)) {
      continue;
    }

    groups[key].push({
      key: row.key,
      label: row.label ?? undefined,
      requests: toNumber(row.requests),
      clicks: toNumber(row.clicks),
    });
  }

  return groups;
}

async function getEventDimensions(
  sourceId: string,
  scope: ResolvedQueryScope,
  analyticsId: string | null,
): Promise<DimensionGroups> {
  const sql = getDatabase();
  const rows = await sql<DimensionRow[]>`
    WITH events AS (
      SELECT *
      FROM access_event
      WHERE source_id = ${sourceId}
        AND occurred_at >= ${scope.range.start}
        AND occurred_at < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
    ), dimensions AS (
      SELECT
        'countries'::TEXT AS dimension,
        COALESCE(country_code, 'unknown')::TEXT AS key,
        NULL::TEXT AS label,
        COUNT(*) AS requests,
        COUNT(*) FILTER (WHERE request_class = 'human') AS clicks
      FROM events
      GROUP BY COALESCE(country_code, 'unknown')

      UNION ALL

      SELECT
        'referrers',
        COALESCE(referrer_domain, 'direct'),
        NULL::TEXT,
        COUNT(*),
        COUNT(*) FILTER (WHERE request_class = 'human')
      FROM events
      GROUP BY COALESCE(referrer_domain, 'direct')

      UNION ALL

      SELECT
        'devices',
        device_type,
        NULL::TEXT,
        COUNT(*),
        COUNT(*) FILTER (WHERE request_class = 'human')
      FROM events
      GROUP BY device_type

      UNION ALL

      SELECT
        'providers',
        provider,
        NULL::TEXT,
        COUNT(*),
        COUNT(*) FILTER (WHERE request_class = 'human')
      FROM events
      GROUP BY provider

      UNION ALL

      SELECT
        'campaigns',
        campaign_id,
        NULL::TEXT,
        COUNT(*),
        COUNT(*) FILTER (WHERE request_class = 'human')
      FROM events
      WHERE campaign_id IS NOT NULL
      GROUP BY campaign_id

      UNION ALL

      SELECT
        'upstreamLinks',
        events.upstream_analytics_id,
        COALESCE(link.route_path, events.upstream_analytics_id),
        COUNT(*),
        COUNT(*) FILTER (WHERE events.request_class = 'human')
      FROM events
      LEFT JOIN analytics_link AS link
        ON link.source_id = events.source_id
       AND link.analytics_id = events.upstream_analytics_id
      WHERE events.upstream_analytics_id IS NOT NULL
      GROUP BY events.upstream_analytics_id, link.route_path
    ), ranked AS (
      SELECT
        dimension,
        key,
        label,
        requests,
        clicks,
        ROW_NUMBER() OVER (PARTITION BY dimension ORDER BY requests DESC, key ASC) AS rank
      FROM dimensions
    )
    SELECT dimension, key, label, requests, clicks
    FROM ranked
    WHERE rank <= 10 OR (dimension = 'countries' AND key = 'unknown')
    ORDER BY dimension ASC, requests DESC, key ASC
  `;

  return mapDimensions(rows);
}

export async function getTotals(
  sourceId: string,
  scope: ResolvedQueryScope,
  analyticsId: string | null,
): Promise<AnalyticsMetricTotals> {
  const sql = getDatabase();
  const [row] = await sql<MetricsRow[]>`
    SELECT
      COALESCE(SUM(requests), 0) AS requests,
      COALESCE(SUM(entry_requests), 0) AS entry_requests,
      COALESCE(SUM(human_requests), 0) AS clicks,
      COALESCE(SUM(entry_human_requests), 0) AS entry_clicks,
      COALESCE(SUM(preview_requests), 0) AS previews,
      COALESCE(SUM(bot_requests), 0) AS bots,
      COALESCE(SUM(suspected_automation_requests), 0) AS suspected_automation,
      COALESCE(SUM(error_requests), 0) AS errors,
      COALESCE(SUM(latency_ms_sum), 0) AS latency_ms_sum
    FROM link_stats_hourly_domain
    WHERE source_id = ${sourceId}
      AND bucket_start >= ${scope.range.start}
      AND bucket_start < ${scope.range.end}
      AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
  `;

  return toMetricTotals(row);
}

export async function getSeries(
  sourceId: string,
  scope: ResolvedQueryScope,
  analyticsId: string | null,
): Promise<AnalyticsSeriesPoint[]> {
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
  const rows = await sql<SeriesRow[]>`
    WITH buckets AS (
      ${bucketSeries}
    ), stats AS (
      SELECT
        ${bucketTime} AS bucket_time,
        SUM(requests) AS requests,
        SUM(entry_requests) AS entry_requests,
        SUM(human_requests) AS clicks,
        SUM(entry_human_requests) AS entry_clicks,
        SUM(preview_requests) AS previews,
        SUM(bot_requests) AS bots,
        SUM(suspected_automation_requests) AS suspected_automation,
        SUM(error_requests) AS errors,
        SUM(latency_ms_sum) AS latency_ms_sum
      FROM link_stats_hourly_domain
      WHERE source_id = ${sourceId}
        AND bucket_start >= ${scope.range.start}
        AND bucket_start < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY 1
    )
    SELECT
      buckets.bucket_time AS timestamp,
      COALESCE(stats.requests, 0) AS requests,
      COALESCE(stats.entry_requests, 0) AS entry_requests,
      COALESCE(stats.clicks, 0) AS clicks,
      COALESCE(stats.entry_clicks, 0) AS entry_clicks,
      COALESCE(stats.previews, 0) AS previews,
      COALESCE(stats.bots, 0) AS bots,
      COALESCE(stats.suspected_automation, 0) AS suspected_automation,
      COALESCE(stats.errors, 0) AS errors,
      COALESCE(stats.latency_ms_sum, 0) AS latency_ms_sum
    FROM buckets
    LEFT JOIN stats USING (bucket_time)
    ORDER BY buckets.bucket_time ASC
  `;

  return mapSeries(rows);
}

export async function getDimensions(
  sourceId: string,
  scope: ResolvedQueryScope,
  analyticsId: string | null,
): Promise<DimensionGroups> {
  if (
    scope.range.publicRange.key === "1d"
    || scope.range.publicRange.timeZone !== "UTC"
  ) {
    return getEventDimensions(sourceId, scope, analyticsId);
  }

  const sql = getDatabase();
  const rows = await sql<DimensionRow[]>`
    WITH dimensions AS (
      SELECT
        'countries'::TEXT AS dimension,
        country_code::TEXT AS key,
        NULL::TEXT AS label,
        SUM(requests) AS requests,
        SUM(human_requests) AS clicks
      FROM link_stats_daily_country_domain
      WHERE source_id = ${sourceId}
        AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY country_code

      UNION ALL

      SELECT 'referrers', referrer_domain, NULL::TEXT, SUM(requests), SUM(human_requests)
      FROM link_stats_daily_referrer_domain
      WHERE source_id = ${sourceId}
        AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY referrer_domain

      UNION ALL

      SELECT 'devices', device_type, NULL::TEXT, SUM(requests), SUM(human_requests)
      FROM link_stats_daily_device_domain
      WHERE source_id = ${sourceId}
        AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY device_type

      UNION ALL

      SELECT 'providers', provider, NULL::TEXT, SUM(requests), SUM(human_requests)
      FROM link_stats_daily_provider_domain
      WHERE source_id = ${sourceId}
        AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY provider

      UNION ALL

      SELECT 'campaigns', campaign_id, NULL::TEXT, SUM(requests), SUM(human_requests)
      FROM link_stats_daily_campaign_domain
      WHERE source_id = ${sourceId}
        AND bucket_day >= ${scope.range.startDay}
        AND bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR analytics_id = ${analyticsId})
      GROUP BY campaign_id

      UNION ALL

      SELECT
        'upstreamLinks',
        stats.upstream_analytics_id,
        COALESCE(link.route_path, stats.upstream_analytics_id),
        SUM(stats.requests),
        SUM(stats.human_requests)
      FROM link_stats_daily_upstream_domain AS stats
      LEFT JOIN analytics_link AS link
        ON link.source_id = stats.source_id
       AND link.analytics_id = stats.upstream_analytics_id
      WHERE stats.source_id = ${sourceId}
        AND stats.bucket_day >= ${scope.range.startDay}
        AND stats.bucket_day < ${scope.range.endDay}
        AND (${scope.entryDomain === "all"} OR stats.entry_domain = ${scope.entryDomain})
        AND (${analyticsId}::TEXT IS NULL OR stats.analytics_id = ${analyticsId})
      GROUP BY stats.upstream_analytics_id, link.route_path
    ), ranked AS (
      SELECT
        dimension,
        key,
        label,
        requests,
        clicks,
        ROW_NUMBER() OVER (PARTITION BY dimension ORDER BY requests DESC, key ASC) AS rank
      FROM dimensions
    )
    SELECT dimension, key, label, requests, clicks
    FROM ranked
    WHERE rank <= 10 OR (dimension = 'countries' AND key = 'unknown')
    ORDER BY dimension ASC, requests DESC, key ASC
  `;

  return mapDimensions(rows);
}

export async function getLinkSummaries(
  sourceId: string,
  scope: ResolvedQueryScope,
): Promise<AnalyticsLinkSummary[]> {
  const sql = getDatabase();
  const rows = await sql<LinkSummaryRow[]>`
    WITH current_stats AS (
      SELECT
        analytics_id,
        SUM(requests) AS requests,
        SUM(entry_requests) AS entry_requests,
        SUM(human_requests) AS clicks,
        SUM(entry_human_requests) AS entry_clicks,
        SUM(preview_requests) AS previews,
        SUM(bot_requests) AS bots,
        SUM(suspected_automation_requests) AS suspected_automation,
        SUM(error_requests) AS errors
      FROM link_stats_hourly_domain
      WHERE source_id = ${sourceId}
        AND bucket_start >= ${scope.range.start}
        AND bucket_start < ${scope.range.end}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY analytics_id
    ), previous_stats AS (
      SELECT
        analytics_id,
        SUM(requests) AS requests,
        SUM(entry_human_requests) AS clicks
      FROM link_stats_hourly_domain
      WHERE source_id = ${sourceId}
        AND bucket_start >= ${scope.range.previousStart}
        AND bucket_start < ${scope.range.previousEnd}
        AND (${scope.entryDomain === "all"} OR entry_domain = ${scope.entryDomain})
      GROUP BY analytics_id
    )
    SELECT
      link.analytics_id,
      link.route_path,
      link.link_type,
      current_stats.requests,
      current_stats.entry_requests,
      current_stats.clicks,
      current_stats.entry_clicks,
      current_stats.previews,
      current_stats.bots,
      current_stats.suspected_automation,
      current_stats.errors,
      COALESCE(previous_stats.requests, 0) AS previous_requests,
      COALESCE(previous_stats.clicks, 0) AS previous_clicks
    FROM analytics_link AS link
    LEFT JOIN current_stats ON current_stats.analytics_id = link.analytics_id
    LEFT JOIN previous_stats ON previous_stats.analytics_id = link.analytics_id
    WHERE link.source_id = ${sourceId}
      AND (${scope.entryDomain === "all"} OR current_stats.analytics_id IS NOT NULL)
    ORDER BY
      COALESCE(current_stats.entry_clicks, 0) DESC,
      COALESCE(current_stats.requests, 0) DESC,
      link.route_path ASC
    LIMIT 500
  `;

  return rows.map((row) => {
    const clicks = toNumber(row.clicks);
    const entryClicks = toNumber(row.entry_clicks);
    const previousRequests = toNumber(row.previous_requests);
    const previousClicks = toNumber(row.previous_clicks);
    const declaredBots = toNumber(row.bots);
    const previews = toNumber(row.previews);
    const suspectedAutomation = toNumber(row.suspected_automation);

    return {
      analyticsId: row.analytics_id,
      path: row.route_path,
      linkType: row.link_type,
      requests: toNumber(row.requests),
      entryRequests: toNumber(row.entry_requests),
      clicks,
      entryClicks,
      previews,
      bots: declaredBots + previews + suspectedAutomation,
      declaredBots: declaredBots + previews,
      suspectedAutomation,
      errors: toNumber(row.errors),
      trend: createTrendComparison(
        entryClicks,
        previousClicks,
        previousRequests > 0,
      ),
    };
  });
}

export async function getLink(
  sourceId: string,
  analyticsId: string,
): Promise<AnalyticsLinkIdentity | null> {
  const sql = getDatabase();
  const [link] = await sql<LinkRow[]>`
    SELECT analytics_id, route_path, link_type
    FROM analytics_link
    WHERE source_id = ${sourceId}
      AND analytics_id = ${analyticsId}
    LIMIT 1
  `;

  return link
    ? {
        analyticsId: link.analytics_id,
        path: link.route_path,
        linkType: link.link_type,
      }
    : null;
}
