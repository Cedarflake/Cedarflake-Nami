---
title: 插件 SDK
description: 使用仓库内部 SDK 编写新的编译期插件。
---

# 插件 SDK

`@i0c/plugin-sdk` 是仓库内部的编译期插件开发层。它减少 Manifest、配置和安装装配中的重复代码，但不会把 Host 变成动态加载器。

## 支持的插件类型

- `runtime-platform`
- `data-source`
- `data-repository`
- `analytics-sink`
- `analytics-store`
- `feature`

## 生成插件包

在仓库根目录运行：

```sh
pnpm plugin:create --kind feature --name request-sampler
```

生成器会在对应的 `plugins/<category>/` 目录创建包，包含 Manifest、配置定义、类型化实现骨架、契约测试和双语 README。

生成器不会自动启用插件。审查实现后，再把 Installation 注册到 `i0c.runtime.config.ts`、`i0c.webui.config.ts` 或归属的 WebUI 扩展注册表。

Runtime 平台、规则数据库和统计数据库的完整接入流程见[编写适配器](/zh-CN/plugins/adapters)。

## 开发契约

使用 SDK 定义：

1. 包含双语摘要和能力声明的类型化 Manifest；
2. 配置 Schema、默认值与解析器；
3. Runtime 或 WebUI 插件 Installation；
4. 对应扩展槽的契约测试。

WebUI 会读取已安装 Manifest 的配置元数据，并渲染通用设置编辑器。插件负责字段与本地化描述；WebUI 负责视觉控件和持久化流程。

## 边界

- SDK 仅供当前 Workspace 使用，并导出 TypeScript 源码。
- 插件在构建前安装，并与 Host 一起打包。
- 远程实例配置可以配置或关闭已安装插件，但不能安装代码。
- 在现有插件槽中增加新实现，不应再给应用 Core 增加 `switch`。
- 真正全新的扩展概念仍需要新增共享协议与 Host 集成。

## 验证插件

```sh
pnpm --filter @i0c/plugin-sdk check
pnpm --filter @i0c/plugin-sdk test
pnpm plugins:check
```

插件接入后，还要运行对应 Runtime 或 WebUI Host 的检查与构建。

完整 API 示例见包内的[插件 SDK README](https://github.com/Revaea/i0c.cc/blob/main/packages/plugin-sdk/README.zh-CN.md)。
