import { resolveQueryRange, type QueryRange } from "@i0c/analytics-domain/range"
import { ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS } from "@i0c/analytics-domain/store"
import type {
  AnalyticsEntryDomainOption,
  AnalyticsQueryScope,
  AnalyticsScope,
} from "@i0c/analytics-domain/types"

import { getDatabase } from "./database"

interface EntryDomainRow {
  entry_domain: string
}

export interface ResolvedQueryScope {
  entryDomain: string
  range: QueryRange
}

export async function getAvailableEntryDomains(
  sourceId: string,
): Promise<AnalyticsEntryDomainOption[]> {
  const sql = getDatabase()
  const rows = await sql<EntryDomainRow[]>`
    WITH entry_domains AS (
      SELECT
        entry_domain
      FROM link_stats_hourly_domain
      WHERE source_id = ${sourceId}
        AND bucket_start >= (
          DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          - (${ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS - 1} * INTERVAL '1 day')
        )

      UNION

      SELECT
        entry_domain
      FROM runtime_stats_hourly
      WHERE source_id = ${sourceId}
        AND bucket_start >= (
          DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          - (${ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS - 1} * INTERVAL '1 day')
        )
    )
    SELECT
      entry_domain
    FROM entry_domains
    ORDER BY entry_domain ASC
  `

  return rows.map((row) => ({ value: row.entry_domain }))
}

export async function resolvePostgresScope(
  sourceId: string,
  input: AnalyticsQueryScope,
): Promise<{ publicScope: AnalyticsScope; queryScope: ResolvedQueryScope }> {
  const range = resolveQueryRange(input.range, new Date(), input.timeZone)
  const availableEntryDomains = await getAvailableEntryDomains(sourceId)
  const requestedEntryDomain = input.entryDomain.trim().toLowerCase() || "all"
  const isAvailable = availableEntryDomains.some(
    (option) => option.value === requestedEntryDomain,
  )
  const entryDomain =
    requestedEntryDomain === "all" || isAvailable ? requestedEntryDomain : "all"

  return {
    publicScope: { entryDomain, availableEntryDomains },
    queryScope: { entryDomain, range },
  }
}
