import assert from "node:assert/strict"
import test from "node:test"

import {
  defineAnalyticsStoreManifest,
  defineDataRepositoryManifest,
} from "../src/manifests"
import {
  defineWebUiAnalyticsStorePlugin,
  defineWebUiDataRepositoryPlugin,
  defineWebUiExtension,
  defineWebUiPluginInstallations,
  listDefaultWebUiPluginIds,
  listWebUiPluginManifests,
} from "../src/webui"

const repositoryManifest = defineDataRepositoryManifest({
  id: "@example/sdk-repository",
  name: "SDK repository",
  version: "1.0.0",
  capabilities: ["config:read"],
  description: {
    summary: {
      en: "SDK repository fixture.",
      "zh-CN": "SDK Repository 测试夹具。",
    },
  },
  config: { version: 1 },
  secrets: {},
})

const repositoryPlugin = defineWebUiDataRepositoryPlugin({
  manifest: repositoryManifest,
  create: () => ({
    async read() {
      throw new Error("fixture")
    },
    async write() {
      throw new Error("fixture")
    },
    async readSnapshot() {
      throw new Error("fixture")
    },
  }),
})

const storeManifest = defineAnalyticsStoreManifest({
  id: "@example/sdk-store",
  name: "SDK store",
  version: "1.0.0",
  capabilities: ["analytics:read"],
  description: {
    summary: {
      en: "SDK store fixture.",
      "zh-CN": "SDK Store 测试夹具。",
    },
  },
  config: { version: 1 },
  secrets: {},
})

const storePlugin = defineWebUiAnalyticsStorePlugin({
  manifest: storeManifest,
  create: () => null,
})

test("defines WebUI plugins and installation collections", () => {
  const installations = defineWebUiPluginInstallations({
    dataRepository: {
      ...repositoryPlugin,
      enabledByDefault: true,
    },
    analyticsStores: [],
  })

  assert.equal(
    installations.dataRepository.manifest.id,
    repositoryManifest.id,
  )
  assert.deepEqual(listWebUiPluginManifests(installations), [
    repositoryManifest,
  ])
  assert.deepEqual(listDefaultWebUiPluginIds(installations), [
    repositoryManifest.id,
  ])
})

test("rejects duplicate WebUI plugin installations", () => {
  assert.throws(
    () => defineWebUiPluginInstallations({
      dataRepository: {
        ...repositoryPlugin,
        enabledByDefault: true,
      },
      analyticsStores: [
        {
          ...storePlugin,
          enabledByDefault: true,
        },
        {
          ...storePlugin,
          enabledByDefault: false,
        },
      ],
    }),
    /installed more than once/,
  )
})

test("defines client-safe WebUI extensions", () => {
  const extension = defineWebUiExtension({
    id: "@example/sdk-extension:settings",
    pluginId: "@example/sdk-extension",
    slot: "settings.plugins",
    order: 10,
    value: "fixture",
  })

  assert.equal(extension.value, "fixture")
})

test("rejects unsupported WebUI extension slots at runtime", () => {
  assert.throws(
    () => defineWebUiExtension({
      id: "@example/sdk-extension:invalid",
      pluginId: "@example/sdk-extension",
      slot: "settings.unknown",
      order: 10,
      value: "fixture",
    } as unknown as Parameters<typeof defineWebUiExtension>[0]),
    /Unsupported WebUI extension slot/,
  )
})
