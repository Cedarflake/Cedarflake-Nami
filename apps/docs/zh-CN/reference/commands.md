---
title: 命令索引
description: 查找仓库用于开发、校验、数据库设置和部署的 pnpm 命令。
---

# 命令索引

请在仓库根目录使用 `package.json` 声明的 pnpm 版本运行工作区命令。

## 仓库检查

| 命令 | 范围 |
| --- | --- |
| `pnpm check` | 串行执行完整工作区校验 |
| `pnpm config:check` | 共享配置包 |
| `pnpm plugins:check` | 插件包、测试与边界 |
| `pnpm data:validate` | 已配置的本地实例与规则输入 |

## WebUI

| 命令 | 用途 |
| --- | --- |
| `pnpm webui:dev` | 启动 Next.js 开发服务器 |
| `pnpm webui:test` | 运行 WebUI 测试 |
| `pnpm webui:lint` | 运行 ESLint 与本地化消息校验 |
| `pnpm webui:build` | 创建生产构建 |
| `pnpm webui:start` | 启动已经构建的应用 |

## Runtime

| 命令 | 用途 |
| --- | --- |
| `pnpm runtime:check` | Runtime 类型检查 |
| `pnpm runtime:test` | Runtime 测试 |
| `pnpm runtime:build` | 串行构建所有支持的平台输出 |
| `pnpm runtime:build:cf` | 构建 Cloudflare 输出 |
| `pnpm runtime:build:vc` | 构建 Vercel 输出 |
| `pnpm runtime:build:nf` | 构建 Netlify 输出 |
| `pnpm runtime:dev:cf` | 启动 Cloudflare 开发工具 |
| `pnpm runtime:dev:vc` | 启动 Vercel 开发工具 |
| `pnpm runtime:dev:nf` | 启动 Netlify 开发工具 |

`runtime:deploy:cf`、`runtime:deploy:vc` 和 `runtime:deploy:nf` 会写入外部平台，不能作为校验命令使用。

## 数据库初始化与 Schema 更新

| 命令 | 目标 |
| --- | --- |
| `pnpm database:init` | 初始化所选 Data Repository，随后初始化所选 Analytics Store |
| `pnpm database:update postgres repository` | PostgreSQL Data Repository |
| `pnpm database:update postgres analytics` | PostgreSQL Analytics Store |
| `pnpm database:update d1 repository` | D1 Data Repository |
| `pnpm database:update d1 analytics` | D1 Analytics Store |

## 插件开发

| 命令 | 用途 |
| --- | --- |
| `pnpm plugin:create --kind <kind> --name <name>` | 生成 Workspace 插件 |
| `pnpm plugins:boundaries` | 检查依赖边界 |
| `pnpm --filter @i0c/plugin-sdk check` | SDK 类型检查 |
| `pnpm --filter @i0c/plugin-sdk test` | SDK 测试 |

## 文档站

| 命令 | 用途 |
| --- | --- |
| `pnpm docs:dev` | 启动 VitePress 开发服务器 |
| `pnpm docs:check` | 检查双语路由并构建站点 |
| `pnpm docs:build` | 构建文档站 |
| `pnpm docs:preview` | 预览已构建站点 |
