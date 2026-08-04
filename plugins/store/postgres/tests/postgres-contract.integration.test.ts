import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

import type { CanonicalAnalyticsLinkEvent } from "@i0c/analytics-domain/events"
import { assertAnalyticsStoreBehaviorContract } from "@i0c/plugin-testkit"

import { defaultPostgresAnalyticsStoreConfig } from "../src/config"
import { getDatabase } from "../src/database"
import { createPostgresSchemaMigrationProvider } from "../src/migrations"
import { createPostgresAnalyticsStore } from "../src/store"
import type { PostgresAnalyticsStoreTypes } from "../src/types"

const connectionString = process.env.TEST_POSTGRES_URL?.trim()

test("passes the shared analytics store behavior contract", {
  skip: !connectionString,
}, async () => {
  if (!connectionString) {
    return
  }

  const migrations = createPostgresSchemaMigrationProvider({ connectionString })
  const concurrentSchemaMigrationResults = await Promise.all([
    migrations.applySchemaMigrations(),
    migrations.applySchemaMigrations(),
  ])
  const schemaMigrationStatus = await migrations.schemaMigrationStatus()
  assert.equal(schemaMigrationStatus.pending, 0)
  assert.ok(concurrentSchemaMigrationResults.every(
    (result) => result.currentVersion === schemaMigrationStatus.targetVersion,
  ))
  const store = createPostgresAnalyticsStore(
    defaultPostgresAnalyticsStoreConfig,
    {
      connectionString,
      development: false,
      schemaMigrations: migrations,
    },
  )
  const occurredAt = new Date()
  const rebuildStart = new Date(occurredAt)
  rebuildStart.setUTCHours(0, 0, 0, 0)
  const rebuildEnd = new Date(rebuildStart.getTime() + 24 * 60 * 60 * 1000)
  const sourceId = `contract-${Date.now()}`
  const event: CanonicalAnalyticsLinkEvent = {
    schemaVersion: 2,
    eventKind: "link",
    eventId: randomUUID(),
    occurredAt: occurredAt.toISOString(),
    sourceId,
    analyticsId: `${sourceId}-link`,
    routePath: "/contract",
    linkType: "redirect",
    entryDomain: "api.i0c.cc",
    provider: "cloudflare",
    statusCode: 302,
    trafficClass: "browser_like",
    botCategory: "none",
    botConfidence: "none",
    classifierVersion: 1,
    resourceClass: "document",
    deviceType: "desktop",
    countryCode: "CN",
    sampleRate: 1,
    latencyMs: 12,
    probeCategory: "none",
    matchKind: "exact",
    matchOutcome: "matched",
    referrerDomain: "example.com",
    campaignId: null,
    upstreamEventId: null,
    upstreamAnalyticsId: null,
    upstreamEntryDomain: null,
    upstreamProvider: null,
    legacyRequestClass: "human",
    legacyIsBot: false,
    legacyIsPreview: false,
  }
  const otherEntryDomainEvent: CanonicalAnalyticsLinkEvent = {
    ...event,
    eventId: randomUUID(),
    analyticsId: `${sourceId}-other-domain-link`,
    routePath: "/contract-other-domain",
    entryDomain: "nf.i0c.cc",
  }
  const expiredEvent: CanonicalAnalyticsLinkEvent = {
    ...event,
    eventId: randomUUID(),
    occurredAt: new Date(
      occurredAt.getTime() - 182 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    entryDomain: "stale.i0c.cc",
  }
  const otherSourceExpiredEvent: CanonicalAnalyticsLinkEvent = {
    ...expiredEvent,
    eventId: randomUUID(),
    sourceId: `${sourceId}-retention-control`,
    analyticsId: `${sourceId}-retention-control-link`,
    routePath: "/retention-control",
  }

  await assertAnalyticsStoreBehaviorContract<PostgresAnalyticsStoreTypes>({
    store,
    event,
    otherEntryDomainEvent,
    expiredEvent,
    scope: {
      sourceId,
      query: { range: "1d", entryDomain: "all", timeZone: "UTC" },
    },
    createScope: (range, entryDomain) => ({
      sourceId,
      query: { range, entryDomain, timeZone: "UTC" },
    }),
    detailInput: {
      sourceId,
      analyticsId: event.analyticsId,
      query: { range: "1d", entryDomain: "all", timeZone: "UTC" },
    },
    missingDetailInput: {
      sourceId,
      analyticsId: "missing-analytics-id",
      query: { range: "1d", entryDomain: "all", timeZone: "UTC" },
    },
    rebuildInput: {
      sourceId,
      start: rebuildStart.toISOString(),
      end: rebuildEnd.toISOString(),
    },
    invalidRebuildInput: {
      sourceId: "   ",
      start: rebuildStart.toISOString(),
      end: rebuildEnd.toISOString(),
    },
    retentionScope: { sourceId },
    async prepareRetention() {
      await store.ingest(otherSourceExpiredEvent)
      const sql = getDatabase()
      await sql`
        UPDATE access_event
        SET received_at = NOW() - INTERVAL '182 days'
        WHERE event_id = ${expiredEvent.eventId}
      `
      await sql`
        UPDATE access_event
        SET received_at = NOW() - INTERVAL '182 days'
        WHERE event_id = ${otherSourceExpiredEvent.eventId}
      `
      await sql`
        UPDATE analytics_event_receipt
        SET received_at = NOW() - INTERVAL '182 days'
        WHERE event_id = ${otherSourceExpiredEvent.eventId}
      `
      await sql`
        UPDATE analytics_event_receipt
        SET received_at = NOW() - INTERVAL '182 days'
        WHERE event_id = ${expiredEvent.eventId}
      `
    },
    expectedEntryDomain: event.entryDomain,
    expectedOtherEntryDomain: otherEntryDomainEvent.entryDomain,
    expectedExpiredEntryDomain: expiredEvent.entryDomain,
    expectedEstimatedRequests: 2,
    getOverviewObservedRequests: (overview) => overview.totals.requests,
    getOverviewOutcomeObservedRequests: (overview) =>
      overview.botBreakdowns.outcomes.reduce(
        (total, point) => total + point.observedRequests,
        0,
      ),
    getAutomationObservedRequests: (overview) => overview.totals.observedRequests,
    getAutomationEstimatedRequests: (overview) => overview.totals.estimatedRequests,
    getAutomationOutcomeObservedRequests: (overview) =>
      overview.botBreakdowns.outcomes.reduce(
        (total, point) => total + point.observedRequests,
        0,
      ),
    getOverviewSeriesTimestamps: (overview) =>
      overview.series.map((point) => point.timestamp),
    getEntryDomainValues: (values) => values.map((value) => value.value),
    getDetailObservedRequests: (detail) => detail?.totals.requests ?? null,
    getIsDuplicate: (result) => result.isDuplicate,
    getRebuildReplayedEvents: (result) =>
      result.accessEventsReplayed + result.runtimeEventsReplayed,
    getRetentionDeletedRawEvents: (result) =>
      result.deleted.accessEvents + result.deleted.runtimeEvents,
  })

  const sql = getDatabase()
  const [retentionControl] = await sql<{ count: number | string }[]>`
    SELECT COUNT(*)::BIGINT AS count
    FROM access_event
    WHERE event_id = ${otherSourceExpiredEvent.eventId}
  `
  assert.equal(Number(retentionControl?.count ?? 0), 1)
})
