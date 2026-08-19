# 插件 SDK

`@nami/plugin-sdk` 是 Nami 编译期插件的仓库内部开发 SDK。它用于减少 Manifest、配置、安装和宿主装配中的重复代码，同时保留显式的构建期组合方式。

SDK 目前仅供此 workspace 使用。它不是动态加载器、插件市场，也不承诺兼容任意第三方二进制包。插件仍是普通的 workspace 依赖，需要在对应的 Runtime 或 WebUI 安装配置中明确选择，并在构建时打包。

## 提供的能力

- 为数据源、数据仓库、统计投递器、统计存储、Runtime Feature 和 Runtime 平台提供类型化 Manifest 辅助函数
- 统一要求 WebUI 使用的双语插件描述
- 校验配置 Schema、默认值和最终解析值
- 提供 Runtime 插件与平台的开发辅助函数
- 提供 WebUI 数据仓库、统计存储和扩展项的开发辅助函数
- 向插件作者暴露共享的数据仓库与统计存储契约
- 提供生成统一插件包结构的 workspace 脚手架

底层协议仍由 `@nami/plugin-api` 负责；宿主行为仍属于 `@nami/runtime-host`、`@nami/runtime-build` 和 WebUI。编写插件时使用此 SDK，维护宿主基础设施时再直接使用底层包。

## 创建插件

在仓库根目录运行：

```bash
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

命令会在对应的 `plugins/<category>/` 目录创建插件包，但不会自动启用插件。仍需将生成的插件加入 `nami.runtime.config.ts`、`nami.webui.config.ts` 或对应的 WebUI 扩展注册表，让部署选择保持显式且便于审查。

## 编写适配器

自行编写的适配器遵循以下编译期流程：

1. 生成 `runtime-platform`、`data-repository` 或 `analytics-store` 插件包；
2. 使用 pnpm 将其加入根 Workspace 依赖；
3. 实现 SDK 契约和测试；
4. 在 `nami.runtime.manifests.ts` 或 `nami.webui.manifests.ts` 注册 Manifest；
5. 在 `nami.runtime.config.ts` 或 `nami.webui.config.ts` 注册平台 Descriptor 或工厂；
6. 只有新增 Provider 标识时才扩展 Bootstrap 选择模型；
7. 初始化自有表，重新构建 Host，再单独部署。

Runtime Platform 负责把平台入口适配到 `RuntimeRequestHandler`；Data Repository 通过 `NamiDataRepository` 管理带版本的配置和规则文档；Analytics Store 通过 `NamiAnalyticsStore` 负责事件写入、查询、聚合重建和保留。数据库适配器可以通过 `PluginSchemaMigrationProvider` 提供首次初始化和后续 Schema 更新。

具体注册点、命令和现有参考实现见双语文档页[编写适配器](https://d.i0c.cc/zh-CN/plugins/adapters)。

## 定义 Manifest

```ts
import {
  defineRuntimeFeatureManifest,
} from "@nami/plugin-sdk"

export const manifest = defineRuntimeFeatureManifest({
  id: "@nami/feature-request-sampler",
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

辅助函数会补充 Plugin API 版本、类型、插槽和宿主等固定字段，并立即校验完整 Manifest。

## 定义配置

```ts
import {
  definePluginConfiguration,
} from "@nami/plugin-sdk"

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

模块加载时会先校验 Schema。默认值和每次解析出的最终配置也会使用同一个 Schema 校验，避免辅助函数返回 Manifest 本身不接受的数据。

## 定义 Runtime 插件

```ts
import {
  defineRuntimeFeaturePlugin,
} from "@nami/plugin-sdk/runtime"

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

Runtime 平台、数据源、统计投递器和 Feature 辅助函数会先确认 Manifest 属于预期的 Runtime 扩展点，再交给宿主。

## 定义 WebUI 插件

```ts
import {
  defineWebUiAnalyticsStorePlugin,
} from "@nami/plugin-sdk/webui"

import { manifest } from "./manifest"

export const analyticsStorePlugin = defineWebUiAnalyticsStorePlugin({
  manifest,
  async create(context) {
    const connection = context.readEnvironment("DATABASE_URL")
    return connection ? createStore(connection) : null
  },
})
```

WebUI 辅助函数覆盖数据仓库、统计存储和静态扩展项。插件负责提供契约与配置元数据，WebUI 继续负责渲染和编辑通用配置界面。

## 验证修改

在仓库根目录运行：

```bash
pnpm --filter @nami/plugin-sdk check
pnpm --filter @nami/plugin-sdk test
pnpm plugins:check
```

如果插件已经接入 Runtime 或 WebUI，仍需运行对应宿主的检查。

---

[English](README.md) · 简体中文
