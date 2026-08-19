import assert from "node:assert/strict"
import test from "node:test"

import {
  PLUGIN_API_VERSION,
  RuntimeFeaturePipeline,
  StaticWebUiExtensionRegistry,
  StaticPluginRegistry,
  type AnalyticsSink,
  type RuntimeDataSource,
  type RuntimePlatformAdapter,
  type VersionedDataRepository,
} from "@nami/plugin-api"

import {
  assertAnalyticsSinkContract,
  assertPluginManifest,
  assertRuntimeDataSourceContract,
  assertRuntimeFeatureEventContract,
  assertRuntimePlatformContract,
  assertVersionedDataRepositoryContract,
} from "../src/index"

test("accepts a complete plugin manifest", () => {
  assert.doesNotThrow(() => {
    assertPluginManifest({
      id: "@nami/example-source",
      name: "Example source",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      kind: "data-source",
      slot: "data-source",
      hosts: ["runtime"],
      capabilities: ["config", "redirects"],
      config: {
        version: 1,
        schema: {
          type: "object",
        },
      },
      secrets: {
        token: {
          required: false,
          sensitive: true,
          defaultBinding: "EXAMPLE_TOKEN",
        },
      },
    })
  })
})

test("rejects an incompatible plugin manifest", () => {
  assert.throws(
    () => {
      assertPluginManifest({
        id: "Invalid Plugin",
        name: "",
        version: "latest",
        apiVersion: PLUGIN_API_VERSION,
        kind: "feature",
        slot: "feature:test",
        hosts: [],
        capabilities: [],
        config: {
          version: 0,
        },
        secrets: {},
      })
    },
    /Invalid plugin manifest/,
  )
})

test("resolves enabled plugins through a host-scoped static registry", () => {
  const registry = new StaticPluginRegistry([{
    id: "@nami/example-source",
    name: "Example source",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "data-source",
    slot: "data-source",
    hosts: ["runtime"],
    capabilities: ["config"],
    config: {
      version: 1,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ttl"],
        properties: {
          ttl: { type: "integer", minimum: 1 },
        },
      },
    },
    secrets: {},
  }])

  assert.deepEqual(registry.resolve("runtime", {
    "@nami/example-source": {
      enabled: true,
      version: 1,
      config: { ttl: 60 },
    },
  }), {
    status: "valid",
    plugins: [{
      manifest: registry.manifests[0],
      declaration: {
        enabled: true,
        version: 1,
        config: { ttl: 60 },
      },
    }],
  })
})

test("reports schema, missing plugin, and slot conflicts", () => {
  const sourceManifest = {
    id: "@nami/source-one",
    name: "Source one",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "data-source" as const,
    slot: "data-source" as const,
    hosts: ["runtime"] as const,
    capabilities: ["config"],
    config: {
      version: 1,
      schema: {
        type: "object",
        required: ["ttl"],
        properties: { ttl: { type: "integer", minimum: 1 } },
      },
    },
    secrets: {},
  }
  const registry = new StaticPluginRegistry([
    sourceManifest,
    { ...sourceManifest, id: "@nami/source-two", name: "Source two" },
  ])
  const result = registry.resolve("runtime", {
    "@nami/source-one": { enabled: true, config: { ttl: 0 } },
    "@nami/source-two": { enabled: true, config: { ttl: 1 } },
    "@nami/not-installed": { enabled: true },
  })

  assert.equal(result.status, "invalid")
  if (result.status === "invalid") {
    assert.match(result.issues.map((issue) => issue.message).join("\n"), /at least 1/)
    assert.match(result.issues.map((issue) => issue.message).join("\n"), /already occupied/)
    assert.match(result.issues.map((issue) => issue.message).join("\n"), /not installed/)
  }
})

test("ignores installed declarations owned by another host", () => {
  const registry = new StaticPluginRegistry([{
    id: "@nami/webui-only",
    name: "WebUI only",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "data-repository",
    slot: "data-repository",
    hosts: ["webui"],
    capabilities: ["read"],
    config: { version: 1 },
    secrets: {},
  }])

  assert.deepEqual(registry.resolve("runtime", {
    "@nami/webui-only": { enabled: true },
  }), { status: "valid", plugins: [] })
})

test("ignores recognized plugins omitted from a host projection", () => {
  const registry = new StaticPluginRegistry([{
    id: "@nami/runtime-only",
    name: "Runtime only",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "feature",
    slot: "feature:runtime-only",
    hosts: ["runtime"],
    capabilities: ["event"],
    config: { version: 1 },
    secrets: {},
  }], {
    recognizedPluginIds: ["@nami/runtime-only", "@nami/webui-only"],
  })

  assert.deepEqual(registry.resolve("runtime", {
    "@nami/webui-only": { enabled: true },
  }), {
    status: "valid",
    plugins: [],
  })
  assert.match(
    JSON.stringify(registry.resolve("runtime", {
      "@nami/not-installed": { enabled: false },
    })),
    /not installed/,
  )
})

