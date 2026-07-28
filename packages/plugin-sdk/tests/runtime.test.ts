import assert from "node:assert/strict"
import test from "node:test"

import { defineRuntimeFeatureManifest } from "../src/manifests"
import {
  defineRuntimeFeaturePlugin,
  defineRuntimePlatformPlugin,
} from "../src/runtime"

const featureManifest = defineRuntimeFeatureManifest({
  id: "@example/sdk-feature",
  name: "SDK feature",
  version: "1.0.0",
  slot: "feature:sdk",
  capabilities: ["hook:on-analytics-event"],
  description: {
    summary: {
      en: "SDK feature fixture.",
      "zh-CN": "SDK Feature 测试夹具。",
    },
  },
  config: { version: 1 },
  secrets: {},
})

test("defines host-compatible Runtime plugins", async () => {
  const feature = defineRuntimeFeaturePlugin({
    manifest: featureManifest,
    create: () => ({
      id: featureManifest.id,
      order: 10,
      timeoutMs: 20,
      failurePolicy: "continue",
      hooks: {},
    }),
  })
  const registration = feature.create()

  assert.equal(registration.id, featureManifest.id)

  const platform = defineRuntimePlatformPlugin({
    manifest: {
      id: "@example/sdk-runtime",
      name: "SDK Runtime",
      version: "1.0.0",
      apiVersion: 1,
      kind: "runtime-platform",
      slot: "runtime-platform",
      hosts: ["runtime"],
      capabilities: [],
      description: {
        summary: {
          en: "SDK Runtime fixture.",
          "zh-CN": "SDK Runtime 测试夹具。",
        },
      },
      config: { version: 1 },
      secrets: {},
      provider: "sdk-runtime",
    },
    create: (handler) => (request: Request) => handler(request, {
      provider: "sdk-runtime",
    }),
  })
  const response = await platform.create(
    async () => new Response("ok"),
  )(new Request("https://example.com"))

  assert.equal(await response.text(), "ok")
})
