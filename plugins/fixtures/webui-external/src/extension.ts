import { defineWebUiExtension } from "@i0c/plugin-sdk/webui"

export const externalWebUiExtension = defineWebUiExtension({
  id: "@example/webui-external:settings",
  pluginId: "@example/webui-external",
  slot: "settings.plugins",
  order: 100,
  value: (_context: unknown) => "external-webui-extension",
})
