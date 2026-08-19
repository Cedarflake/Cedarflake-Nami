---
title: 部署 WebUI
description: 配置 GitHub 登录和数据库连接，把管理界面部署起来并完成首次初始化。
---

# 部署 WebUI

WebUI 是你平时真正会打开的管理界面。它负责登录、规则编辑、实例设置、修订历史和统计，也是唯一需要数据库凭据的应用。

开始前，请先完成[数据库准备](/zh-CN/deployment/databases)，并确定 WebUI 将使用的 HTTPS 域名。下面以 Vercel 为例，因为仓库已经为它准备了构建配置。

## 1. 创建 GitHub OAuth App

在 GitHub 的 Developer settings 中创建 OAuth App。Homepage URL 填 WebUI 地址，Authorization callback URL 必须是：

```text
https://your-webui.example.com/api/auth/callback/github
```

创建后保存 Client ID，并生成 Client Secret。默认数据库控制面只需要读取 GitHub 用户身份，不需要访问仓库内容的权限。

如果 WebUI 需要读取 Revaea 等启用了 OAuth App 限制的组织资源，还要在组织设置中允许这个 App。

## 2. 准备实例密钥

WebUI 和所有 Runtime 要使用同一个 `NAMI_SECRET`。可以用 Node.js 生成：

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

保存生成结果。它至少应有 32 个字符，不要提交到仓库，也不要把 WebUI 和 Runtime 配成不同值。

## 3. 创建 Vercel 项目

连接你的 nami 仓库或 Fork，并使用这些项目设置：

```text
Root Directory: apps/webui
Framework Preset: Next.js
```

保持开启 **Include source files outside of the Root Directory in the Build Step**，否则 WebUI 无法读取仓库中的共享 Workspace 包。

`apps/webui/vercel.json` 已经固定 pnpm 安装与构建命令，不需要在 Vercel 后台重新抄一遍。

## 4. 配置环境变量

PostgreSQL 默认部署需要：

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
NAMI_SECRET="the-secret-generated-above"
```

如果选择 D1，再加入：

```dotenv
CLOUDFLARE_D1_API_TOKEN="your-d1-read-write-api-token"
```

Auth.js 通常能从请求判断公开地址。只有反向代理没有正确转发地址时，才用 `NEXTAUTH_URL` 覆盖；不要把它当成每次部署都必须填写的变量。

## 5. 部署并完成首次初始化

部署成功后打开 WebUI，用 GitHub 登录。空数据库会把你带到“初始化此部署”页面，而不是规则列表。

这里需要填写：

- 与环境变量相同的实例密钥；
- WebUI 的公开地址；
- 准备绑定给 Runtime 的公开地址；
- 实际准备部署的 Runtime 平台；
- 是否启用统计，以及统计使用的基础域名。

确认后，WebUI 会原子创建首份实例设置和空规则集。当前 GitHub 账号会成为第一位管理员。

<!-- 需要真实截图：WebUI 首次初始化页面，遮蔽实例密钥和账号信息。 -->

## 怎么判断 WebUI 已经就绪

初始化完成后，应该能进入规则页面，侧栏显示空的规则分组，并能打开设置页面。刷新浏览器后仍能读取相同内容，说明 WebUI 已经在使用数据库，而不是只显示本地状态。

如果页面提示缺少表或需要设置数据库结构，回到[准备数据库](/zh-CN/deployment/databases)重新检查 `pnpm database:init` 与环境变量。

下一步是[部署 Runtime](/zh-CN/deployment/runtime)。WebUI 自己不会处理公开短链接。
