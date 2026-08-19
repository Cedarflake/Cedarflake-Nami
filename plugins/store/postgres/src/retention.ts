import type {
  AnalyticsRetentionResult,
  AnalyticsRetentionScope,
} from "@nami/analytics-domain/store"

import { getDatabase } from "./database";
import type { PostgresAnalyticsStoreConfig } from "./config"

interface AnalyticsRetentionRow {
  cutoffAt: Date | string;
  accessEventsDeleted: number | string;
  runtimeEventsDeleted: number | string;
  eventReceiptsDeleted: number | string;
  upstreamClaimsDeleted: number | string;
}

function parseDeletedCount(value: number | string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Analytics retention returned an invalid deleted-row count");
  }

  return count;
}

function formatCutoff(value: Date | string): string {
  const cutoff = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error("Analytics retention returned an invalid cutoff timestamp");
  }

  return cutoff.toISOString();
}

export async function pruneExpiredAnalyticsRows(
  config: PostgresAnalyticsStoreConfig,
  scope: AnalyticsRetentionScope = {},
): Promise<AnalyticsRetentionResult> {
  const sourceId = normalizeRetentionSourceId(scope)
  if (sourceId !== undefined) {
    return pruneExpiredAnalyticsRowsForSource(config, sourceId)
  }

  const sql = getDatabase();
  const rows = await sql<AnalyticsRetentionRow[]>`
    SELECT
      cutoff_at AS "cutoffAt",
      access_events_deleted AS "accessEventsDeleted",
      runtime_events_deleted AS "runtimeEventsDeleted",
      event_receipts_deleted AS "eventReceiptsDeleted",
      upstream_claims_deleted AS "upstreamClaimsDeleted"
    FROM analytics_prune_raw_events()
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Analytics retention did not return a result");
  }

  return {
    retentionDays: config.retentionDays,
    cutoffAt: formatCutoff(row.cutoffAt),
    deleted: {
      accessEvents: parseDeletedCount(row.accessEventsDeleted),
      runtimeEvents: parseDeletedCount(row.runtimeEventsDeleted),
      eventReceipts: parseDeletedCount(row.eventReceiptsDeleted),
      upstreamClaims: parseDeletedCount(row.upstreamClaimsDeleted),
    },
  };
}

function normalizeRetentionSourceId(
  scope: AnalyticsRetentionScope,
): string | undefined {
  if (scope.sourceId === undefined) {
    return undefined
  }
  const sourceId = scope.sourceId.trim()
  if (!sourceId) {
    throw new Error("Analytics retention sourceId must not be empty")
  }
  return sourceId
}

async function pruneExpiredAnalyticsRowsForSource(
  config: PostgresAnalyticsStoreConfig,
  sourceId: string,
): Promise<AnalyticsRetentionResult> {
  const sql = getDatabase()
  return sql.begin(async (transaction) => {
    const [cutoffRow] = await transaction<{ cutoffAt: Date | string }[]>`
      SELECT NOW() - (${config.retentionDays} * INTERVAL '1 day') AS "cutoffAt"
    `
    if (!cutoffRow) {
      throw new Error("Analytics retention did not return a cutoff timestamp")
    }
    const cutoffAt = formatCutoff(cutoffRow.cutoffAt)

    const accessEvents = await transaction<{ count: number | string }[]>`
      WITH deleted AS (
        DELETE FROM access_event
        WHERE source_id = ${sourceId} AND received_at < ${cutoffAt}
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT AS count FROM deleted
    `
    const runtimeEvents = await transaction<{ count: number | string }[]>`
      WITH deleted AS (
        DELETE FROM runtime_event
        WHERE source_id = ${sourceId} AND received_at < ${cutoffAt}
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT AS count FROM deleted
    `
    const upstreamClaims = await transaction<{ count: number | string }[]>`
      WITH deleted AS (
        DELETE FROM analytics_upstream_claim
        WHERE source_id = ${sourceId} AND last_seen_at < ${cutoffAt}
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT AS count FROM deleted
    `
    const eventReceipts = await transaction<{ count: number | string }[]>`
      WITH deleted AS (
        DELETE FROM analytics_event_receipt
        WHERE source_id = ${sourceId} AND received_at < ${cutoffAt}
        RETURNING 1
      )
      SELECT COUNT(*)::BIGINT AS count FROM deleted
    `

    return {
      retentionDays: config.retentionDays,
      cutoffAt,
      deleted: {
        accessEvents: parseDeletedCount(accessEvents[0]?.count ?? 0),
        runtimeEvents: parseDeletedCount(runtimeEvents[0]?.count ?? 0),
        eventReceipts: parseDeletedCount(eventReceipts[0]?.count ?? 0),
        upstreamClaims: parseDeletedCount(upstreamClaims[0]?.count ?? 0),
      },
    }
  })
}
