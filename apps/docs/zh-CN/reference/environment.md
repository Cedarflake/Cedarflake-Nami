---
title: 环境绑定
description: 区分部署密钥与可编辑的非敏感配置。
---

# 环境绑定

环境变量只用于凭据和兼容值。非敏感设置应放在 Bootstrap 或实例配置中。

## WebUI

| 变量 | 必填条件 | 用途 |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | 始终必填 | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | 始终必填 | GitHub OAuth Client Secret |
| `I0C_SECRET` | 始终必填 | Session、初始化、统计与归因签名密钥 |
| `DATABASE_URL` | 选择 PostgreSQL Repository 或统计 Store | 仅服务端使用的 PostgreSQL 连接字符串 |
| `CLOUDFLARE_D1_API_TOKEN` | 使用 D1 适配器或 D1 Schema 更新命令 | 仅服务端使用的 D1 读写 API Token |
| `NEXTAUTH_URL` | 无法推断部署 URL | 可选 Auth.js 兼容覆盖 |

## Runtime

| 变量 | 是否必填 | 用途 |
| --- | --- | --- |
| `I0C_SECRET` | 是 | 验证快照，并签名统计与归因 Payload |

Runtime 不需要数据库凭据。它的密钥必须与 WebUI 完全一致，并且不少于 32 个字符。

## 实例配置中的绑定名称

插件 `secrets` 对象保存环境变量名称，而不是真实密钥：

```json
{
  "secrets": {
    "databaseUrl": "DATABASE_URL"
  }
}
```

这样，同一份实例文档可以引用平台管理的值，同时避免凭据出现在仓库、快照、浏览器或 API 响应中。

## 非敏感设置

不要再把以下内容迁回环境变量：

- Runtime 规范域名与缓存 TTL；
- Analytics Collector URL 与 Source ID；
- GitHub 数字访问名单；
- 插件启用状态与公开选项；
- D1 Account 与 Database ID；
- Repository 与 Store Provider 选择。

Provider 选择和 D1 ID 属于 Bootstrap 配置，因为打开可编辑 Repository 前就需要它们。其余值由 WebUI 实例设置管理。

## 密钥轮换

轮换 `I0C_SECRET` 会使当前 WebUI Session 失效，并要求更新每个 Runtime 部署。请把它作为一次完整维护处理；新旧值混用会导致快照认证和统计投递失败。
