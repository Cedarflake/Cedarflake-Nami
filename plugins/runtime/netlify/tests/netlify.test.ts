import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPluginManifest,
  assertRuntimePlatformContract,
  assertRuntimePlatformPlugin,
} from "@nami/plugin-testkit"

import { netlifyRuntimeManifest } from "../src/manifest"
import { createNetlifyAdapter, runtimePlatformPlugin } from "../src/runtime"

test("declares a valid manifest and adapts Netlify requests", async () => {
  assertPluginManifest(netlifyRuntimeManifest)
  assertRuntimePlatformPlugin(runtimePlatformPlugin)

  const adapter = createNetlifyAdapter(
    async (_request, context) => {
      assert.equal(context.provider, "netlify")
      assert.equal(context.country, "CN")
      assert.equal(context.readEnvironment?.("NAMI_SECRET"), "test-key")
      return new Response("ok")
    },
    { readEnvironment: () => "test-key" },
  )

  await assertRuntimePlatformContract({
    adapter,
    args: [
      new Request("https://example.com"),
      { geo: { country: { code: "CN" } } },
    ],
    expectedStatus: 200,
    expectedBody: "ok",
  })
})
