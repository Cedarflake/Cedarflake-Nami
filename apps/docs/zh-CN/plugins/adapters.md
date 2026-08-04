---
title: 编写适配器
description: 在不耦合应用核心的前提下接入 Runtime 平台、规则数据库或统计数据库。
---

# 编写适配器

i0c 允许自行编写 Runtime 平台和数据库适配器。适配器属于编译期插件：先把插件包加入当前 Workspace，再在根安装配置中注册，并随对应 Host 重新构建。

## 选择扩展槽

| 目标 | 插件类型 | 契约 | 安装入口 |
| --- | --- | --- | --- |
| 在新的边缘平台运行重定向 | `runtime-platform` | 把平台请求转换为 `RuntimeRequestHandler` 调用 | `i0c.runtime.config.ts` |
| 将实例配置和路由规则存入其他位置 | `data-repository` | `I0cDataRepository` | `i0c.webui.config.ts` |
| 将统计事件和查询存入其他数据库 | `analytics-store` | `I0cAnalyticsStore` | `i0c.webui.config.ts` |

Data Repository 管理 `config` 和 `redirects` 两份控制面文档；Analytics Store 管理事件、查询、聚合重建和保留策略。即使它们使用同一种数据库，也仍是两个不同的扩展槽。

一种数据库同时支持两类用途时，通常采用以下结构：

```text
packages/database-example/       # 可选的共享客户端和 Schema 更新机制
plugins/repository/example/      # 配置与路由规则文档
plugins/store/example/           # 统计事件与查询
```

共享 Provider 包只放连接、事务和 Schema 更新等可复用基础能力；Repository 与统计业务仍由各自插件实现。

## 通用开发流程

1. 在正确的插件分类中生成包；
2. 使用 pnpm 将 Workspace 包加入根开发依赖；
3. 定义 Manifest、双语说明、能力、配置 Schema 和密钥绑定；
4. 实现对应扩展槽的契约；
5. 添加契约测试和 Manifest 测试；
6. 将 Manifest 加入 Runtime 或 WebUI Manifest Catalog；
7. 在根安装配置中注册工厂或平台 Descriptor；
8. 在启动配置和实例配置中选择并配置已安装实现；
9. 如果适配器拥有数据库表，初始化 Schema 或更新已有 Schema；
10. 重新构建并部署受影响的 Host。

生成器只创建 Workspace 包，不会自动启用插件：

```sh
pnpm plugin:create --kind <kind> --name <kebab-name>
```

生成后使用 pnpm 把新包加入根 Manifest，不要手动修改 Lockfile：

```sh
pnpm add -Dw <plugin-package-name>@workspace:*
```

## 新增 Runtime 平台

创建插件包：

```sh
pnpm plugin:create --kind runtime-platform --name example-edge
```

随后实现这些包内入口：

```text
plugins/runtime/example-edge/
├─ src/manifest.ts
├─ src/runtime.ts
├─ src/installation.ts
└─ tests/
```

Runtime 模块必须导出 `runtimePlatformPlugin`。它的 `create(handler)` 负责把平台入口转换为共享 Handler 调用；只有平台确实提供相应能力时，才传入环境绑定、后台任务、国家信息和缓存等上下文。

需要把生成器默认的通用 `./plugin` 导出改成明确的 `./runtime` 与 `./installation` 包导出，让构建系统可以分别加载运行时实现和安装描述。

Installation Descriptor 告诉构建系统该平台需要加载哪个模块、打包哪些依赖以及输出到哪里：

```ts
import { defineRuntimePlatformInstallation } from "@i0c/plugin-sdk/runtime"

import { exampleEdgeManifest } from "./manifest"

export const exampleEdgeInstallation = defineRuntimePlatformInstallation({
  key: "example-edge",
  manifest: exampleEdgeManifest,
  runtimeModule: "@i0c/plugin-runtime-example-edge/runtime",
  bundlePackages: ["@i0c/plugin-runtime-example-edge"],
  outputEntry: "platforms/example-edge",
})
```

先在 `i0c.runtime.manifests.ts` 中导入 Manifest，并追加到 `runtimePlatformManifests`，让配置校验和 WebUI 状态页能够发现该平台。再在 `i0c.runtime.config.ts` 中导入 Descriptor，并追加到 `runtimeInstallationConfig.platforms`。共享重定向 Handler 不需要新增平台 `switch`。

