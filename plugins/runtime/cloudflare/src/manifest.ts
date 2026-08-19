import {
  PLUGIN_API_VERSION,
  type RuntimePlatformManifest,
} from "@nami/plugin-api"

import { cloudflareRuntimePluginConfigSchema } from "./config"

export const cloudflareRuntimeManifest = {
  id: "@nami/runtime-cloudflare",
  name: "Cloudflare Runtime",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  provider: "cloudflare",
  kind: "runtime-platform",
  slot: "runtime-platform",
  hosts: ["runtime"],
  capabilities: ["edge", "cache-api", "country", "wait-until"],
  description: {
    summary: {
      en: "Runs the redirect Runtime on Cloudflare Workers.",
      "zh-CN": "在 Cloudflare Workers 上运行重定向 Runtime。",
    },
  },
  config: {
    version: 1,
    schema: cloudflareRuntimePluginConfigSchema,
  },
  secrets: {},
} as const satisfies RuntimePlatformManifest
