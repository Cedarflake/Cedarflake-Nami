import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { assertPluginManifest } from "@nami/plugin-testkit"

import { defaultPostgresAnalyticsStoreConfig } from "../src/config"
import { postgresAnalyticsStoreManifest } from "../src/manifest"
import { createPostgresAnalyticsStore } from "../src/store"

test("declares a valid PostgreSQL store manifest", () => {
  assertPluginManifest(postgresAnalyticsStoreManifest)
})

test("reports a missing database secret without connecting", async () => {
  const store = createPostgresAnalyticsStore(
    defaultPostgresAnalyticsStoreConfig,
    { connectionString: null, development: false },
  )

  assert.equal(store.configured, false)
  assert.deepEqual(await store.healthCheck(), {
    status: "unhealthy",
    message: "DATABASE_URL is not configured",
  })
})

test("treats a whitespace-only database secret as unconfigured", () => {
  const store = createPostgresAnalyticsStore(
    defaultPostgresAnalyticsStoreConfig,
    { connectionString: "   ", development: false },
  )

  assert.equal(store.configured, false)
})

test("rejects an empty retention source instead of pruning every source", async () => {
  const store = createPostgresAnalyticsStore(
    defaultPostgresAnalyticsStoreConfig,
    { connectionString: null, development: false },
  )

  await assert.rejects(
    store.runRetention({ sourceId: "  " }),
    /sourceId must not be empty/,
  )
})

test("owns the ordered PostgreSQL migration set", async () => {
  const directory = fileURLToPath(new URL("../migrations/", import.meta.url))
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+.*\.sql$/.test(filename))
    .sort((left, right) => left.localeCompare(right))

  assert.deepEqual(filenames, [
    "001_short_link_analytics.sql",
    "002_domain_attribution.sql",
    "003_runtime_traffic_analysis.sql",
    "004_raw_event_retention.sql",
    "005_aggregate_rebuild.sql",
    "006_open_runtime_providers.sql",
  ])

  for (const filename of filenames) {
    assert.ok((await readFile(new URL(filename, new URL("../migrations/", import.meta.url)), "utf8")).trim())
  }
})
