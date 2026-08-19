import type { JsonObject } from "@nami/plugin-api"

export interface CloudflareRuntimeAdapterOptions {
  useDefaultCache: boolean
}

export const cloudflareRuntimePluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies JsonObject
