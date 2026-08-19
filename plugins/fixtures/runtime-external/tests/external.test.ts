import assert from "node:assert/strict"
import test from "node:test"

import { assertRuntimePlatformPlugin } from "@nami/plugin-testkit"

import { runtimePluginInstallations } from "../nami.runtime.config"
import { externalRuntimeFeatureManifest } from "../src/feature"
import { runtimePlatformPlugin } from "../src/runtime"

test("provides a standard external Runtime platform entry", async () => {
  assertRuntimePlatformPlugin(runtimePlatformPlugin)
  const handler = runtimePlatformPlugin.create(async (_request, context) => {
    assert.equal(context.provider, "external-edge")
    return new Response("ok")
  })
  const response = await handler(new Request("https://example.com"))
  assert.equal(await response.text(), "ok")
})

test("adds an external feature through the Runtime installation config", () => {
  assert.equal(
    runtimePluginInstallations.features.some(
      (installation) => installation.manifest.id === externalRuntimeFeatureManifest.id,
    ),
    true,
  )
})
