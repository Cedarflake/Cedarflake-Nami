import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@nami/plugin-api"

import { botClassifierConfigSchema } from "./config"

export const BOT_CLASSIFIER_PLUGIN_ID = "@nami/feature-bot-classifier"

export const botClassifierManifest = {
  id: BOT_CLASSIFIER_PLUGIN_ID,
  name: "Privacy-safe bot classifier",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  kind: "feature",
  slot: "feature:bot-classifier",
  hosts: ["runtime"],
  capabilities: ["hook:on-analytics-event", "classification:privacy-safe"],
  description: {
    summary: {
      en: "Classifies analytics events as browser traffic, declared bots, or suspected automation without storing personal identifiers.",
      "zh-CN": "在不保存个人标识的前提下，将统计事件分类为浏览器流量、已声明机器人或疑似自动化。",
    },
  },
  config: {
    version: 1,
    schema: botClassifierConfigSchema,
    ui: {
      fields: {
        hookTimeoutMs: {
          control: "number",
          label: {
            en: "Hook timeout",
            "zh-CN": "钩子超时",
          },
          help: {
            en: "Maximum time each classification hook may spend.",
            "zh-CN": "单次分类钩子允许占用的最长时间。",
          },
          order: 10,
        },
      },
    },
  },
  secrets: {},
} as const satisfies PluginManifest
