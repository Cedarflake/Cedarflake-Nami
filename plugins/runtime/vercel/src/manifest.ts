import {
  PLUGIN_API_VERSION,
  type RuntimePlatformManifest,
} from "@nami/plugin-api"

import { vercelRuntimePluginConfigSchema } from "./config"

export const vercelRuntimeManifest = {
  id: "@nami/runtime-vercel",
  name: "Vercel Runtime",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  provider: "vercel",
  kind: "runtime-platform",
  slot: "runtime-platform",
  hosts: ["runtime"],
  capabilities: ["edge", "country", "environment-bindings", "wait-until"],
  description: {
    summary: {
      en: "Runs the redirect Runtime on Vercel Edge Functions.",
      "zh-CN": "在 Vercel Edge Functions 上运行重定向 Runtime。",
    },
  },
  config: {
    version: 1,
    schema: vercelRuntimePluginConfigSchema,
  },
  secrets: {},
} as const satisfies RuntimePlatformManifest
