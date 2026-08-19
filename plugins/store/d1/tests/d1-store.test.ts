import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import test from "node:test"

import type { CanonicalAnalyticsLinkEvent } from "@nami/analytics-domain/events"
import { SQLiteD1Database } from "@nami/database-d1/testkit"
import {
  assertAnalyticsStoreBehaviorContract,
  assertSchemaMigrationState,
  assertPluginManifest,
} from "@nami/plugin-testkit"

import {
  defaultD1AnalyticsStoreConfig,
  resolveD1AnalyticsStoreConfig,
} from "../src/config"
import { d1All, d1Run } from "../src/d1"
import { d1AnalyticsStoreManifest } from "../src/manifest"
import {
  createD1SchemaMigrationProvider,
  type D1SchemaMigration,
} from "../src/migrations"
import { createD1AnalyticsStore } from "../src/store"
import type { D1AnalyticsStoreTypes } from "../src/types"

const now = new Date("2026-07-22T10:30:00.000Z")
const event: CanonicalAnalyticsLinkEvent = {
  schemaVersion: 2,
  eventKind: "link",
  eventId: "d1-contract-event",
  occurredAt: "2026-07-22T09:30:00.000Z",
  sourceId: "i0c.cc",
  analyticsId: "analytics-contract",
  routePath: "/contract",
  linkType: "redirect",
  entryDomain: "api.i0c.cc",
  provider: "cloudflare",
  statusCode: 302,
  trafficClass: "browser_like",
  botCategory: "none",
  botConfidence: "high",
  classifierVersion: 1,
  resourceClass: "document",
  deviceType: "desktop",
  countryCode: "CN",
  sampleRate: 0.5,
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
  eventId: "d1-contract-other-domain-event",
  analyticsId: "analytics-contract-other-domain",
  routePath: "/contract-other-domain",
  entryDomain: "nf.i0c.cc",
}
const expiredEvent: CanonicalAnalyticsLinkEvent = {
  ...event,
  eventId: "d1-contract-expired-event",
  occurredAt: "2025-12-01T09:30:00.000Z",
  entryDomain: "stale.i0c.cc",
}

test("declares a valid D1 store manifest", () => {
  assertPluginManifest(d1AnalyticsStoreManifest)
})

test("resolves the configured retention policy", () => {
  assert.deepEqual(resolveD1AnalyticsStoreConfig({ retentionDays: 181 }), {
    retentionDays: 181,
  })
  assert.deepEqual(resolveD1AnalyticsStoreConfig(undefined), {
    retentionDays: 181,
  })
})

test("rejects an empty retention source instead of pruning every source", async () => {
  const database = new SQLiteD1Database()
  try {
    const store = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
    })
    await assert.rejects(
      store.runRetention({ sourceId: "  " }),
      /sourceId must not be empty/,
    )
  } finally {
    database.close()
  }
})

test("owns and applies independent D1 migrations", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations = await loadMigrations()
    const provider = createD1SchemaMigrationProvider(database, migrations)
    await assertSchemaMigrationState(provider, "001_analytics_store.sql")
    const result = await provider.applySchemaMigrations({ expectedCurrentVersion: null })
    assert.deepEqual(result.applied, ["001_analytics_store.sql"])
    await assertSchemaMigrationState(provider, "001_analytics_store.sql")
    assert.equal((await provider.schemaMigrationStatus()).pending, 0)
  } finally {
    database.close()
  }
})

test("concurrent D1 migration runners converge without an expected version", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations = await loadMigrations()
    const first = createD1SchemaMigrationProvider(database, migrations)
    const second = createD1SchemaMigrationProvider(database, migrations)
    const results = await Promise.all([
      first.applySchemaMigrations(),
      second.applySchemaMigrations(),
    ])

    assert.equal(results.flatMap((result) => result.applied).length, 1)
    assert.equal((await first.schemaMigrationStatus()).pending, 0)
  } finally {
    database.close()
  }
})

test("concurrent D1 migration runners preserve expected-version conflicts", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations = await loadMigrations()
    const first = createD1SchemaMigrationProvider(database, migrations)
    const second = createD1SchemaMigrationProvider(database, migrations)
    const results = await Promise.allSettled([
      first.applySchemaMigrations({ expectedCurrentVersion: null }),
      second.applySchemaMigrations({ expectedCurrentVersion: null }),
    ])

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    )
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    )
  } finally {
    database.close()
  }
})

