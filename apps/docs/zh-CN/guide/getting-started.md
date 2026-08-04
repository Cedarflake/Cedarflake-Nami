---
title: 了解这个项目
description: 了解 i0c.cc 的定位、面向对象与部署准备。
---

# 了解这个项目

i0c.cc 是一个自托管的个人边缘重定向实验项目。常规安装只需要一个 WebUI、一个数据库后端和一个 Runtime 平台。三个 Runtime 适配器是可选项，不需要全部部署。

**这个项目面向谁。** 它面向个人使用和工程实验，当前也作为 Revaea 的边缘重定向基础设施。它不是托管短链接服务，也不以企业级重定向平台为目标。目前也没有把内部插件或 SDK 发布为公开包的计划；扩展仍以仓库内的源码级、编译期模块为主。 ~~我晓得我在重复造轮子~~

**这个文档站面向谁。** 它记录维护项目所需的架构、部署与运维方法；其他对实现感兴趣的开发者，也可以按照文档研究、自行部署或扩展自己的实例。 ~~不过大概主要还是写给自己看吧~~

## 前置条件

- Node.js 22
- Corepack，以及仓库声明的 pnpm 版本
- 用于 WebUI 登录的 GitHub OAuth Application
- PostgreSQL，或两个 Cloudflare D1 数据库
- 一个受支持的边缘平台：Cloudflare、Vercel 或 Netlify

## 安装工作区

```sh
git clone https://github.com/Revaea/i0c.cc.git
cd i0c.cc
corepack enable
pnpm install --frozen-lockfile
```

## 选择初始拓扑

仓库默认的 Bootstrap 配置使用 PostgreSQL 保存可编辑数据和统计数据，并由 WebUI 向 Runtime 提供快照。

最精简的部署步骤如下：

1. 创建 PostgreSQL，并在本地配置 WebUI 环境变量。
2. 运行 `pnpm database:init` 初始化所选的两组 Schema。
3. 部署 WebUI。
4. 选择并部署一个 Runtime 平台。
5. 为 WebUI 与 Runtime 配置完全相同的 `I0C_SECRET`。
6. 将公开 Runtime 域名指向该部署。

如果更适合使用 Cloudflare 托管存储，可以改选 D1。D1 需要分别配置 Repository 与统计数据库 ID。

## 配置密钥

请把示例值填写到部署平台的环境变量中，不要提交本地密钥文件。

WebUI 必填：

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
I0C_SECRET="replace-with-a-32-byte-random-secret"
```

每个 Runtime 部署都需要相同的密钥：

```dotenv
I0C_SECRET="replace-with-the-same-secret"
```

选择 D1 时，还要在 WebUI 配置 `CLOUDFLARE_D1_API_TOKEN`，并在仓库内的 Bootstrap 配置中填写非敏感的 D1 Account ID 与两个 Database ID。

## 初始化存储

选好 Provider，并让执行命令的 Shell 能读取相应凭据后，在首次部署 WebUI 前运行一次：

```sh
pnpm database:init
```

该命令读取仓库内的 Bootstrap Provider 选择，先初始化所选 Data Repository，再初始化所选 Analytics Store。Schema 已是最新时可以安全重复执行。它仍然是显式的外部写入，不会被构建或应用启动自动调用。

## 部署前验证

只运行与改动所有者对应的检查：

```sh
pnpm config:check
pnpm plugins:check
pnpm webui:lint
pnpm webui:build
pnpm runtime:build
```

根命令 `pnpm check` 会执行完整工作区检查。数据库初始化、Schema 更新和平台部署始终是显式操作，不会随构建自动执行。

## 下一步

- [选择部署拓扑](/zh-CN/deployment/choose-a-topology)
- [部署 WebUI](/zh-CN/deployment/webui)
- [部署 Runtime](/zh-CN/deployment/runtime)
- [了解实例配置](/zh-CN/guide/configuration)
