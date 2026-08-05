---
title: 插件 SDK
description: 用仓库内的 SDK 生成、实现、注册并检查一个 Runtime 功能插件。
---

# 插件 SDK

写插件最快的入口是根目录的生成器。本页以 `request-sampler` 为例，从生成包开始，一直做到 Runtime 能够安装它。

生成器背后使用 `@i0c/plugin-sdk`。这个包把 Manifest、配置校验和宿主装配中重复的部分收在一起；具体功能仍由插件自己实现。它只服务当前仓库，插件也仍要跟 Runtime 或 WebUI 一起构建。

如果你要写的是新平台或新数据库，前面的 Manifest 和配置步骤仍然适用，具体接口则在[编写适配器](/zh-CN/plugins/adapters)中说明。

## SDK 已经处理的部分

- Runtime 平台、数据源、数据 Repository、统计 Sink、统计 Store 与 Runtime Feature 的类型化 Manifest 辅助函数；
- WebUI 用于展示的双语插件描述；
- 配置 Schema、默认值与最终解析值校验；
- Runtime 与 WebUI Installation 辅助函数；
- 共享 Repository 与 Analytics Store 契约；
- 生成统一插件包结构的 Workspace 脚手架。

一般插件只需要 `@i0c/plugin-sdk`。`@i0c/plugin-api`、`@i0c/runtime-host` 与 `@i0c/runtime-build` 更靠近宿主和共享协议，不必为了完成普通插件而直接引用。

## 1. 生成插件包

在仓库根目录运行：

```sh
pnpm plugin:create --kind feature --name request-sampler
```

支持的类型包括：

```text
runtime-platform
data-source
data-repository
analytics-sink
analytics-store
feature
```

生成器会在对应的 `plugins/<category>/` 目录创建插件包，包含 Manifest、配置定义、类型化实现骨架、契约测试和双语包说明。

生成器不会自动启用插件。安装仍然是一项显式、可审查的仓库修改。

## 2. 定义 Manifest

下面的示例会创建一个用于采样统计事件的 Runtime Feature：

```ts
import {
  defineRuntimeFeatureManifest,
} from "@i0c/plugin-sdk"

export const manifest = defineRuntimeFeatureManifest({
  id: "@i0c/feature-request-sampler",
  name: "Request sampler",
  version: "0.1.0",
  description: {
    summary: {
      en: "Samples Runtime events before delivery.",
      "zh-CN": "在 Runtime 事件投递前进行采样。",
    },
  },
  capabilities: ["analytics:sampling"],
})
```

辅助函数会补充固定的 Plugin API 版本、类型、插槽与 Host 约束，并立即校验完整 Manifest。

## 3. 定义可编辑配置

```ts
import {
  definePluginConfiguration,
} from "@i0c/plugin-sdk"

interface RequestSamplerConfig {
  rate: number
}

export const configuration = definePluginConfiguration<RequestSamplerConfig>({
  version: 1,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      rate: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    },
    required: ["rate"],
  },
  defaults: {
    rate: 1,
  },
  resolve(value) {
    return {
      rate: typeof value?.rate === "number" ? value.rate : 1,
    }
  },
})
```

模块加载时，SDK 会先校验 Schema。默认值和每次解析出的最终配置也会使用同一个 Schema 校验，避免 Resolver 静默返回 Manifest 本身不接受的数据。

已安装 Manifest 的元数据还会驱动 WebUI 通用设置编辑器。插件负责字段定义和本地化描述，WebUI 负责控件、校验反馈与持久化流程。

## 4. 定义 Runtime 插件

```ts
import {
  defineRuntimeFeaturePlugin,
} from "@i0c/plugin-sdk/runtime"

import { manifest } from "./manifest"

export const requestSamplerPlugin = defineRuntimeFeaturePlugin({
  manifest,
  create() {
    return {
      id: manifest.id,
      order: 100,
      timeoutMs: 50,
      failurePolicy: "continue",
      hooks: {
        onAnalyticsEvent(event) {
          return event
        },
      },
    }
  },
})
```

Runtime 辅助函数会先确认 Manifest 属于预期扩展点，再让 Host 接受 Installation。

## 5. 定义 WebUI 插件

如果扩展点由 WebUI 持有，例如 Analytics Store：

```ts
import {
  defineWebUiAnalyticsStorePlugin,
} from "@i0c/plugin-sdk/webui"

import { manifest } from "./manifest"

export const analyticsStorePlugin = defineWebUiAnalyticsStorePlugin({
  manifest,
  async create(context) {
    const connection = context.readEnvironment("DATABASE_URL")
    return connection ? createStore(connection) : null
  },
})
```

WebUI 辅助函数覆盖数据 Repository、统计 Store 与静态扩展注册。具体实现只返回自己的契约，外围应用行为仍由 WebUI 负责。

## 6. 注册 Installation

根据插件归属选择注册位置：

- Runtime Installation：`i0c.runtime.config.ts`；
- 配置校验使用的 Runtime Manifest：`i0c.runtime.manifests.ts`；
- WebUI Installation：`i0c.webui.config.ts`；
- WebUI Manifest 或静态扩展：对应的 WebUI 根注册表。

使用 pnpm 把插件包加入根 Workspace 依赖。为现有扩展槽增加另一种实现时，不要再给 Host Core 增加 `switch`。

只有新增 Provider 标识，而不只是新增同一 Provider 的另一种实现时，才需要让 Bootstrap 选择模型识别新标识。

## 7. 验证插件

```sh
pnpm --filter @i0c/plugin-sdk check
pnpm --filter @i0c/plugin-sdk test
pnpm plugins:check
```

启用插件后，还要运行所属 Host 的检查与构建。Runtime 插件需要对应 Runtime 构建；WebUI 插件需要 WebUI lint 与 build。

## 适配器专用契约

- Runtime Platform 把平台入口适配到 `RuntimeRequestHandler`。
- Data Repository 实现 `I0cDataRepository`，管理带版本的配置和规则文档。
- Analytics Store 实现 `I0cAnalyticsStore`，负责事件写入、查询、聚合重建与保留。
- 数据库适配器可以暴露 `PluginSchemaMigrationProvider`，提供首次初始化与后续 Schema 更新。

注册流程与当前参考实现见[编写适配器](/zh-CN/plugins/adapters)。

## SDK 的范围

远程实例配置只能配置或停用已经安装的代码。增加现有扩展槽的新实现时，应用核心不应再增加分派逻辑；增加一种新的扩展槽时，仍然要修改共享协议和宿主。

SDK 目前只服务这个 Workspace，不承担公共包发布、独立版本兼容或第三方插件生态支持。
