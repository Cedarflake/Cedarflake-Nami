import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@nami/plugin-api"

import { httpSnapshotSourcePluginConfigSchema } from "./config"

export const httpSnapshotSourceManifest = {
  id: "@nami/http-snapshot-source",
  name: "HTTP snapshot data source",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  kind: "data-source",
  slot: "data-source",
  hosts: ["runtime"],
  capabilities: [
    "config:read",
    "redirects:read",
    "snapshot:atomic",
    "http:etag",
    "cache:last-valid",
    "retry:transient",
    "timeout:abort",
  ],
  description: {
    summary: {
      en: "Reads one atomic Runtime configuration and redirect snapshot from an HTTPS endpoint.",
      "zh-CN": "从 HTTPS 端点读取同一份原子 Runtime 配置与重定向规则快照。",
    },
  },
  config: {
    version: 1,
    schema: httpSnapshotSourcePluginConfigSchema,
  },
  secrets: {},
} as const satisfies PluginManifest
