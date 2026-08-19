import assert from "node:assert/strict"
import test from "node:test"

import { StaticWebUiExtensionRegistry } from "@nami/plugin-api"

import { webUiExtensionInstallations } from "../webui.extensions"

test("installs an external WebUI extension through a static config", () => {
  const registry = new StaticWebUiExtensionRegistry(webUiExtensionInstallations)
  const [extension] = registry.forSlot("settings.plugins")

  assert.equal(extension?.pluginId, "@example/webui-external")
  assert.equal(extension?.value(undefined), "external-webui-extension")
})
