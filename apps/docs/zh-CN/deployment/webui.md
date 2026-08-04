---
title: 部署 WebUI
description: 部署 Next.js 控制面，并配置认证、存储和共享实例密钥。
---

# 部署 WebUI

WebUI 项目根目录为 `apps/webui`。它是 Next.js 应用，仓库已经包含 Vercel 构建配置。

## 必填环境变量

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
I0C_SECRET="replace-with-a-32-byte-random-secret"
```

只有部署地址无法自动推断时，才需要用 `NEXTAUTH_URL` 做兼容覆盖，不要习惯性配置它。

使用 D1 REST 适配器或 D1 Schema 更新命令时，还需要：

```dotenv
CLOUDFLARE_D1_API_TOKEN="your-d1-read-write-api-token"
```

## GitHub OAuth

为 WebUI 域名创建 GitHub OAuth Application，并把 Auth.js 回调地址配置为：

```text
https://your-webui.example.com/api/auth/callback/github
```

WebUI 使用仓库内配置的 OAuth Scope，以及实例访问设置中的 GitHub 数字 ID。如果组织限制第三方 OAuth App，需要先在组织中授权这个 OAuth Application，才能访问相应资源。

## Vercel 项目设置

- Repository：`Revaea/i0c.cc` 或你的 Fork
- Root Directory：`apps/webui`
- Build command：`pnpm build`
- Framework：Next.js

所有密钥都应保存在 Vercel 项目环境中。pnpm 会从仓库根工作区安装 Monorepo 依赖。

## 初始化存储

首次部署 WebUI 前，让执行命令的 Shell 能读取所选数据库凭据，然后运行：

```sh
pnpm database:init
```

该命令会按顺序初始化所选 Repository 与 Analytics Schema。请在生产流量进入 WebUI 前完成。构建和应用启动都不会自动初始化或更新数据库 Schema。

Provider 专用命令和升级安全顺序见[数据库初始化与 Schema 更新](/zh-CN/operations/database)。

## 部署后检查

1. 在 URL 不携带凭据的情况下打开登录页。
2. 使用配置的管理员账号登录。
3. 确认设置与规则来自选中的 Repository。
4. 按 Runtime 认证契约请求 `/api/runtime/snapshot`。
5. 确认 Collector 会拒绝未签名或签名错误的统计事件。

Next.js 构建成功不等于 OAuth、存储或公开部署已经正常。