开发时可以单独构建新平台：

```sh
pnpm --filter i0c-redirect-worker build:platform example-edge
```

新平台仍可能需要自己的部署包装、输出整理或平台配置。这些内容应留在 Runtime 的部署边界，不应把平台专有 API 放入共享 Handler。

## 新增规则数据库

创建 Data Repository 插件：

```sh
pnpm plugin:create --kind data-repository --name example-database
```

实现 `@i0c/plugin-sdk` 导出的 `I0cDataRepository` 契约：

- `read` 读取一份带版本的文档；
- `write` 通过乐观并发控制原子更新 Revision；
- `readSnapshot` 返回配置与规则的一致快照；
- 可选的 `management` 提供初始化、导入、状态检查、Revision 列表和恢复能力。

数据库驱动的 Repository 还应提供 `@i0c/plugin-api` 中的 `PluginSchemaMigrationProvider`。Schema 历史必须有序；数据库支持时应保存校验和，并尽可能原子执行。

生成的插件工厂可以直接安装，不需要修改 WebUI 应用代码：

```ts
dataRepository: {
  enabledByDefault: true,
  ...exampleDatabaseRepositoryPlugin,
}
```

在 `i0c.webui.manifests.ts` 的 Repository 选择逻辑中加入 Manifest 和默认启用状态；再在 `i0c.webui.config.ts` 的 `webUiPluginInstallations.dataRepository` 中注册且只启用一个 Repository 工厂。WebUI 仍只调用共享契约，编辑器和 API Route 不需要新增数据库分支。

## 新增统计数据库

创建 Analytics Store 插件：

```sh
pnpm plugin:create --kind analytics-store --name example-database
```

实现 `@i0c/plugin-sdk` 导出的 `I0cAnalyticsStore` 契约：

- 幂等写入统计事件；
- 提供总览、单规则、自动化和入口域名查询；
- 支持聚合重建和数据保留；
- 返回健康状态以及是否完成配置；
- 通过可选的 `schemaMigrations` 管理自有表。

先把 Manifest Descriptor 加入 `i0c.webui.manifests.ts` 的 `webUiPluginDescriptors.analyticsStores`，再把对应工厂 Installation 加入 `i0c.webui.config.ts` 的 `webUiPluginInstallations.analyticsStores`。构建产物可以包含多个统计 Store，再由实例配置选择启用项。只有 Manifest 已静态安装且在默认实例配置中声明后，它的配置字段才会出现在 WebUI 中。

```ts
analyticsStores: [
  {
    enabledByDefault: false,
    ...exampleDatabaseAnalyticsStorePlugin,
  },
]
```

## 选择适配器

“安装代码”和“选择实例”是两个步骤：

- `i0c.runtime.config.ts` 与 `i0c.webui.config.ts` 决定构建时包含哪些代码；
- `i0c.runtime.manifests.ts` 与 `i0c.webui.manifests.ts` 向校验器和 WebUI 暴露已安装元数据；
- Bootstrap Config 选择读取远程配置前就必须知道的基础设施；
- Instance Config 控制非敏感插件设置和启用状态；
- 部署环境绑定提供密钥和平台原生对象。

当前 Bootstrap Provider 联合类型只包含内置的 GitHub、PostgreSQL 和 D1。替换现有扩展槽内的实现不需要修改应用核心；如果要增加一个可选择的新 Provider 标识，还需要扩展共享 Bootstrap 类型、校验、默认值和初始化文档。这属于配置模型改动，而不是重定向或统计业务逻辑改动。

## 验证与交付

从仓库根目录串行运行：

```sh
pnpm --filter <plugin-package-name> check
pnpm --filter <plugin-package-name> test
pnpm plugins:check
```

随后运行对应 Host 的构建。新数据库使用 `pnpm database:init` 初始化；已有数据库存在待应用的 Schema 变化时，才使用 `pnpm database:update <provider> <purpose>`。部署仍是需要单独授权的外部操作。

可以参考现有实现：

- Runtime 平台：`plugins/runtime/cloudflare`、`plugins/runtime/vercel`、`plugins/runtime/netlify`；
- 规则和配置仓库：`plugins/repository/d1`、`plugins/repository/postgres`；
- 统计存储：`plugins/store/d1`、`plugins/store/postgres`。
