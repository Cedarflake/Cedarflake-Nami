import assert from "node:assert/strict"
import test from "node:test"

import {
  PLUGIN_API_VERSION,
  type RuntimePlatformManifest,
  type RuntimePlatformPlugin,
} from "@nami/plugin-api"

import { createRuntimeDeployment } from "../src/index"
import {
  defineRuntimePluginInstallations,
  listDefaultRuntimePluginIds,
  listRuntimePluginManifests,
  type RuntimeAnalyticsSinkInstallation,
  type RuntimeDataSourceInstallation,
  type RuntimeFeatureInstallation,
} from "../src/installations"

const externalManifest = {
  id: "@example/runtime-external",
  name: "External Runtime",
  version: "1.0.0",
  apiVersion: PLUGIN_API_VERSION,
  provider: "external-edge",
  kind: "runtime-platform",
  slot: "runtime-platform",
  hosts: ["runtime"],
  capabilities: ["edge"],
  config: { version: 1 },
  secrets: {},
} as const

const dataSourceInstallation = {
  bootstrapConfig: {},
  enabledByDefault: true,
  manifest: {
    id: "@example/runtime-source",
    name: "Runtime source",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "data-source",
    slot: "data-source",
    hosts: ["runtime"],
    capabilities: ["config:read"],
    config: { version: 1 },
    secrets: {},
  },
  create() {
    throw new Error("Fixture factory must not be called")
  },
} as const satisfies RuntimeDataSourceInstallation

const analyticsSinkInstallation = {
  enabledByDefault: false,
  manifest: {
    id: "@example/runtime-sink",
    name: "Runtime sink",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "analytics-sink",
    slot: "analytics-sink",
    hosts: ["runtime"],
    capabilities: ["events:write"],
    config: { version: 1 },
    secrets: {},
  },
  create() {
    throw new Error("Fixture factory must not be called")
  },
} as const satisfies RuntimeAnalyticsSinkInstallation

const featureInstallation = {
  enabledByDefault: true,
  manifest: {
    id: "@example/runtime-feature",
    name: "Runtime feature",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    kind: "feature",
    slot: "feature:fixture",
    hosts: ["runtime"],
    capabilities: ["hook:on-analytics-event"],
    config: { version: 1 },
    secrets: {},
  },
  create() {
    throw new Error("Fixture factory must not be called")
  },
} as const satisfies RuntimeFeatureInstallation

test("assembles an external platform without host-specific source code", async () => {
  const externalPlatform = {
    manifest: externalManifest,
    create(handler) {
      return (request: Request) => handler(request, {
        provider: "ignored-by-host",
      })
    },
  } satisfies RuntimePlatformPlugin<(request: Request) => Promise<Response>>

  const deployment = createRuntimeDeployment({
    platform: externalPlatform,
    installedPlatformManifests: [],
    selectedPlatformManifest: externalManifest,
    async handler(_request, context) {
      assert.equal(context.platformPluginId, externalManifest.id)
      assert.equal(context.provider, externalManifest.provider)
      assert.deepEqual(context.runtimePlatformManifests, [externalManifest])
      return new Response("ok")
    },
  })

  const response = await deployment(new Request("https://example.com"))

  assert.equal(await response.text(), "ok")
})

test("rejects drift between installation and Runtime module manifests", () => {
  const externalPlatform = {
    manifest: externalManifest,
    create() {
      return "deployment"
    },
  } satisfies RuntimePlatformPlugin<string>

  assert.throws(() => createRuntimeDeployment({
    platform: externalPlatform,
    installedPlatformManifests: [],
    selectedPlatformManifest: {
      ...externalManifest,
      provider: "different-edge",
    },
    async handler() {
      return new Response("ok")
    },
  }), /does not match its installation descriptor/)
})

