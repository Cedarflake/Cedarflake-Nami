import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@i0c/plugin-api"

import { postgresDataRepositoryPluginConfigSchema } from "./config"

export const postgresDataRepositoryManifest = {
  id: "@i0c/data-repository-postgres",
  name: "PostgreSQL data repository",
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
      en: "Stores instance configuration and redirect rules as versioned PostgreSQL documents.",
      "zh-CN": "将实例配置与重定向规则作为带版本的 PostgreSQL 文档保存。",
    },
  },
  config: {
    version: 1,
    schema: postgresDataRepositoryPluginConfigSchema,
  },
  secrets: {},
} as const satisfies PluginManifest
