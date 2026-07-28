import assert from "node:assert/strict"
import test from "node:test"

import {
  defineAnalyticsSinkManifest,
  defineAnalyticsStoreManifest,
  defineDataRepositoryManifest,
  defineDataSourceManifest,
  defineRuntimeFeatureManifest,
  defineRuntimePlatformManifest,
} from "../src/manifests"

const shared = {
  name: "SDK fixture",
  version: "1.0.0",
  capabilities: [],
  description: {
    summary: {
      en: "SDK manifest fixture.",
      "zh-CN": "SDK Manifest 测试夹具。",
    },
  },
  config: { version: 1 },
  secrets: {},
} as const

test("fills invariant manifest fields for every supported plugin kind", () => {
  const manifests = [
    defineDataSourceManifest({
      ...shared,
      id: "@example/source",
    }),
    defineDataRepositoryManifest({
      ...shared,
      id: "@example/repository",
    }),
    defineAnalyticsSinkManifest({
      ...shared,
      id: "@example/sink",
    }),
    defineAnalyticsStoreManifest({
      ...shared,
      id: "@example/store",
    }),
    defineRuntimeFeatureManifest({
      ...shared,
      id: "@example/feature",
      slot: "feature:sdk-fixture",
    }),
    defineRuntimePlatformManifest({
      ...shared,
      id: "@example/runtime",
      provider: "sdk-fixture",
    }),
  ]

  assert.deepEqual(
    manifests.map((manifest) => [
      manifest.apiVersion,
      manifest.kind,
      manifest.slot,
      manifest.hosts,
    ]),
    [
      [1, "data-source", "data-source", ["runtime"]],
      [1, "data-repository", "data-repository", ["webui"]],
      [1, "analytics-sink", "analytics-sink", ["runtime"]],
      [1, "analytics-store", "analytics-store", ["collector", "webui"]],
      [1, "feature", "feature:sdk-fixture", ["runtime"]],
      [1, "runtime-platform", "runtime-platform", ["runtime"]],
    ],
  )
})

test("rejects invalid author manifests immediately", () => {
  assert.throws(() => defineRuntimeFeatureManifest({
    ...shared,
    id: "Invalid ID",
  }), /Invalid plugin manifest/)
})
