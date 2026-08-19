import assert from "node:assert/strict"
import test from "node:test"

import { PLUGIN_API_VERSION } from "@nami/plugin-api"

import {
  assertRuntimePlatformModuleMatchesInstallation,
  defineRuntimeInstallationConfig,
  defineRuntimePlatformInstallation,
  resolveRuntimePlatformInstallation,
  type RuntimePlatformInstallation,
} from "../src/config"

const externalPlatform = defineRuntimePlatformInstallation({
  key: "external",
  manifest: {
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
  },
  runtimeModule: "@example/runtime-external/runtime",
  bundlePackages: ["@example/runtime-external"],
  outputEntry: "platforms/external",
})

test("accepts an external Runtime platform installation", () => {
  const config = defineRuntimeInstallationConfig({
    platforms: [externalPlatform],
  })

  assert.equal(
    resolveRuntimePlatformInstallation(config, "external"),
    externalPlatform,
  )
})

test("rejects duplicate providers", () => {
  assert.throws(() => defineRuntimeInstallationConfig({
    platforms: [
      externalPlatform,
      {
        ...externalPlatform,
        key: "external-copy",
        manifest: {
          ...externalPlatform.manifest,
          id: "@example/runtime-external-copy",
        },
      },
    ],
  }), /provider external-edge is duplicated/)
})

test("rejects a platform ID reserved by the Runtime host", () => {
  assert.throws(() => defineRuntimeInstallationConfig({
    reservedPluginIds: ["@nami/github-raw-source"],
    platforms: [{
      ...externalPlatform,
      manifest: {
        ...externalPlatform.manifest,
        id: "@nami/github-raw-source",
      },
    }],
  }), /plugin ID @nami\/github-raw-source is duplicated/)
})

test("rejects a non-platform manifest in a Runtime installation", () => {
  const invalidInstallation = {
    ...externalPlatform,
    manifest: {
      id: externalPlatform.manifest.id,
      name: externalPlatform.manifest.name,
      version: externalPlatform.manifest.version,
      apiVersion: externalPlatform.manifest.apiVersion,
      kind: "feature",
      slot: "feature:test",
      hosts: externalPlatform.manifest.hosts,
      capabilities: externalPlatform.manifest.capabilities,
      config: externalPlatform.manifest.config,
      secrets: externalPlatform.manifest.secrets,
    },
  } as unknown as RuntimePlatformInstallation

  assert.throws(
    () => defineRuntimePlatformInstallation(invalidInstallation),
    /runtime-platform kind, slot, and host/,
  )
})

test("rejects a Runtime output entry that escapes its output directory", () => {
  assert.throws(() => defineRuntimePlatformInstallation({
    ...externalPlatform,
    outputEntry: "../escaped",
  }), /safe relative path/)
})

test("rejects Runtime modules that are not installed package specifiers", () => {
  for (const runtimeModule of [
    " @example/runtime-external/runtime",
    "../runtime-external/runtime",
    "https://example.com/runtime.js",
  ]) {
    assert.throws(() => defineRuntimePlatformInstallation({
      ...externalPlatform,
      runtimeModule,
    }), /installed package specifier/)
  }

  assert.throws(() => defineRuntimePlatformInstallation({
    ...externalPlatform,
    bundlePackages: ["../runtime-external"],
  }), /bundle packages must use package specifiers/)
})

test("rejects malformed JavaScript installation descriptors deterministically", () => {
  assert.throws(
    () => defineRuntimePlatformInstallation({
      manifest: {
        id: "@example/runtime-malformed",
      },
    } as unknown as RuntimePlatformInstallation),
    /name must not be empty/,
  )
})

test("rejects a Runtime module whose manifest drifts from its installation", () => {
  assert.throws(
    () => assertRuntimePlatformModuleMatchesInstallation({
      runtimePlatformPlugin: {
        create() {
          return undefined
        },
        manifest: {
          ...externalPlatform.manifest,
          provider: "drifted-edge",
        },
      },
    }, externalPlatform),
    /does not match its installation descriptor/,
  )
})
