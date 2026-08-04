import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@i0c/plugin-api"

import { d1AnalyticsStoreConfigSchema } from "./config"

export const D1_ANALYTICS_STORE_PLUGIN_ID = "@i0c/analytics-store-d1"

export const d1AnalyticsStoreManifest = {
  id: D1_ANALYTICS_STORE_PLUGIN_ID,
  name: "Cloudflare D1 analytics store",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  kind: "analytics-store",
  slot: "analytics-store",
  hosts: ["collector", "webui"],
  capabilities: [
    "ingest:idempotent",
    "query:traffic",
    "query:automation",
    "aggregation:hourly",
    "aggregation:daily",
    "rebuild:raw-events",
    "retention:181-days",
    "schema-migrations",
  ],
  description: {
    summary: {
      en: "Stores analytics events and rollups in Cloudflare D1.",
      "zh-CN": "将统计事件与聚合数据存储到 Cloudflare D1。",
    },
  },
  config: {
    version: 1,
    schema: d1AnalyticsStoreConfigSchema,
    ui: {
      fields: {
        retentionDays: {
          control: "number",
          label: {
            en: "Raw event retention",
            "zh-CN": "原始事件保留期",
          },
          help: {
            en: "Fixed retention window for raw analytics events.",
            "zh-CN": "原始统计事件的固定保留窗口。",
          },
          order: 10,
        },
      },
    },
  },
  secrets: {},
} as const satisfies PluginManifest