test("rolls back a failed D1 migration and its version record", async () => {
  const database = new SQLiteD1Database()
  try {
    const provider = createD1SchemaMigrationProvider(database, [{
      id: "001_failure.sql",
      sql: `
        CREATE TABLE partial_migration (id TEXT PRIMARY KEY);
        -- d1-statement-breakpoint
        INSERT INTO missing_table (id) VALUES ('failure');
      `,
    }])

    await assert.rejects(async () => provider.applySchemaMigrations(), /missing_table/)

    const tables = await d1All<{ name: string }>(database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'partial_migration'
    `))
    const applied = await d1All<{ count: number }>(database.prepare(`
      SELECT COUNT(*) AS count FROM analytics_schema_migration
    `))
    assert.deepEqual(tables, [])
    assert.equal(applied[0]?.count, 0)
  } finally {
    database.close()
  }
})

test("rejects drift in an applied D1 migration", async () => {
  const database = new SQLiteD1Database()
  try {
    const original = {
      id: "001_checksum.sql",
      sql: "CREATE TABLE checksum_test (id TEXT PRIMARY KEY);",
    }
    await createD1SchemaMigrationProvider(database, [original]).applySchemaMigrations()

    const changedProvider = createD1SchemaMigrationProvider(database, [{
      ...original,
      sql: "CREATE TABLE checksum_test (id TEXT PRIMARY KEY, value TEXT);",
    }])
    await assert.rejects(
      async () => changedProvider.schemaMigrationStatus(),
      /D1 migration checksum mismatch/,
    )
  } finally {
    database.close()
  }
})

test("rejects an applied D1 migration from a newer schema", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations = await loadMigrations()
    const provider = createD1SchemaMigrationProvider(database, migrations)
    await provider.applySchemaMigrations()
    await d1Run(database.prepare(`
      INSERT INTO analytics_schema_migration (id, checksum)
      VALUES ('999_future.sql', 'future')
    `))

    await assert.rejects(
      async () => provider.schemaMigrationStatus(),
      /unknown applied schema migration: 999_future.sql/,
    )
  } finally {
    database.close()
  }
})

test("rejects a non-contiguous D1 migration history", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations: D1SchemaMigration[] = [
      {
        id: "001_first.sql",
        sql: "CREATE TABLE migration_first (id TEXT PRIMARY KEY);",
      },
      {
        id: "002_second.sql",
        sql: "CREATE TABLE migration_second (id TEXT PRIMARY KEY);",
      },
    ]
    const provider = createD1SchemaMigrationProvider(database, migrations)
    await provider.applySchemaMigrations()
    await d1Run(database.prepare(`
      DELETE FROM analytics_schema_migration WHERE id = '001_first.sql'
    `))

    await assert.rejects(
      async () => provider.schemaMigrationPlan(),
      /not a continuous prefix: 002_second.sql/,
    )
  } finally {
    database.close()
  }
})

test("rolls back all D1 ingest writes when the event insert fails", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1SchemaMigrationProvider(database, await loadMigrations()).applySchemaMigrations()
    const store = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
      clock: () => new Date(now),
    })
    const attributedEvent: CanonicalAnalyticsLinkEvent = {
      ...event,
      eventId: "d1-atomic-event",
      upstreamEventId: "d1-upstream-event",
      upstreamAnalyticsId: "d1-upstream-link",
      upstreamEntryDomain: "api.i0c.cc",
      upstreamProvider: "cloudflare",
    }
    database.failNextBatchAt(3)

    await assert.rejects(store.ingest(attributedEvent), /Injected D1 batch failure/)

    for (const table of [
      "analytics_source",
      "analytics_link",
      "analytics_upstream_claim",
      "analytics_event",
      "analytics_stats_hourly",
      "analytics_stats_daily",
    ]) {
      const rows = await d1All<{ count: number }>(database.prepare(
        `SELECT COUNT(*) AS count FROM ${table}`,
      ))
      assert.equal(rows[0]?.count, 0, `${table} must be rolled back`)
    }
  } finally {
    database.close()
  }
})

test("passes the shared analytics store behavior contract", async () => {
  const database = new SQLiteD1Database()
  try {
    const migrations = createD1SchemaMigrationProvider(database, await loadMigrations())
    await migrations.applySchemaMigrations()
    let currentTime = new Date(now)
    const store = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
      schemaMigrations: migrations,
      clock: () => new Date(currentTime),
    })
    await assertAnalyticsStoreBehaviorContract<D1AnalyticsStoreTypes>({
      store,
      event,
      otherEntryDomainEvent,
      expiredEvent,
      scope: {
        sourceId: event.sourceId,
        query: { range: "1d", entryDomain: "all", timeZone: "UTC" },
      },
      createScope: (range, entryDomain) => ({
        sourceId: event.sourceId,
        query: { range, entryDomain, timeZone: "UTC" },
      }),
      detailInput: {
        sourceId: event.sourceId,
        analyticsId: event.analyticsId,
        query: { range: "1d", entryDomain: "all", timeZone: "UTC" },
      },
      missingDetailInput: {
        sourceId: event.sourceId,
        analyticsId: "missing-analytics-id",
        query: { range: "1d", entryDomain: "all", timeZone: "UTC" },
      },
      rebuildInput: {
        sourceId: event.sourceId,
        start: "2026-07-22T00:00:00.000Z",
        end: "2026-07-23T00:00:00.000Z",
      },
      invalidRebuildInput: {
        sourceId: "   ",
        start: "2026-07-22T00:00:00.000Z",
        end: "2026-07-23T00:00:00.000Z",
      },
      retentionScope: { sourceId: event.sourceId },
      async prepareRetention() {
        currentTime = new Date("2027-01-20T10:30:00.000Z")
      },
      expectedEntryDomain: event.entryDomain,
      expectedOtherEntryDomain: otherEntryDomainEvent.entryDomain,
      expectedExpiredEntryDomain: expiredEvent.entryDomain,
      expectedEstimatedRequests: 4,
      getOverviewObservedRequests: (overview) => overview.totals.requests,
      getOverviewOutcomeObservedRequests: (overview) =>
        overview.botBreakdowns.outcomes.reduce(
          (total, point) => total + point.observedRequests,
          0,
        ),
      getAutomationObservedRequests: (overview) =>
        overview.totals.observedRequests,
      getAutomationEstimatedRequests: (overview) =>
        overview.totals.estimatedRequests,
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
  } finally {
    database.close()
  }
})

test("groups daily series by the requested device time zone", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1SchemaMigrationProvider(database, await loadMigrations()).applySchemaMigrations()
    const store = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
      clock: () => new Date(now),
    })
    await store.ingest(event)

    const overview = await store.getOverview({
      sourceId: event.sourceId,
      query: {
        range: "7d",
        entryDomain: "all",
        timeZone: "Asia/Shanghai",
      },
    })

    assert.equal(overview.range.timeZone, "Asia/Shanghai")
    assert.deepEqual(overview.series.at(-1), {
      timestamp: "2026-07-21T16:00:00.000Z",
      requests: 1,
      entryRequests: 1,
      clicks: 1,
      entryClicks: 1,
      previews: 0,
      bots: 0,
      declaredBots: 0,
      suspectedAutomation: 0,
      errors: 0,
    })
  } finally {
    database.close()
  }
})

test("matches PostgreSQL dimension limits and required fallback values", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1SchemaMigrationProvider(database, await loadMigrations()).applySchemaMigrations()
    const store = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
      clock: () => new Date(now),
    })
    const countries = [
      "AA",
      "AB",
      "AC",
      "AD",
      "AE",
      "AF",
      "AG",
      "AH",
      "AI",
      "AJ",
      "AK",
      null,
    ] as const

    for (const [index, countryCode] of countries.entries()) {
      await store.ingest({
        ...event,
        eventId: `d1-dimension-event-${index}`,
        analyticsId: `d1-dimension-link-${index}`,
        routePath: `/dimension-${index}`,
        entryDomain: `d${index}.i0c.cc`,
        provider: `provider-${index}`,
        countryCode,
      })
    }

    const scope = {
      sourceId: event.sourceId,
      query: { range: "1d" as const, entryDomain: "all", timeZone: "UTC" },
    }
    const overview = await store.getOverview(scope)
    const automation = await store.getAutomation(scope)

    assert.equal(overview.countries.length, 11)
    assert.ok(overview.countries.some((point) => point.key === "unknown"))
    assert.equal(automation.providers.length, countries.length)
    assert.equal(automation.entryDomains.length, countries.length)
  } finally {
    database.close()
  }
})

test("rebuilds aggregates and retains them after raw-event pruning", async () => {
  const database = new SQLiteD1Database()
  try {
    await createD1SchemaMigrationProvider(database, await loadMigrations()).applySchemaMigrations()
    const store = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
      clock: () => new Date(now),
    })
    await store.ingest(event)

    const dryRun = await store.rebuildAggregates({
      sourceId: event.sourceId,
      start: "2026-07-22T00:00:00.000Z",
      end: "2026-07-23T00:00:00.000Z",
      dryRun: true,
    })
    assert.equal(dryRun.rebuilt, false)
    assert.equal(dryRun.accessEventsReplayed, 1)

    const rebuilt = await store.rebuildAggregates({
      sourceId: event.sourceId,
      start: "2026-07-22T00:00:00.000Z",
      end: "2026-07-23T00:00:00.000Z",
    })
    assert.equal(rebuilt.rebuilt, true)
    assert.equal(rebuilt.accessEventsReplayed, 1)

    const pruningStore = createD1AnalyticsStore(defaultD1AnalyticsStoreConfig, {
      database,
      clock: () => new Date("2027-01-20T10:30:00.000Z"),
    })
    const retention = await pruningStore.runRetention({ sourceId: event.sourceId })
    assert.equal(retention.deleted.accessEvents, 1)

    const events = await d1All<{ count: number }>(database.prepare(
      "SELECT COUNT(*) AS count FROM analytics_event",
    ))
    const aggregates = await d1All<{ count: number }>(database.prepare(
      "SELECT COUNT(*) AS count FROM analytics_stats_hourly",
    ))
    assert.equal(events[0]?.count, 0)
    assert.equal(aggregates[0]?.count, 1)
  } finally {
    database.close()
  }
})

async function loadMigrations(): Promise<D1SchemaMigration[]> {
  const url = new URL("../migrations/001_analytics_store.sql", import.meta.url)
  return [{
    id: "001_analytics_store.sql",
    sql: await readFile(fileURLToPath(url), "utf8"),
  }]
}
