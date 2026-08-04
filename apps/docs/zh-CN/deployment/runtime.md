---
title: 部署 Runtime
description: 把同一个重定向 Host 构建并部署到 Cloudflare、Vercel 或 Netlify。
---

# 部署 Runtime

Runtime 项目根目录为 `apps/runtime`。常规安装只需要选择一个平台适配器。

## 共享密钥

默认情况下，每个部署只需要共享实例密钥：

```dotenv
I0C_SECRET="the-same-32-character-or-longer-secret-as-the-webui"
```

Runtime 的非敏感配置和规则来自配置的快照数据源。Runtime 不需要 `DATABASE_URL` 或 D1 凭据。

## Cloudflare Workers

仓库内的 `wrangler.toml` 会构建 `dist/platforms/cloudflare.js`。

```sh
pnpm runtime:build:cf
pnpm runtime:dev:cf
pnpm runtime:deploy:cf
```

请把 `I0C_SECRET` 配置为 Worker Secret。部署命令会写入外部平台，只应对明确的 Cloudflare 账号与环境执行。

## Vercel Edge Functions

创建 Vercel 项目，并把 Root Directory 设为 `apps/runtime`。仓库配置使用：

```text
Build command: pnpm build:vc
Output directory: .vercel/output
```

也可以使用根目录封装命令：

```sh
pnpm runtime:build:vc
pnpm runtime:dev:vc
pnpm runtime:deploy:vc
```

## Netlify Edge Functions

创建 Netlify Site，并把 Base directory 设为 `apps/runtime`。`netlify.toml` 执行 `pnpm build:nf`、发布 `dist`，并把生成的 Edge Function 映射到 `/*`。

```sh
pnpm runtime:build:nf
pnpm runtime:dev:nf
pnpm runtime:deploy:nf
```

## 域名与统计

在各平台配置公开主机名。Runtime 统计使用请求的实际主机名作为 `entryDomain`，而 `sourceId` 标识整套 i0c.cc 实例。因此多个域名可以分别筛选，但不会被拆成互不相关的 Source。

## 其他平台

Cloudflare、Vercel 与 Netlify 是内置适配器，不是封闭的平台列表。你可以自行实现 `runtime-platform` 插件，在构建时注册，并让平台专有 API 留在共享重定向 Handler 之外。具体流程见[编写适配器](/zh-CN/plugins/adapters#新增-runtime-平台)。

## 故障行为

Runtime 会在接受新快照前完成校验；刷新失败时继续使用上一份有效配置。如果在实例配置中关闭某个平台适配器，仍然存在的平台部署将无法正常提供路由；彻底停用某个平台时，还要单独删除外部部署。
