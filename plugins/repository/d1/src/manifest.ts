import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@nami/plugin-api"

import { d1DataRepositoryPluginConfigSchema } from "./config"

export const d1DataRepositoryManifest = {
  id: "@nami/data-repository-d1",
  name: "Cloudflare D1 data repository",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  kind: "data-repository",
  slot: "data-repository",
  hosts: ["webui"],
  capabilities: [
    "config:read",
    "config:write",
    "redirects:read",
    "redirects:write",
    "snapshot:atomic",
    "version:optimistic",
  ],
  description: {
    summary: {
      en: "Stores instance configuration and redirect rules as versioned Cloudflare D1 documents.",
      "zh-CN": "将实例配置与重定向规则作为带版本的 Cloudflare D1 文档保存。",
    },
  },
  config: {
    version: 1,
    schema: d1DataRepositoryPluginConfigSchema,
  },
  secrets: {},
} as const satisfies PluginManifest
