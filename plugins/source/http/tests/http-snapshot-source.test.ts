import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultDataConfig,
  type DataConfig,
  type RuntimeDataSnapshot,
} from "@nami/config"
import type { PluginLogger } from "@nami/plugin-api"
import {
  assertPluginManifest,
  assertRuntimeDataSourceContract,
} from "@nami/plugin-testkit"

import { httpSnapshotSourceManifest } from "../src/manifest"
import { createHttpSnapshotDataSource } from "../src/runtime"

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
} satisfies PluginLogger

test("declares a valid HTTP snapshot source manifest", () => {
  assertPluginManifest(httpSnapshotSourceManifest)
})

test("loads config and rules from the same deduplicated snapshot", async () => {
  const snapshot = createSnapshot("revision-1", "https://example.com/v1")
  let currentConfig: DataConfig = defaultDataConfig
  let fetchCalls = 0
  const source = createHttpSnapshotDataSource(
    createBootstrapConfig("https://example.com/atomic-snapshot"),
    {
      async fetchImpl() {
        fetchCalls += 1
        return Response.json(snapshot, {
          headers: { ETag: "\"revision-1\"" },
        })
      },
      logger,
      now: () => 0,
      setCurrentDataConfig(config) {
        currentConfig = config
      },
    },
  )

  await assertRuntimeDataSourceContract({
    source,
    expectedConfig: snapshot.config,
    expectedRules: snapshot.redirects,
  })

  assert.equal(fetchCalls, 1)
  assert.deepEqual(currentConfig, snapshot.config)
})

test("revalidates an expired snapshot with its ETag", async () => {
  let now = 0
  let fetchCalls = 0
  const snapshot = createSnapshot(
    "revision-etag",
    "https://example.com/etag",
    createShortTtlConfig(),
  )
  const source = createHttpSnapshotDataSource(
    createBootstrapConfig("https://example.com/etag-snapshot"),
    {
      async fetchImpl(input, init) {
        fetchCalls += 1
        const request = new Request(input, init)
        if (fetchCalls === 1) {
          assert.equal(request.headers.get("if-none-match"), null)
          return Response.json(snapshot, {
            headers: { ETag: "\"revision-etag\"" },
          })
        }
        assert.equal(request.headers.get("if-none-match"), "\"revision-etag\"")
        return new Response(null, { status: 304 })
      },
      logger,
      now: () => now,
      setCurrentDataConfig() {},
    },
  )

  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  now = 1_001
  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  assert.equal(fetchCalls, 2)
})

test("keeps the last valid snapshot when a candidate is invalid", async () => {
  let now = 0
  let fetchCalls = 0
  const snapshot = createSnapshot(
    "revision-valid",
    "https://example.com/valid",
    createShortTtlConfig(),
  )
  const source = createHttpSnapshotDataSource(
    createBootstrapConfig("https://example.com/last-valid-snapshot"),
    {
      async fetchImpl() {
        fetchCalls += 1
        return fetchCalls === 1
          ? Response.json(snapshot)
          : Response.json({
              ...snapshot,
              revision: "revision-invalid",
              config: { schemaVersion: 2 },
            })
      },
      logger,
      now: () => now,
      setCurrentDataConfig() {},
    },
  )

  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  now = 1_001
  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  assert.equal(fetchCalls, 2)
})

test("bounds transient retries and then backs off", async () => {
  let fetchCalls = 0
  const source = createHttpSnapshotDataSource(
    {
      ...createBootstrapConfig("https://example.com/retry-snapshot"),
      maximumFetchAttempts: 2,
    },
    {
      async fetchImpl() {
        fetchCalls += 1
        return new Response(null, { status: 503 })
      },
      logger,
      now: () => 0,
      setCurrentDataConfig() {},
    },
  )

  assert.equal(await source.loadConfig(), null)
  assert.equal(await source.loadConfig(), null)
  assert.equal(fetchCalls, 2)
})

test("uses a valid platform cache before making a network request", async () => {
  const snapshot = createSnapshot(
    "revision-platform-cache",
    "https://example.com/cached",
  )
  let fetchCalls = 0
  const source = createHttpSnapshotDataSource(
    createBootstrapConfig("https://example.com/platform-cache-snapshot"),
    {
      cache: {
        async match() {
          return Response.json(snapshot, {
            headers: { ETag: "\"revision-platform-cache\"" },
          })
        },
        async put() {},
      },
      async fetchImpl() {
        fetchCalls += 1
        throw new Error("Network fetch must not run")
      },
      logger,
      now: () => 0,
      setCurrentDataConfig() {},
    },
  )

  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  assert.equal(fetchCalls, 0)
})

test("ignores an invalid platform cache and fetches a valid snapshot", async () => {
  const snapshot = createSnapshot(
    "revision-network",
    "https://example.com/network",
  )
  let fetchCalls = 0
  const source = createHttpSnapshotDataSource(
    createBootstrapConfig("https://example.com/invalid-platform-cache"),
    {
      cache: {
        async match() {
          return Response.json({ schemaVersion: 2 })
        },
        async put() {},
      },
      async fetchImpl() {
        fetchCalls += 1
        return Response.json(snapshot)
      },
      logger,
      now: () => 0,
      setCurrentDataConfig() {},
    },
  )

  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  assert.equal(fetchCalls, 1)
})

test("aborts timed-out requests without replacing the last valid snapshot", async () => {
  let now = 0
  let fetchCalls = 0
  const snapshot = createSnapshot(
    "revision-before-timeout",
    "https://example.com/before-timeout",
    createShortTtlConfig(),
  )
  const source = createHttpSnapshotDataSource(
    {
      ...createBootstrapConfig("https://example.com/timeout-snapshot"),
      requestTimeoutMs: 5,
      maximumFetchAttempts: 1,
    },
    {
      fetchImpl: async (_input, init) => {
        fetchCalls += 1
        if (fetchCalls === 1) {
          return Response.json(snapshot)
        }
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason)
          }, { once: true })
        })
      },
      logger,
      now: () => now,
      setCurrentDataConfig() {},
    },
  )

  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  now = 1_001
  assert.deepEqual(await source.loadRules(), snapshot.redirects)
  assert.equal(fetchCalls, 2)
})

function createBootstrapConfig(
  snapshotUrl: string,
) {
  return {
    snapshotUrl,
    requestTimeoutMs: 1_000,
    maximumFetchAttempts: 1,
    failureBackoffSeconds: 30,
  }
}

function createShortTtlConfig(): DataConfig {
  return {
    ...defaultDataConfig,
    runtime: {
      ...defaultDataConfig.runtime,
      configCacheTtlSeconds: 1,
      redirectsCacheTtlSeconds: 1,
    },
  }
}

function createSnapshot(
  revision: string,
  target: string,
  config: DataConfig = defaultDataConfig,
): RuntimeDataSnapshot {
  return {
    schemaVersion: 1,
    revision,
    config,
    redirects: {
      Slots: {
        Main: {
          "/": target,
        },
      },
    },
  }
}
