import assert from "node:assert/strict"
import test from "node:test"

import { defaultDataConfig } from "@nami/config"
import type { RuntimePlatformManifest } from "@nami/plugin-api"
import { runtimePluginInstallations } from "@nami/runtime-config"

import { resolveRuntimePluginConfigurations } from "../../src/plugins/registry"

const platformManifest = {
  id: "@example/runtime-duplicate",
  name: "Runtime Duplicate",
  version: "1.0.0",
  apiVersion: 1,
  provider: "runtime-duplicate",
  kind: "runtime-platform",
  slot: "runtime-platform",
  hosts: ["runtime"],
  capabilities: ["request-adapter"],
  config: { version: 1 },
  secrets: {},
} as const satisfies RuntimePlatformManifest

test("rejects duplicate platform manifests instead of silently replacing one", () => {
  assert.throws(
    () => resolveRuntimePluginConfigurations(defaultDataConfig, {
      platformPluginId: platformManifest.id,
      pluginInstallations: runtimePluginInstallations,
      runtimePlatformManifests: [
        platformManifest,
        {
          ...platformManifest,
          name: "Shadowed Runtime Duplicate",
        },
      ],
    }),
    /plugin ID is registered more than once/,
  )
})
