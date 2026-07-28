import { defineRuntimePlatformManifest } from "@i0c/plugin-sdk"

export const externalRuntimeManifest = defineRuntimePlatformManifest({
  id: "@example/runtime-external",
  name: "External Runtime fixture",
  version: "0.1.0",
  capabilities: ["request-adapter"],
  description: {
    summary: {
      en: "Fixture runtime platform used to verify external adapter installation.",
      "zh-CN": "用于验证外部适配器安装能力的 Runtime 平台测试插件。",
    },
  },
  config: { version: 1 },
  secrets: {},
  provider: "external-edge",
})
