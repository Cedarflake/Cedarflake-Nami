import type {
  AnalyticsAutomationOverview,
  AnalyticsDetail,
  AnalyticsOverview,
} from "@nami/analytics-domain/types"
import type {
  AnalyticsStore,
  PluginSchemaMigrationProvider,
} from "@nami/plugin-api"

import type { PostgresAnalyticsStoreConfig } from "./config"
import {
  configurePostgresDatabase,
  getDatabase,
  isDatabaseConfigured,
} from "./database"
import { ingestAnalyticsEvent } from "./ingest"
import { postgresAnalyticsStoreManifest } from "./manifest"
import {
  getAutomationDeliveryDimensions,
  getAutomationLinks,
  getAutomationSeries,
  getAutomationTotals,
  getLinkBotBreakdowns,
  getRuntimeBotBreakdowns,
} from "./queries/automation"
import {
  getDimensions,
  getLink,
  getLinkSummaries,
  getSeries,
  getTotals,
} from "./queries/traffic"
import { pruneExpiredAnalyticsRows } from "./retention"
import { rebuildPostgresAggregates } from "./rebuild"
import {
  getAvailableEntryDomains,
  resolvePostgresScope,
} from "./scope"
import type {
  PostgresAnalyticsDetailInput,
  PostgresAnalyticsQueryInput,
  PostgresAnalyticsStoreTypes,
} from "./types"

export interface PostgresAnalyticsStoreServices {
  connectionString: string | null
  development: boolean
  schemaMigrations?: PluginSchemaMigrationProvider
}

export type PostgresAnalyticsStore = AnalyticsStore<PostgresAnalyticsStoreTypes> & {
  readonly configured: boolean
}

export function createPostgresAnalyticsStore(
  config: PostgresAnalyticsStoreConfig,
  services: PostgresAnalyticsStoreServices,
): PostgresAnalyticsStore {
  const connectionString = services.connectionString?.trim() || null
  configurePostgresDatabase({
    connectionString,
    config,
    development: services.development,
  })

  return {
    configured: connectionString !== null,
    ...(services.schemaMigrations
      ? { schemaMigrations: services.schemaMigrations }
      : {}),
    ingest: ingestAnalyticsEvent,
    async getOverview(input) {
      return queryOverview(input)
    },
    async getAutomation(input) {
      return queryAutomation(input)
    },
    async getEntryDomains(input) {
      return getAvailableEntryDomains(input.sourceId)
    },
    async getDetail(input) {
      return queryDetail(input)
    },
    async rebuildAggregates(input) {
      return rebuildPostgresAggregates(input, config)
    },
    async runRetention(scope) {
      return pruneExpiredAnalyticsRows(config, scope)
    },
    async healthCheck() {
      if (!isDatabaseConfigured()) {
        return {
          status: "unhealthy",
          message: "DATABASE_URL is not configured",
        }
      }

      try {
        const sql = getDatabase()
        await sql`SELECT 1`
        return { status: "healthy" }
      } catch (error) {
        return {
          status: "unhealthy",
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

export const postgresAnalyticsStorePlugin = {
  manifest: postgresAnalyticsStoreManifest,
  create: createPostgresAnalyticsStore,
}

async function queryOverview(
  input: PostgresAnalyticsQueryInput,
): Promise<AnalyticsOverview> {
  const { publicScope, queryScope } = await resolvePostgresScope(
    input.sourceId,
    input.query,
  )
  const [totals, series, links, dimensions, botBreakdowns] = await Promise.all([
    getTotals(input.sourceId, queryScope, null),
    getSeries(input.sourceId, queryScope, null),
    getLinkSummaries(input.sourceId, queryScope),
    getDimensions(input.sourceId, queryScope, null),
    getLinkBotBreakdowns(input.sourceId, queryScope, null),
  ])

  return {
    range: queryScope.range.publicRange,
    scope: publicScope,
    totals,
    series,
    links,
    ...dimensions,
    botBreakdowns,
  }
}

async function queryDetail(
  input: PostgresAnalyticsDetailInput,
): Promise<AnalyticsDetail | null> {
  const link = await getLink(input.sourceId, input.analyticsId)
  if (!link) {
    return null
  }

  const { publicScope, queryScope } = await resolvePostgresScope(
    input.sourceId,
    input.query,
  )
  const [totals, series, dimensions, botBreakdowns] = await Promise.all([
    getTotals(input.sourceId, queryScope, input.analyticsId),
    getSeries(input.sourceId, queryScope, input.analyticsId),
    getDimensions(input.sourceId, queryScope, input.analyticsId),
    getLinkBotBreakdowns(input.sourceId, queryScope, input.analyticsId),
  ])

  return {
    range: queryScope.range.publicRange,
    scope: publicScope,
    link,
    totals,
    series,
    ...dimensions,
    botBreakdowns,
  }
}

async function queryAutomation(
  input: PostgresAnalyticsQueryInput,
): Promise<AnalyticsAutomationOverview> {
  const { publicScope, queryScope } = await resolvePostgresScope(
    input.sourceId,
    input.query,
  )
  const [totals, series, links, delivery, botBreakdowns] = await Promise.all([
    getAutomationTotals(input.sourceId, queryScope),
    getAutomationSeries(input.sourceId, queryScope),
    getAutomationLinks(input.sourceId, queryScope),
    getAutomationDeliveryDimensions(input.sourceId, queryScope),
    getRuntimeBotBreakdowns(input.sourceId, queryScope),
  ])

  return {
    range: queryScope.range.publicRange,
    scope: publicScope,
    totals,
    series,
    links,
    ...delivery,
    botBreakdowns,
  }
}
