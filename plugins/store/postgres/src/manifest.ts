import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@i0c/plugin-api"

import { postgresAnalyticsStoreConfigSchema } from "./config"

export const POSTGRES_ANALYTICS_STORE_PLUGIN_ID = "@i0c/analytics-store-postgres"

export const postgresAnalyticsStoreManifest = {
  id: POSTGRES_ANALYTICS_STORE_PLUGIN_ID,
  name: "PostgreSQL analytics store",
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
      en: "Stores analytics events and rollups in PostgreSQL-compatible databases.",
      "zh-CN": "将统计事件与聚合数据存储到 PostgreSQL 兼容数据库。",
    },
  },
  config: {
    version: 1,
    schema: postgresAnalyticsStoreConfigSchema,
    ui: {
      fields: {
        maxConnections: {
          control: "number",
          label: {
            en: "Maximum connections",
            "zh-CN": "最大连接数",
          },
          help: {
            en: "Upper bound for database connections opened by the store.",
            "zh-CN": "统计存储允许打开的数据库连接上限。",
          },
          order: 10,
        },
        idleTimeoutSeconds: {
          control: "number",
          label: {
            en: "Idle timeout",
            "zh-CN": "空闲超时",
          },
          help: {
            en: "Close idle production database connections after this many seconds.",
            "zh-CN": "生产环境数据库连接空闲超过该秒数后关闭。",
          },
          order: 20,
        },
        developmentIdleTimeoutSeconds: {
          control: "number",
          label: {
            en: "Development idle timeout",
            "zh-CN": "开发空闲超时",
          },
          help: {
            en: "Separate idle timeout used in local development.",
            "zh-CN": "本地开发环境使用的独立空闲超时。",
          },
          order: 30,
        },
        connectTimeoutSeconds: {
          control: "number",
          label: {
            en: "Connection timeout",
            "zh-CN": "连接超时",
          },
          help: {
            en: "Abort database connection attempts after this many seconds.",
            "zh-CN": "数据库连接尝试超过该秒数后中止。",
          },
          order: 40,
        },
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
          order: 50,
        },
      },
    },
  },
  secrets: {
    databaseUrl: {
      required: true,
      sensitive: true,
      defaultBinding: "DATABASE_URL",
      description: "PostgreSQL connection string used by the analytics store.",
      label: {
        en: "Database URL binding",
        "zh-CN": "数据库地址绑定",
      },
      help: {
        en: "Environment variable name for the PostgreSQL connection string.",
        "zh-CN": "填写 PostgreSQL 连接字符串所对应的环境变量名称。",
      },
      order: 100,
    },
  },
} as const satisfies PluginManifest