test("accepts equivalent manifests with different object key order", () => {
  const reorderedManifest = {
    provider: externalManifest.provider,
    secrets: externalManifest.secrets,
    config: externalManifest.config,
    capabilities: externalManifest.capabilities,
    hosts: externalManifest.hosts,
    slot: externalManifest.slot,
    kind: externalManifest.kind,
    apiVersion: externalManifest.apiVersion,
    version: externalManifest.version,
    name: externalManifest.name,
    id: externalManifest.id,
  } as const satisfies RuntimePlatformManifest
  const externalPlatform = {
    manifest: reorderedManifest,
    create() {
      return "deployment"
    },
  } satisfies RuntimePlatformPlugin<string>

  assert.equal(createRuntimeDeployment({
    platform: externalPlatform,
    installedPlatformManifests: [],
    selectedPlatformManifest: externalManifest,
    async handler() {
      return new Response("ok")
    },
  }), "deployment")
})

test("rejects conflicting installed manifests with the selected plugin ID", () => {
  const externalPlatform = {
    manifest: externalManifest,
    create() {
      return "deployment"
    },
  } satisfies RuntimePlatformPlugin<string>

  assert.throws(() => createRuntimeDeployment({
    platform: externalPlatform,
    installedPlatformManifests: [{
      ...externalManifest,
      provider: "shadowed-edge",
    }],
    selectedPlatformManifest: externalManifest,
    async handler() {
      return new Response("ok")
    },
  }), /conflicts with another installation/)
})

test("rejects malformed manifests at the Runtime host boundary", () => {
  const invalidManifest = {
    ...externalManifest,
    hosts: ["webui"],
  } as unknown as RuntimePlatformManifest
  const externalPlatform = {
    manifest: invalidManifest,
    create() {
      return "deployment"
    },
  } satisfies RuntimePlatformPlugin<string>

  assert.throws(() => createRuntimeDeployment({
    platform: externalPlatform,
    installedPlatformManifests: [],
    selectedPlatformManifest: invalidManifest,
    async handler() {
      return new Response("ok")
    },
  }), /runtime-platform kind, slot, and host/)
})

test("lists installed Runtime plugins and their defaults", () => {
  const installations = defineRuntimePluginInstallations({
    analyticsSinks: [analyticsSinkInstallation],
    bundlePackages: ["@example/runtime-source", "@example/runtime-feature"],
    dataSource: dataSourceInstallation,
    features: [featureInstallation],
  })

  assert.deepEqual(
    listRuntimePluginManifests(installations).map((manifest) => manifest.id),
    [
      dataSourceInstallation.manifest.id,
      analyticsSinkInstallation.manifest.id,
      featureInstallation.manifest.id,
    ],
  )
  assert.deepEqual(listDefaultRuntimePluginIds(installations), [
    dataSourceInstallation.manifest.id,
    featureInstallation.manifest.id,
  ])
})

test("rejects duplicate Runtime plugin IDs", () => {
  assert.throws(() => defineRuntimePluginInstallations({
    analyticsSinks: [{
      ...analyticsSinkInstallation,
      manifest: {
        ...analyticsSinkInstallation.manifest,
        id: dataSourceInstallation.manifest.id,
      },
    }],
    bundlePackages: [],
    dataSource: dataSourceInstallation,
    features: [],
  }), /is installed more than once/)
})

test("rejects Runtime plugin manifests owned by another host", () => {
  assert.throws(() => defineRuntimePluginInstallations({
    analyticsSinks: [],
    bundlePackages: [],
    dataSource: {
      ...dataSourceInstallation,
      manifest: {
        ...dataSourceInstallation.manifest,
        hosts: ["webui"],
      },
    } as unknown as RuntimeDataSourceInstallation,
    features: [],
  }), /incompatible manifest/)
})

test("rejects malformed Runtime data-source bootstrap metadata", () => {
  assert.throws(() => defineRuntimePluginInstallations({
    analyticsSinks: [],
    bundlePackages: [],
    dataSource: {
      ...dataSourceInstallation,
      bootstrapConfig: [] as unknown as Record<string, never>,
    },
    features: [],
  }), /invalid bootstrap metadata/)
})

test("rejects duplicate Runtime bundle packages", () => {
  assert.throws(() => defineRuntimePluginInstallations({
    analyticsSinks: [],
    bundlePackages: ["@example/runtime-source", "@example/runtime-source"],
    dataSource: dataSourceInstallation,
    features: [],
  }), /bundle packages must be unique/)
})
