import {
  PLUGIN_API_VERSION,
  type RuntimePlatformManifest,
} from "@nami/plugin-api"

import { netlifyRuntimePluginConfigSchema } from "./config"

export const netlifyRuntimeManifest = {
  id: "@nami/runtime-netlify",
  name: "Netlify Runtime",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  provider: "netlify",
  kind: "runtime-platform",
  slot: "runtime-platform",
  hosts: ["runtime"],
  capabilities: ["edge", "country", "environment-bindings", "wait-until"],
  description: {
    summary: {
      en: "Runs the redirect Runtime on Netlify Edge Functions.",
      "zh-CN": "在 Netlify Edge Functions 上运行重定向 Runtime。",
    },
  },
  config: {
    version: 1,
    schema: netlifyRuntimePluginConfigSchema,
  },
  secrets: {},
} as const satisfies RuntimePlatformManifest
