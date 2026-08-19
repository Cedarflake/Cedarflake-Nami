---
title: 选择部署组合
description: 第一次只选一个 WebUI、一种数据库和一个 Runtime，先把最小实例跑起来。
---

# 选择部署组合

nami 支持几种数据库和边缘平台，但它们不是一份必须全部完成的部署清单。第一次只需要做三个选择：WebUI 放在哪里、数据存在哪里、公开请求由哪个 Runtime 接收。

::: tip 想少做选择？
把 WebUI 部署到 Vercel，使用 PostgreSQL，再从 Cloudflare、Vercel、Netlify 中挑一个自己最熟悉的 Runtime。仓库默认配置就是沿着这条路径准备的。
:::

## 一个最小实例长什么样

最小部署只有三项：

1. **一个 WebUI**，供你登录和管理规则；
2. **一个存储后端**，保存规则、设置、修订和可选统计；
3. **一个 Runtime**，绑定公开域名并处理访问。

公开域名应该指向 Runtime。例如管理界面使用 `admin.example.com`，真正分享给访客的地址使用 `go.example.com`。

## PostgreSQL 还是 D1

**第一次部署优先选 PostgreSQL。** 一个数据库就能保存可编辑数据和统计；Neon 等托管服务也能直接提供所需的连接地址。仓库默认选择 PostgreSQL，因此需要修改的启动配置最少。

**想把数据放在 Cloudflare 时再选 D1。** D1 需要两个数据库：一个保存规则和设置，另一个保存统计。WebUI 如果不在 Cloudflare 上，还会通过 Cloudflare API 访问它们，因此要多配置 Account ID、Database ID 和 API Token。

两种方案都只让 WebUI 连接数据库。Runtime 始终读取快照，不会拿到数据库凭据。

## Runtime 选哪一个

三个内置适配器使用同一套路由核心，主要差别在部署平台：

- 域名和其他边缘资源已经在 Cloudflare，就选 Cloudflare Workers；
- 平时主要使用 Vercel，就选 Vercel Edge Functions；
- 现有站点和流程已经在 Netlify，就选 Netlify Edge Functions。

功能上不需要因为“支持三个平台”就部署三份。先让一个 Runtime 正常工作，后面真有平台对比、独立入口域名或手动备用需求时再增加。

## 什么时候才部署多个 Runtime

多个 Runtime 可以读取同一份快照，也可以把统计写进同一个 Source。统计页仍能通过入口域名和平台区分它们。

不过 nami 不负责在多个平台之间自动分流。访问进入哪一个 Runtime，仍由 DNS 或你放在前面的流量层决定。没有这层需求时，多部署一份只会多一套域名、密钥和故障点。

## 写下你的选择

继续之前，先把这四项定下来：

```text
WebUI 平台：____________________
数据库：PostgreSQL / D1
Runtime 平台：Cloudflare / Vercel / Netlify
公开 Runtime 域名：____________________
```

下一步是[准备数据库](/zh-CN/deployment/databases)。数据库准备好后，再部署 WebUI 和 Runtime。
