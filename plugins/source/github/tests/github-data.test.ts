import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import test from "node:test"

import { defaultDataConfig, type DataConfig } from "@i0c/config"
import type { PluginLogger } from "@i0c/plugin-api"
import {
  assertPluginManifest,
  assertRuntimeDataSourceContract,
  assertVersionedDataRepositoryContract,
} from "@i0c/plugin-testkit"

import {
  githubContentsRepositoryManifest,
  githubRawSourceManifest,
} from "../src/manifest"
import { createGitHubRawDataSource } from "../src/runtime"
import { createGitHubContentsRepository } from "../src/webui"

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
} satisfies PluginLogger

test("declares valid source and repository manifests", () => {
  assertPluginManifest(githubRawSourceManifest)
  assertPluginManifest(githubContentsRepositoryManifest)
})

test("loads data config and redirects through the source contract", async () => {
  let currentConfig: DataConfig = defaultDataConfig
  const source = createGitHubRawDataSource(
    {
      dataConfigUrl: "https://example.com/plugin-test/config.json",
      redirectsConfigUrl: "https://example.com/plugin-test/redirects.json",
      dataConfigCacheTtlSeconds: 60,
      redirectsCacheTtlSeconds: 60,
      configFailureBackoffSeconds: 30,
      redirectsFailureBackoffSeconds: 10,
    },
    {
      async fetchImpl(input) {
        return String(input).endsWith("config.json")
          ? Response.json(defaultDataConfig)
          : Response.json({ Slots: { Main: { "/": "https://example.com" } } })
      },
      getCurrentDataConfig: () => currentConfig,
      logger,
      now: () => 0,
      setCurrentDataConfig(config) {
        currentConfig = config
      },
    },
  )

  await assertRuntimeDataSourceContract({
    source,
    expectedConfig: defaultDataConfig,
    expectedRules: {
      Slots: {
        Main: {
          "/": "https://example.com",
        },
      },
    },
  })
})

test("keeps the last valid redirects when a remote candidate is invalid", async () => {
  let currentTime = 0
  let redirectReads = 0
  let currentConfig: DataConfig = {
    ...defaultDataConfig,
    runtime: {
      ...defaultDataConfig.runtime,
      redirectsCacheTtlSeconds: 1,
    },
  }
  const validRules = {
    Slots: {
      Main: {
        "/": "https://example.com",
      },
    },
  }
  const source = createGitHubRawDataSource(
    {
      dataConfigUrl: "https://example.com/invalid-rules-test/config.json",
      redirectsConfigUrl: "https://example.com/invalid-rules-test/redirects.json",
      dataConfigCacheTtlSeconds: 60,
      redirectsCacheTtlSeconds: 1,
      configFailureBackoffSeconds: 30,
      redirectsFailureBackoffSeconds: 10,
    },
    {
      async fetchImpl(input) {
        if (String(input).endsWith("config.json")) {
          return Response.json(currentConfig)
        }

        redirectReads += 1
        return redirectReads === 1
          ? Response.json(validRules)
          : Response.json({
              Slots: {
                Main: {
                  "/": {
                    type: "proxy",
                    target: "/relative-upstream",
                  },
                },
              },
            })
      },
      getCurrentDataConfig: () => currentConfig,
      logger,
      now: () => currentTime,
      setCurrentDataConfig(config) {
        currentConfig = config
      },
    },
  )

  assert.deepEqual(await source.loadRules(), validRules)
  currentTime = 2_000
  assert.deepEqual(await source.loadRules(), validRules)
  assert.equal(redirectReads, 2)
})

test("serializes platform cache writes so an older candidate cannot win", async () => {
  let currentTime = 0
  let redirectReads = 0
  const currentConfig: DataConfig = {
    ...defaultDataConfig,
    runtime: {
      ...defaultDataConfig.runtime,
      redirectsCacheTtlSeconds: 1,
    },
  }
  const scheduled: Promise<unknown>[] = []
  const writtenTargets: string[] = []
  let releaseFirstWrite: (() => void) | undefined
  let releaseSecondWrite: (() => void) | undefined
  let markFirstWriteStarted: (() => void) | undefined
  let markSecondWriteStarted: (() => void) | undefined
  const firstWriteStarted = new Promise<void>((resolve) => {
    markFirstWriteStarted = resolve
  })
  const secondWriteStarted = new Promise<void>((resolve) => {
    markSecondWriteStarted = resolve
  })
  const firstWriteRelease = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve
  })
  const secondWriteRelease = new Promise<void>((resolve) => {
    releaseSecondWrite = resolve
  })
  const source = createGitHubRawDataSource(
    {
      dataConfigUrl: "https://example.com/cache-order-test/config.json",
      redirectsConfigUrl: "https://example.com/cache-order-test/redirects.json",
      dataConfigCacheTtlSeconds: 60,
      redirectsCacheTtlSeconds: 1,
      configFailureBackoffSeconds: 30,
      redirectsFailureBackoffSeconds: 10,
    },
    {
      cache: {
        async match() {
          return null
        },
        async put(_request, response) {
          const target = (await response.json() as {
            Slots: { Main: { "/": string } }
          }).Slots.Main["/"]
          writtenTargets.push(target)
          if (writtenTargets.length === 1) {
            markFirstWriteStarted?.()
            await firstWriteRelease
          } else {
            markSecondWriteStarted?.()
            await secondWriteRelease
          }
        },
      },
      async fetchImpl(input) {
        if (String(input).endsWith("config.json")) {
          return Response.json(currentConfig)
        }
        redirectReads += 1
        return Response.json({
          Slots: {
            Main: {
              "/": `https://example.com/version-${redirectReads}`,
            },
          },
        })
      },
      getCurrentDataConfig: () => currentConfig,
      logger,
      now: () => currentTime,
      setCurrentDataConfig() {},
      waitUntil(promise) {
        scheduled.push(promise)
      },
    },
  )

  await source.loadRules()
  await firstWriteStarted
  currentTime = 2_000
  await source.loadRules()
  assert.deepEqual(writtenTargets, ["https://example.com/version-1"])

  releaseFirstWrite?.()
  await secondWriteStarted
  assert.deepEqual(writtenTargets, [
    "https://example.com/version-1",
    "https://example.com/version-2",
  ])
  releaseSecondWrite?.()
  await Promise.all(scheduled)
})

