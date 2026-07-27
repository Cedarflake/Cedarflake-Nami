# 统计架构与口径

本文定义边缘 Runtime、WebUI Collector 与 PostgreSQL 共同使用的 Analytics V2 契约。实现只依赖标准 PostgreSQL；Neon 可以直接使用，但不需要接入 Neon 专用 API。

## 系统边界

Runtime 与 WebUI 仍然是相互独立的部署：

1. Runtime 处理重定向、代理或未匹配请求。
2. Runtime 构建隐私受限的事件，对完整 JSON 正文签名，再发送到 `https://u.i0c.cc/api/analytics/events`。
3. WebUI Collector 验证签名、时间戳和事件结构，然后写入 PostgreSQL。
4. 已登录的 WebUI 页面查询聚合表并展示数据。

Runtime 不直接连接 PostgreSQL。事件通过各平台的后台执行能力尽力投递；Collector 或数据库故障只会记录日志，不会改变跳转响应。目前没有重试队列，所以 Collector 或网络不可用时可能丢失事件。

## 配置

收集端地址和 source 命名空间统一维护在 `data/config.json`：

```json
{
  "analytics": {
    "ingestEndpoint": "https://u.i0c.cc/api/analytics/events",
    "sourceId": "i0c.cc"
  }
}
```

每套 Runtime 部署只需要配置共用的签名密钥：

```dotenv
ANALYTICS_WRITE_KEY="replace-with-a-32-byte-random-secret"
```

WebUI 部署配置：

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
ANALYTICS_INGEST_SECRET="replace-with-a-32-byte-random-secret"
CRON_SECRET="replace-with-a-32-byte-random-secret"
```

Runtime 与 WebUI 不再读取原有非敏感统计环境变量。平台后台遗留的旧值会被忽略；需要修改时应编辑经过校验的远程 `config.json`，不需要重新构建应用。

`ANALYTICS_WRITE_KEY` 与 `ANALYTICS_INGEST_SECRET` 必须是完全相同的密钥。不要复用 GitHub OAuth、NextAuth 或数据库凭据。

`CRON_SECRET` 单独用于保护每日数据保留端点。Vercel 会把它放在定时请求的
`Authorization` 请求头中；不要复用其他应用密钥。

`analytics.sourceId` 同时表示逻辑统计命名空间和基础域名，并会归一化为小写。使用 `i0c.cc` 时，事件可以报告 `i0c.cc` 及其子域名；其他域名统一存为 `unknown`。这样无需再配置一份域名列表，也能限制入口域名维度无限增长。

## 入口域名与运行平台

两个字段回答不同问题：

- `entryDomain`：访问者实际请求的域名，来自 `request.url.hostname`。
- `provider`：实际处理请求的适配器，即 `cloudflare`、`vercel`、`netlify` 或 `unknown`。

当前 Runtime 命名空间预期包含：

| 入口域名 | 平台 |
|---|---|
| `i0c.cc` | Cloudflare |
| `www.i0c.cc` | Cloudflare |
| `api.i0c.cc` | Cloudflare |
| `vc.i0c.cc` | Vercel |
| `nf.i0c.cc` | Netlify |

`u.i0c.cc` 只承载 WebUI Collector，不是 Runtime 入口。预览部署或 `i0c.cc` 命名空间之外的自定义域名统一进入 `unknown`。如果未来需要把无关自定义域名纳入同一个 source，应新增显式允许列表，而不是直接信任任意 Host。

WebUI 的入口域名筛选会同时作用于总数、趋势、短链接、国家或地区、设备、平台、来源域名、渠道、内部来源和机器人流量分析。因此“全部域名”等于各域名范围与 `unknown` 的总和。

## 事件类型与计数

Analytics V2 有两类事件：

- `link`：最终匹配成功的重定向或代理结果，固定使用 `sampleRate = 1`。
- `runtime`：未匹配或系统结果，固定使用 `sampleRate = 0.1`，同时保存观测值和加权估算值。

代理竞速只为最终成功的候选生成匹配事件，失败候选不会分别计数。Runtime 结果包括：

- `not_found`
- `proxy_exhausted`
- `config_unavailable`
- `internal_error`

成功返回的 `favicon.ico`、`robots.txt` 和 `sitemap.xml` 不产生统计事件；访问任意未匹配路径的请求可以进入抽样 Runtime 事件。

指标采用以下口径：

- 每个被接受的 link 事件都会增加对应短链接的请求数。
- 表现为浏览器文档导航的请求，与已声明机器人、链接预览和疑似机器人流量分开展示。
- 受控短链接链中的每一跳都有自己的请求事件，但只有第一跳计为入口请求。
- Runtime 估算值按 `observed / sampleRate` 计算，同时展示观测值，不隐藏抽样事实。
- 永久重定向可能被浏览器缓存，之后的访问会绕过 Runtime，因此无法继续计数。

## 归因

不同归因维度不会混用。

### 浏览器来源

`referrerDomain` 只保存浏览器 `Referer` 请求头中的归一化域名。缺失、被策略隐藏、格式无效或不是 HTTP(S) 的来源会显示为 `direct`。Runtime 不会根据目标地址或中转服务擅自推断来源。

因此，其他网站或跳转服务指向短链接时，只有浏览器确实提供 Referer 才能记录来源。二维码、复制粘贴、`noreferrer` 和许多多段跳转通常会归为 `direct`。

### 显式渠道

已登录的客户端可以通过下面的接口生成签名渠道链接：

```http
POST /api/analytics/campaigns
Content-Type: application/json