test("checks data source values", async () => {
  const source: RuntimeDataSource<{ version: number }, { path: string }> = {
    async loadConfig() {
      return { version: 1 }
    },
    async loadRules() {
      return { path: "/" }
    },
  }

  await assertRuntimeDataSourceContract({
    source,
    expectedConfig: { version: 1 },
    expectedRules: { path: "/" },
  })
})

test("checks analytics sink delivery", async () => {
  const received: string[] = []
  const sink: AnalyticsSink<string, { prefix: string }> = {
    async emit(event, context) {
      received.push(`${context.prefix}${event}`)
    },
  }

  await assertAnalyticsSinkContract({
    sink,
    event: "event",
    context: { prefix: "test:" },
    verify() {
      assert.deepEqual(received, ["test:event"])
    },
  })
})

test("checks versioned repository reads and writes", async () => {
  interface Document {
    content: string
    version: string
  }

  let document: Document = {
    content: "before",
    version: "1",
  }

  const repository: VersionedDataRepository<
    "config",
    Record<string, never>,
    Document,
    Document,
    { version: string }
  > = {
    async read() {
      return document
    },
    async write(_kind, input) {
      document = input
      return { version: input.version }
    },
  }

  await assertVersionedDataRepositoryContract({
    repository,
    kind: "config",
    readOptions: {},
    writeInput: { content: "after", version: "2" },
    expectedBefore: { content: "before", version: "1" },
    expectedWriteResult: { version: "2" },
    expectedAfter: { content: "after", version: "2" },
  })
})

test("checks Runtime platform responses", async () => {
  const adapter: RuntimePlatformAdapter<readonly [Request]> = {
    id: "test",
    async handle(request) {
      return new Response(new URL(request.url).pathname, { status: 202 })
    },
  }

  await assertRuntimePlatformContract({
    adapter,
    args: [new Request("https://example.com/test")],
    expectedStatus: 202,
    expectedBody: "/test",
  })
})

test("checks Runtime feature event transformations", async () => {
  await assertRuntimeFeatureEventContract({
    registration: {
      id: "@nami/example-feature",
      order: 10,
      timeoutMs: 100,
      failurePolicy: "continue",
      hooks: {
        onAnalyticsEvent(event: { count: number }) {
          return { count: event.count + 1 }
        },
      },
    },
    event: { count: 1 },
    expectedEvent: { count: 2 },
  })
})

test("orders Runtime features and keeps non-critical failures open", async () => {
  const warnings: string[] = []
  const pipeline = new RuntimeFeaturePipeline<{ order: string[] }>([
    {
      id: "@nami/feature-second",
      order: 20,
      timeoutMs: 100,
      failurePolicy: "continue",
      hooks: {
        onAnalyticsEvent(event) {
          return { order: [...event.order, "second"] }
        },
      },
    },
    {
      id: "@nami/feature-failing",
      order: 10,
      timeoutMs: 100,
      failurePolicy: "continue",
      hooks: {
        onAnalyticsEvent() {
          throw new Error("expected failure")
        },
      },
    },
  ], {
    debug() {},
    info() {},
    warn(message) {
      warnings.push(message)
    },
    error() {},
  })

  assert.deepEqual(await pipeline.onAnalyticsEvent({ order: [] }), {
    order: ["second"],
  })
  assert.deepEqual(warnings, ["Runtime feature hook failed open"])
})

test("enforces Runtime feature timeouts", async () => {
  const pipeline = new RuntimeFeaturePipeline<{ reached: boolean }>([{
    id: "@nami/feature-timeout",
    order: 10,
    timeoutMs: 1,
    failurePolicy: "continue",
    hooks: {
      onAnalyticsEvent() {
        return new Promise(() => {})
      },
    },
  }])

  assert.deepEqual(await pipeline.onAnalyticsEvent({ reached: false }), {
    reached: false,
  })
})

test("orders and isolates WebUI extension slots", () => {
  const registry = new StaticWebUiExtensionRegistry([
    {
      id: "second",
      pluginId: "@nami/plugin-two",
      slot: "analytics.overview.cards",
      order: 20,
      value: "second",
    },
    {
      id: "first",
      pluginId: "@nami/plugin-one",
      slot: "analytics.overview.cards",
      order: 10,
      value: "first",
    },
    {
      id: "settings",
      pluginId: "@nami/plugin-one",
      slot: "settings.plugins",
      order: 10,
      value: "settings",
    },
  ])

  assert.deepEqual(
    registry.forSlot("analytics.overview.cards").map((item) => item.value),
    ["first", "second"],
  )
  assert.deepEqual(
    registry.forSlot("settings.plugins").map((item) => item.value),
    ["settings"],
  )
})

test("rejects duplicate WebUI extension IDs", () => {
  assert.throws(() => new StaticWebUiExtensionRegistry([
    {
      id: "duplicate",
      pluginId: "@nami/plugin-one",
      slot: "settings.plugins",
      order: 10,
      value: "first",
    },
    {
      id: "duplicate",
      pluginId: "@nami/plugin-two",
      slot: "rule-editor.fields",
      order: 20,
      value: "second",
    },
  ]), /registered more than once/)
})
