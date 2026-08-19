import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@nami/plugin-api"

import { httpAnalyticsSinkConfigSchema } from "./config"

export const HTTP_ANALYTICS_SINK_PLUGIN_ID = "@nami/analytics-sink-http"

export const httpAnalyticsSinkManifest = {
  id: HTTP_ANALYTICS_SINK_PLUGIN_ID,
  name: "Signed HTTP analytics sink",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  kind: "analytics-sink",
  slot: "analytics-sink",
  hosts: ["runtime"],
  capabilities: [
    "hmac-sha256",
    "retry:transient",
    "redirect:manual",
    "timeout:abort",
  ],
  description: {
    summary: {
      en: "Delivers Runtime analytics events to the WebUI collector through signed HTTP requests.",
      "zh-CN": "通过签名 HTTP 请求将 Runtime 统计事件投递到 WebUI Collector。",
    },
  },
  config: {
    version: 1,
    schema: httpAnalyticsSinkConfigSchema,
    ui: {
      fields: {
        maximumDeliveryAttempts: {
          control: "number",
          label: {
            en: "Delivery attempts",
            "zh-CN": "投递尝试次数",
          },
          help: {
            en: "Maximum attempts for transient collector failures.",
            "zh-CN": "统计 Collector 临时失败时允许重试的最大次数。",
          },
          order: 10,
        },
        requestTimeoutMs: {
          control: "number",
          label: {
            en: "Request timeout",
            "zh-CN": "请求超时",
          },
          help: {
            en: "Abort analytics delivery requests after this timeout.",
            "zh-CN": "统计投递请求超过该时间后中止。",
          },
          order: 20,
        },
      },
    },
  },
  secrets: {
    writeKey: {
      required: true,
      sensitive: true,
      defaultBinding: "NAMI_SECRET",
      description: "HMAC key shared with the analytics collector.",
      label: {
        en: "Analytics write key binding",
        "zh-CN": "统计写入密钥绑定",
      },
      help: {
        en: "Environment variable name for the HMAC key shared with the collector.",
        "zh-CN": "填写与 Collector 共享的 HMAC 密钥所对应的环境变量名称。",
      },
      order: 100,
    },
  },
} as const satisfies PluginManifest