{
  "url": "https://i0c.cc/r",
  "analyticsId": "the-rule-analytics-id",
  "campaignId": "docs-launch",
  "expiresInDays": 30
}
```

返回地址包含签名后的 `_i0c_via` 参数。渠道 token 会绑定 source、统计 ID、精确域名、归一化路径、签发时间和过期时间，最长有效期为 365 天。Runtime 验证 token 后，会先删除保留参数，并通过短期安全 Cookie 完成无参数的后续请求。无效 token 只会被删除，不会成为归因数据。

### 受控短链接链

当短链接 A 通过 HTTPS 跳到同一 source 命名空间内的另一个域名或路径时，A 会附加有效期两分钟的签名上游 token。B 在路由前验证并删除它。PostgreSQL 对每个上游事件只认领一次，因此重复使用同一 token 不会反复减少入口数。

对于 A → B → C：

- A、B、C 各有一条自己的请求事件。
- A 是入口请求。
- B 的内部来源为 A。
- C 的内部来源为 B。

该链路不依赖浏览器 Referer。source 命名空间之外的目标或非 HTTPS 目标不会收到上游 token。

## 机器人与未匹配流量分析

分类属于启发式判断并带有版本号；“疑似机器人流量”不代表已经确认是机器人。

- `declared_bot`：已知搜索爬虫、AI 爬虫、社交预览或监控工具的 User-Agent 特征。
- `suspected_automation`：自动化机器人客户端、通用机器人或扫描器特征，或命中受控可疑路径类别。
- `browser_like`：表现出浏览器导航信号的请求。
- `unknown`：信号不足。

探测类别包括 WordPress 路径、环境变量文件、管理路径、版本控制元数据、路径穿越、扫描器和受控的 `other`。分类只在 Runtime 本地完成，不会向 Collector 发送原始未匹配路径或完整 User-Agent。

机器人流量页面会分开显示观测值与按抽样率调整后的估算值，并支持入口域名筛选。页面包含流量类别、机器人类别、置信度、分类器版本、资源类别、匹配类型、结果、探测类别、平台和受影响短链接。

## 隐私与维度限制

事件不会包含：

- IP 地址
- 完整 User-Agent
- 完整来源 URL
- 请求查询参数
- 重定向或代理目标地址
- 原始未匹配请求路径

匹配事件只包含配置中的规则路径与稳定统计 ID。域名、标识符、枚举、请求正文、时间戳和 token 有效期都会在入库前进行长度和格式限制。Collector 只接受配置的 source ID，签名请求的时间窗口为五分钟。

## 数据库迁移

部署统计 Collector 前，在仓库根目录执行：

```bash
pnpm analytics:migrate
```

迁移工具按文件名顺序在事务中执行，并记录 SHA-256 校验值。迁移一旦执行，不要再修改原文件；后续变更应新增编号更大的迁移。

- `001_short_link_analytics.sql`：原始短链接事件与聚合。
- `002_domain_attribution.sql`：入口域名、渠道、内部来源、分类字段和 UTC 聚合维度。
- `003_runtime_traffic_analysis.sql`：抽样 Runtime 事件、跨事件类型幂等收据和机器人流量分析聚合。
- `004_raw_event_retention.sql`：清理索引和固定 181 天的原始事件保留函数。

推荐发布顺序：

1. 执行全部数据库迁移。
2. 部署同时接受 V1/V2 事件的 WebUI Collector。
3. 配置并部署 Cloudflare Runtime。
4. 配置并部署 Vercel Runtime。
5. 配置并部署 Netlify Runtime。
6. 检查 Collector 错误、`unknown` 入口域名、观测/估算比例及全部域名求和结果。

Vercel 每天调用一次 `/api/analytics/retention`。通过鉴权的端点会删除数据库接收时间超过
181 天的短链接事件、Runtime 事件、幂等收据和过期上游声明。小时与天级聚合表长期保留，
因此历史趋势和上一周期对比不依赖无限期保存原始请求。WebUI 构建过程不会执行保留清理或数据库迁移。

WebUI 提供 1、7、30 和 90 天范围。1 天趋势是滚动 24 小时窗口，底层继续使用 UTC 小时桶，并按设备时区显示；更长范围的查询边界和趋势日桶按当前设备的 IANA 时区对齐。小时与天级聚合表仍以 UTC 存储；对于非 UTC 时区下会受到日期边界影响的细分数据，查询会使用保留的原始事件，确保卡片、趋势与细分覆盖同一时间区间。181 天的原始事件窗口可覆盖两个完整 90 天周期，并额外留出一天处理日期边界和每日清理调度偏差。该窗口为未来重建聚合提供原始数据基础，但不会自动执行重建。

## 验收场景

- 同一短链接分别通过三个 Runtime 域名访问一次：总数为 `3`，各域名为 `1`。
- 从外部网页点击且存在 Referer：记录来源域名。
- 二维码、复制粘贴或 `noreferrer`：显示为 `direct`。
- 签名渠道链接：记录渠道，路由请求中不再包含 `_i0c_via`。
- 受控 A → B：A、B 各记录一次请求，但入口请求只增加一次。
- 机器人访问任意未匹配路径：可以进入抽样 Runtime 与机器人流量分析。
- 旧 V1 事件：继续接收，并归入入口域名 `unknown`。
- Collector 不可用：跳转仍成功，但该事件可能丢失。