test("bypasses framework caching for authoritative config reads", async () => {
  const repository = createGitHubContentsRepository(
    {
      owner: "Revaea",
      repository: "i0c.cc",
      branch: "data",
      configPath: "config.json",
      redirectsPath: "redirects.json",
      publicRevalidateSeconds: 60,
    },
    {
      async fetchImpl(_input, init) {
        assert.equal(init?.cache, "no-store")
        assert.equal(init?.next, undefined)
        return Response.json({
          content: Buffer.from("{}", "utf8").toString("base64"),
          sha: "1",
          path: "config.json",
        })
      },
    },
  )

  await repository.read("config", { cacheMode: "no-store" })
})

test("attaches host cache tags to anonymous GitHub reads", async () => {
  const repository = createGitHubContentsRepository(
    {
      owner: "Revaea",
      repository: "i0c.cc",
      branch: "data",
      configPath: "config.json",
      redirectsPath: "redirects.json",
      publicRevalidateSeconds: 60,
    },
    {
      async fetchImpl(_input, init) {
        assert.equal(init?.cache, undefined)
        assert.deepEqual(init?.next, {
          revalidate: 60,
          tags: ["i0c:data-config"],
        })
        return Response.json({
          content: Buffer.from("{}", "utf8").toString("base64"),
          sha: "1",
          path: "config.json",
        })
      },
    },
  )

  await repository.read("config", {
    cacheTags: ["i0c:data-config"],
  })
})

test("reads and writes versioned GitHub documents through the repository contract", async () => {
  let content = "before"
  let sha = "1"
  const repository = createGitHubContentsRepository(
    {
      owner: "Revaea",
      repository: "i0c.cc",
      branch: "data",
      configPath: "config.json",
      redirectsPath: "redirects.json",
      publicRevalidateSeconds: 60,
    },
    {
      async fetchImpl(_input, init) {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body)) as {
            content: string
            sha: string
          }
          assert.equal(body.sha, sha)
          content = Buffer.from(body.content, "base64").toString("utf8")
          sha = "2"
          return Response.json({
            content: { sha },
            commit: { html_url: "https://github.com/Revaea/i0c.cc/commit/2" },
          })
        }

        return Response.json({
          content: Buffer.from(content, "utf8").toString("base64"),
          sha,
          path: "config.json",
        })
      },
    },
  )

  await assertVersionedDataRepositoryContract({
    repository,
    kind: "config",
    readOptions: {},
    writeInput: {
      content: "after",
      credential: "test-token",
      expectedRevision: "1",
    },
    expectedBefore: {
      content: "before",
      lastModified: undefined,
      revision: "1",
      sourcePath: "config.json",
      sourceUrl: undefined,
    },
    expectedWriteResult: {
      revision: "2",
      revisionUrl: "https://github.com/Revaea/i0c.cc/commit/2",
    },
    expectedAfter: {
      content: "after",
      lastModified: undefined,
      revision: "2",
      sourcePath: "config.json",
      sourceUrl: undefined,
    },
  })
})

test("reads an atomic GitHub snapshot from one commit", async () => {
  const requestedRefs: string[] = []
  const repository = createGitHubContentsRepository(
    {
      owner: "Revaea",
      repository: "i0c.cc",
      branch: "data",
      configPath: "config.json",
      redirectsPath: "redirects.json",
      publicRevalidateSeconds: 60,
    },
    {
      async fetchImpl(input) {
        const url = new URL(String(input))
        if (url.pathname.endsWith("/commits/data")) {
          return Response.json({ sha: "commit-1" })
        }
        requestedRefs.push(url.searchParams.get("ref") ?? "")
        const isConfig = url.pathname.endsWith("/contents/config.json")
        return Response.json({
          content: Buffer.from(
            isConfig ? "{\"schemaVersion\":1}" : "{\"Slots\":{}}",
            "utf8",
          ).toString("base64"),
          sha: isConfig ? "config-blob" : "redirects-blob",
          path: isConfig ? "config.json" : "redirects.json",
        })
      },
    },
  )

  const snapshot = await repository.readSnapshot({ cacheMode: "no-store" })

  assert.equal(snapshot.revision, "commit-1")
  assert.equal(snapshot.config.revision, "config-blob")
  assert.equal(snapshot.redirects.revision, "redirects-blob")
  assert.deepEqual(requestedRefs, ["commit-1", "commit-1"])
})
