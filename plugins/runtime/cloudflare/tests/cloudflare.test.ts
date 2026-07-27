import assert from "node:assert/strict"
import test from "node:test"

import type { ExecutionContext } from "@cloudflare/workers-types"
import {
  assertPluginManifest,
  assertRuntimePlatformContract,
  assertRuntimePlatformPlugin,
} from "@i0c/plugin-testkit"

import { cloudflareRuntimeManifest } from "../src/manifest"
import { createCloudflareAdapter, runtimePlatformPlugin } from "../src/runtime"

test("declares a valid manifest and adapts Cloudflare requests", async () => {
  assertPluginManifest(cloudflareRuntimeManifest)
  assertRuntimePlatformPlugin(runtimePlatformPlugin)

  const adapter = createCloudflareAdapter(
    async (_request, context) => {
      assert.equal(context.provider, "cloudflare")
      assert.equal(context.country, "CN")
      assert.equal(context.envBindings?.I0C_SECRET, "test-key")
      assert.equal(context.readEnvironment?.("I0C_SECRET"), "test-key")
      assert.equal(typeof context.waitUntil, "function")
      return new Response("ok")
    },
    { useDefaultCache: false },
  )
  const executionContext = {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext
  const request = Object.assign(new Request("https://example.com"), {
    cf: { country: "CN" },
  })

  await assertRuntimePlatformContract({
    adapter,
    args: [
      request,
      { I0C_SECRET: "test-key" },
      executionContext,
    ],
    expectedStatus: 200,
    expectedBody: "ok",
  })
})
