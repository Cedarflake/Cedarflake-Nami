import type { PostgresSql } from "@nami/database-postgres"
import { PluginError } from "@nami/plugin-api"

import type { PostgresAnalyticsStoreConfig } from "./config"
import { getDatabase } from "./database"
import { postgresAnalyticsStoreManifest } from "./manifest"
import type {
  PostgresAggregateRebuildInput,
  PostgresAggregateRebuildResult,
} from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

interface RebuildRow {
  accessEventsReplayed: string | number
  runtimeEventsReplayed: string | number
  aggregateRowsDeleted: string | number
}

export async function rebuildPostgresAggregates(
  input: PostgresAggregateRebuildInput,
  config: PostgresAnalyticsStoreConfig,
): Promise<PostgresAggregateRebuildResult> {
  const sourceId = input.sourceId.trim()
  const range = normalizeRebuildRange(input, config.retentionDays)
  if (!sourceId) {
    throw createRebuildError("sourceId must not be empty", input)
  }

  try {
    const sql = getDatabase()
    const [row] = await runAggregateRebuild(
      sql,
      sourceId,
      range.start,
      range.end,
      input.dryRun ?? false,
    )
    if (!row) {
      throw new Error("The aggregate rebuild function returned no result")
    }

    return {
      rebuilt: !(input.dryRun ?? false),
      sourceId,
      start: range.start,
      end: range.end,
      accessEventsReplayed: Number(row.accessEventsReplayed),
      runtimeEventsReplayed: Number(row.runtimeEventsReplayed),
      aggregateRowsDeleted: Number(row.aggregateRowsDeleted),
    }
  } catch (error) {
    if (error instanceof PluginError) {
      throw error
    }

    throw new PluginError(
      postgresAnalyticsStoreManifest.id,
      "PLUGIN_MIGRATION_FAILED",
      "Failed to rebuild PostgreSQL analytics aggregates",
      {
        cause: error,
        details: {
          sourceId,
          start: range.start,
          end: range.end,
          dryRun: input.dryRun ?? false,
        },
      },
    )
  }
}

async function runAggregateRebuild(
  sql: PostgresSql,
  sourceId: string,
  start: string,
  end: string,
  dryRun: boolean,
): Promise<RebuildRow[]> {
  return sql<RebuildRow[]>`
    SELECT
      access_events_replayed AS "accessEventsReplayed",
      runtime_events_replayed AS "runtimeEventsReplayed",
      aggregate_rows_deleted AS "aggregateRowsDeleted"
    FROM analytics_rebuild_aggregates(
      ${sourceId},
      ${start},
      ${end},
      ${dryRun}
    )
  `
}

function normalizeRebuildRange(
  input: PostgresAggregateRebuildInput,
  retentionDays: number,
): { start: string; end: string } {
  const startDate = parseDate(input.start, "start", input)
  const endDate = parseDate(input.end, "end", input)
  const startMs = utcDayStart(startDate)
  const endFloorMs = utcDayStart(endDate)
  const endMs = endDate.getTime() === endFloorMs
    ? endFloorMs
    : endFloorMs + DAY_MS

  if (startMs >= endMs) {
    throw createRebuildError("start must be earlier than end", input)
  }

  const rangeDays = (endMs - startMs) / DAY_MS
  if (rangeDays > retentionDays) {
    throw createRebuildError(
      `Aggregate rebuild range must not exceed ${retentionDays} days`,
      input,
    )
  }

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}

function parseDate(
  value: string,
  field: "start" | "end",
  input: PostgresAggregateRebuildInput,
): Date {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw createRebuildError(`${field} must be a valid timestamp`, input)
  }
  return date
}

function utcDayStart(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
}

function createRebuildError(
  message: string,
  input: PostgresAggregateRebuildInput,
): PluginError {
  return new PluginError(
    postgresAnalyticsStoreManifest.id,
    "PLUGIN_CONFIG_INVALID",
    message,
    { details: { ...input } },
  )
}
