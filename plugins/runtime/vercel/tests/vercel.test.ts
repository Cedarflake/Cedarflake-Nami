import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPluginManifest,
  assertRuntimePlatformContract,
  assertRuntimePlatformPlugin,
} from "@i0c/plugin-testkit"

import { vercelRuntimeManifest } from "../src/manifest"
import { createVercelAdapter, runtimePlatformPlugin } from "../src/runtime"

test("declares a valid manifest and adapts Vercel requests", async () => {
  assertPluginManifest(vercelRuntimeManifest)
  assertRuntimePlatformPlugin(runtimePlatformPlugin)

  const adapter = createVercelAdapter(
    async (_request, context) => {
      assert.equal(context.provider, "vercel")
      assert.equal(context.country, "CN")
      assert.equal(context.readEnvironment?.("I0C_SECRET"), "test-key")
      return new Response("ok")
    },
    {
      readEnvironment: () => "test-key",
      waitUntil() {},
    },
  )

  await assertRuntimePlatformContract({
    adapter,
    args: [
      new Request("https://example.com", {
        headers: { "x-vercel-ip-country": "CN" },
      }),
    ],
    expectedStatus: 200,
    expectedBody: "ok",
  })
})
