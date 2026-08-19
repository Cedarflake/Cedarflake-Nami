import {
  PLUGIN_API_VERSION,
  type PluginManifest,
} from "@nami/plugin-api"

import {
  githubContentsRepositoryPluginConfigSchema,
  githubRawSourcePluginConfigSchema,
} from "./config"

export const githubRawSourceManifest = {
  id: "@nami/github-raw-source",
  name: "GitHub Raw data source",
  version: "0.1.0",
  apiVersion: PLUGIN_API_VERSION,
  kind: "data-source",
  slot: "data-source",
  hosts: ["runtime"],
  capabilities: [
    "config:read",
    "redirects:read",
    "http:etag",
    "cache:last-valid",
  ],
  description: {
    summary: {
      en: "Reads published Runtime configuration and redirect rules from GitHub raw URLs.",
      "zh-CN": "从 GitHub Raw 地址读取已发布的 Runtime 配置和重定向规则。",
    },
  },
  config: {
    version: 1,
    schema: githubRawSourcePluginConfigSchema,
  },
  secrets: {},
} as const satisfies PluginManifest

export const githubContentsRepositoryManifest = {
  id: "@nami/github-contents-repository",
  name: "GitHub Contents data repository",
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
    "version:optimistic",
    "ui:redirects-manual-save",
    "ui:redirects-json-editor",
    "ui:redirects-source-override",
  ],
  description: {
    summary: {
      en: "Lets the WebUI read and update configuration files through the GitHub Contents API.",
      "zh-CN": "让 WebUI 通过 GitHub Contents API 读取和更新配置文件。",
    },
  },
  config: {
    version: 1,
    schema: githubContentsRepositoryPluginConfigSchema,
  },
  secrets: {},
} as const satisfies PluginManifest
