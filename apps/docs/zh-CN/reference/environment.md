---
title: 环境变量与密钥
description: 查询 WebUI 和 Runtime 分别需要哪些环境变量，以及哪些设置不应再放进环境变量。
---

# 环境变量与密钥

nami 早期有不少非敏感设置也放在环境变量里，改一次配置就要去几个平台分别操作。现在只保留密钥和平台注入的值；域名、缓存时间、访问名单和插件开关交给 WebUI 或启动配置。

所以，遇到一个会经常修改、又不是凭据的值时，先给它找设置页或配置文件，不要继续增加环境变量。

## WebUI 需要什么

| 变量 | 什么时候必填 | 用途 |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | 始终 | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | 始终 | GitHub OAuth Client Secret |
| `NAMI_SECRET` | 始终 | Session、首次初始化、快照、统计和归因签名 |
| `DATABASE_URL` | 使用 PostgreSQL 保存规则或统计 | 仅服务端读取的 PostgreSQL 连接地址 |
| `CLOUDFLARE_D1_API_TOKEN` | WebUI 通过 Cloudflare API 访问 D1 | 仅服务端读取的 D1 读写 Token |
| `NEXTAUTH_URL` | Auth.js 无法正确判断公开地址 | 覆盖 WebUI 的公开 URL，通常不需要手动填写 |

WebUI 是唯一连接数据库的应用。不要把 `DATABASE_URL` 或 D1 Token 配给 Runtime。

## Runtime 需要什么

| 变量 | 是否必填 | 用途 |
| --- | --- | --- |
| `NAMI_SECRET` | 是 | 验证 WebUI 快照，并签名统计和归因事件 |

Runtime 和 WebUI 的值必须完全相同，且至少 32 个字符。Cloudflare、Vercel 和 Netlify 若同时部署，也都使用同一个值。

## 设置页为什么显示环境变量名称

插件配置保存的是“去环境中读取哪个名字”，不是密钥本身：

```json
{
  "secrets": {
    "databaseUrl": "DATABASE_URL"
  }
}
```

这让同一份实例配置可以在不同平台引用各自托管的密钥，同时避免值出现在数据库文档、Runtime 快照、浏览器或 API 响应里。

如果这里误填了真实密钥，WebUI 会把它当成环境变量名称，插件反而找不到对应值。

## 哪些内容不属于环境变量

下面这些内容已经有更合适的配置入口：

- Runtime 公开地址与缓存时间；
- 统计接收地址与来源 ID；
- GitHub 数字用户的管理者和黑名单；
- 已安装插件的启用状态与公开选项；
- D1 Account ID 和 Database ID；
- 规则存储与统计存储的数据库类型。

前四项可以在 WebUI 设置页修改。D1 ID 和数据库类型要在应用打开可编辑数据前确定，因此放在仓库启动配置中；它们不是密钥，但修改后需要重新构建。

## 轮换 `NAMI_SECRET`

把轮换当作一次完整维护，而不是只改 WebUI：

1. 生成新的随机值；
2. 更新 WebUI 和每一个仍在使用的 Runtime；
3. 重新部署这些应用；
4. 重新登录 WebUI，并验证快照和统计投递。

轮换会让现有 WebUI Session 失效。新旧值混用时，Runtime 会拒绝快照，Collector 也会拒绝统计事件。
