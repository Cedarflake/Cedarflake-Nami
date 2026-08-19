---
title: 编写适配器
description: 为 Nami 增加新的 Runtime 平台、规则数据库或统计数据库。
---

# 编写适配器

新增适配器时，最省事的做法是先找一份相近的内置实现。新边缘平台可以对照 `plugins/runtime`，新数据库可以对照 PostgreSQL 或 D1 插件。本页说明需要保留哪些边界，平台或数据库 SDK 的细节则由新插件自己处理。

适配器是编译期插件。代码加入 Workspace 后，要跟随 Runtime 或 WebUI 重新构建；设置页只能选择已经装进这次构建的实现。

## 先确定要替换哪一层

新边缘平台使用 `runtime-platform`，由 Runtime 加载。新规则数据库使用 `data-repository`，新统计数据库使用 `analytics-store`，后两者都由 WebUI 加载。

规则存储和统计存储不是同一份契约。即使新数据库同时支持两种用途，也要拆成两个插件：一边管理设置、规则和修订，另一边管理事件、查询、聚合和保留期。

## 从生成的包开始

先生成对应类型的包：

```sh
pnpm plugin:create --kind <kind> --name <kebab-name>
```

生成器会放好 Manifest、配置、实现骨架和测试，但不会启用插件。补完实现后，把 Manifest 加入宿主清单，把工厂或平台描述加入根安装配置。新 Workspace 包通过 pnpm 加入依赖，不要手工编辑 Lockfile：

```sh
pnpm add -Dw <plugin-package-name>@workspace:*
```

最后运行插件契约和所属应用的构建。部署新版本后，实例设置才会出现这份插件。

## 增加 Runtime 平台

先生成平台包：

```sh
pnpm plugin:create --kind runtime-platform --name example-edge
```

平台插件通常包含：

```text
plugins/runtime/example-edge/
├─ src/manifest.ts
├─ src/runtime.ts
├─ src/installation.ts
└─ tests/
```

`runtime.ts` 把平台收到的请求、环境变量、后台任务和地理信息转换成共享 `RuntimeRequestHandler` 能理解的输入。路由匹配、跳转和反代仍由 Runtime 核心完成，不要在适配器里复制一套。

`installation.ts` 告诉构建系统平台模块在哪里、哪些依赖要一起打包，以及输出文件名：

```ts
import { defineRuntimePlatformInstallation } from "@nami/plugin-sdk/runtime"

import { exampleEdgeManifest } from "./manifest"

export const exampleEdgeInstallation = defineRuntimePlatformInstallation({
  key: "example-edge",
  manifest: exampleEdgeManifest,
  runtimeModule: "@nami/plugin-runtime-example-edge/runtime",
  bundlePackages: ["@nami/plugin-runtime-example-edge"],
  outputEntry: "platforms/example-edge",
})
```

然后完成两处注册：

- `nami.runtime.manifests.ts` 让校验器和 WebUI 状态页认识这个平台；
- `nami.runtime.config.ts` 让 Runtime 构建真正包含它。

可以先单独构建新平台：

```sh
pnpm --filter nami-runtime build:platform example-edge
```

平台专有的部署描述、输出整理和配置文件仍放在 Runtime 部署边界。共享处理器不应导入平台 SDK。

## 增加规则数据库

生成规则存储插件：

```sh
pnpm plugin:create --kind data-repository --name example-database
```

它要实现 `NamiDataRepository`。最重要的行为是：

- 读取带版本号的设置或规则文档；
- 写入时检查旧版本，避免两个页面静默覆盖彼此；
- 一次读取彼此一致的设置和规则快照；
- 在支持时提供初始化、导入、历史和恢复能力。

数据库有自有表时，还要实现 `PluginSchemaMigrationProvider`。更新记录必须有顺序；数据库支持事务时，应让结构修改和版本记录一起成功或失败。

在 `nami.webui.manifests.ts` 注册 Manifest，再在 `nami.webui.config.ts` 注册工厂。一个 WebUI 构建只选择一个活动的规则存储，编辑器和 API Route 不需要为新数据库增加分支。

## 增加统计数据库

生成统计存储插件：

```sh
pnpm plugin:create --kind analytics-store --name example-database
```

它要实现 `NamiAnalyticsStore`，包括：

- 幂等写入 Runtime 事件；
- 查询总览、单条规则、入口域名和机器人流量；
- 重建聚合并执行数据保留；
- 返回可用状态和缺失配置；
- 管理自己的数据库结构更新。

Manifest 放进 `nami.webui.manifests.ts` 的统计存储清单，工厂放进 `nami.webui.config.ts`。构建可以包含多个统计存储，再由实例配置选择启用哪一个。

如果同一种新数据库同时支持规则和统计，推荐这样组织：

```text
packages/database-example/       # 共用连接、事务和结构更新工具
plugins/repository/example/      # 规则、设置与修订
plugins/store/example/           # 统计事件与查询
```

共享包只放真正共用的数据库基础能力，不要把两种业务契约重新揉成一个大适配器。

## 注册之后如何真正用起来

根安装配置把代码放进构建，Manifest 清单让校验器和 WebUI 认识它。若应用启动前就要用到这份适配器，还要在启动配置中选择它。部署完成后，实例设置才负责公开选项和启用状态；真实密钥仍由部署环境提供。

为已有类型增加另一种实现，不需要修改应用核心。新增数据库名称时，还要让共享启动配置、校验和初始化命令认识这个名称，否则应用在读取实例文档之前没有办法选择它。

## 完成前跑哪些检查

先检查插件自己：

```sh
pnpm --filter <plugin-package-name> check
pnpm --filter <plugin-package-name> test
pnpm plugins:check
```

再运行所属应用的构建。Runtime 平台要构建对应平台，规则或统计数据库要运行 WebUI lint 与 build。新数据库第一次使用 `pnpm database:init`；已有数据库只有在出现新结构时才运行准确的 `pnpm database:update`。

可以从现有实现开始对照：

- Runtime：`plugins/runtime/cloudflare`、`plugins/runtime/vercel`、`plugins/runtime/netlify`；
- 规则存储：`plugins/repository/postgres`、`plugins/repository/d1`；
- 统计存储：`plugins/store/postgres`、`plugins/store/d1`。

这些命令只检查源码和构建。数据库更新与外部部署仍要分别确认目标后执行。
