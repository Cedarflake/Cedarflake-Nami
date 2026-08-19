---
title: 统计口径
description: 查询统计页面中各项数字、时间范围、归因、抽样和保留期的准确含义。
---

# 统计口径

统计页里最容易看错的是“观测”和“估算”，其次是 24 小时与自然日的边界。只想知道页面怎么读，可以看[查看统计](/zh-CN/guide/analytics)；需要核对字段和计算方式时，再从这里查。

## 几个容易混淆的数字

| 页面名称 | 它表示什么 |
| --- | --- |
| 已匹配请求 | Runtime 实际收到并成功写入的规则命中事件 |
| 有效访问 | 被分类为人类入口导航的估算次数，排除机器人、预览和受控续跳 |
| 入口请求 | 已匹配请求中排除已验证内部续跳后的次数 |
| 观测样本 | 数据库实际收到的抽样事件数 |
| 估算请求 | `观测样本 ÷ 抽样率`，用于未匹配和系统流量 |
| 全部入口域名 | 当前统计来源下，各已识别域名与 `unknown` 的合计 |

“估算”不会覆盖观测值。机器人页面会优先显示数据库真正收到多少条，再把估算结果作为参考。

## 数据怎么走到图表里

1. Runtime 完成跳转、反代或未匹配处理；
2. Runtime 在本地提取有限字段，用 `NAMI_SECRET` 对事件签名；
3. WebUI 的 Collector 验证签名、时间和正文，再写入所选统计存储；
4. 已登录的 WebUI 查询聚合或保留的原始事件。

Runtime 不连接 PostgreSQL 或 D1。事件通过平台提供的后台任务尽力投递；Collector 或数据库暂时不可用时，当前跳转仍会返回，但这条事件可能丢失。目前没有持久重试队列。

## 时间范围和上一周期

- **1 天**是从当前时刻向前滚动 24 小时，按小时展示；
- **7、30、90 天**使用浏览器设备的 IANA 时区划分自然日；
- 图表横轴、提示时间和查询边界使用同一设备时区；
- “上一周期”总是紧邻当前范围之前、长度相同的一段时间。

数据库中的小时和天级聚合仍以 UTC 存储。日期边界受设备时区影响的查询会在 181 天窗口内使用保留的原始事件，确保卡片、趋势和细分覆盖同一时间段。

上一周期为 0、本周期大于 0 时不会计算无意义的百分比，而是显示上一周期没有请求；两个周期都为 0 时显示持平。

## 哪些事件会被记录

Analytics V2 使用两类事件：

- `link`：规则成功匹配后的跳转或反代结果，`sampleRate = 1`；
- `runtime`：未匹配或系统结果，`sampleRate = 0.1`。

Runtime 系统结果包括 `not_found`、`proxy_exhausted`、`config_unavailable` 和 `internal_error`。成功返回的 `favicon.ico`、`robots.txt` 与 `sitemap.xml` 不产生统计事件。

反代有多个候选时，只为最终成功的候选生成匹配事件，失败候选不会各算一次。永久重定向可能被浏览器缓存；后续访问没有到达 Runtime，自然也不会产生新事件。

## 入口域名和运行平台

`entryDomain` 和 `provider` 看起来相近，记录的其实不是一件事：

- `entryDomain`：访客实际请求的 Runtime 域名；
- `provider`：处理请求的平台适配器，如 `cloudflare`、`vercel` 或 `netlify`。

`analytics.sourceId` 是整套实例的统计命名空间，也是允许的基础域名。若值为 `i0c.cc`，`i0c.cc` 与它的子域名可以各自成为入口域名；命名空间之外的 Host 记录为 `unknown`。

当前公开实例使用：

| 入口域名 | 平台 |
| --- | --- |
| `i0c.cc`、`www.i0c.cc`、`api.i0c.cc` | Cloudflare |
| `vc.i0c.cc` | Vercel |
| `nf.i0c.cc` | Netlify |

`u.i0c.cc` 是 WebUI 和 Collector，不是 Runtime 入口。入口域名筛选会同时作用于总数、趋势、热门路由、来源、平台和机器人视图。

## 来源、渠道和短链接续跳

页面会把这三种来源分开显示。

### 浏览器来源

`referrerDomain` 只保存浏览器 `Referer` 中的域名。请求没有 Referer、使用 `noreferrer`、来源格式无效或不是 HTTP(S) 时，显示为 `direct`。Runtime 不会根据目标地址猜测来源。

二维码、复制粘贴和许多多段跳转因此都会落在 `direct`，这是浏览器能提供的信息有限，不是统计丢失。

### 显式渠道

已登录用户可以通过 `POST /api/analytics/campaigns` 生成签名渠道链接：

```json
{
  "url": "https://i0c.cc/r",
  "analyticsId": "the-rule-analytics-id",
  "campaignId": "docs-launch",
  "expiresInDays": 30
}
```

返回链接中的 `_nami_via` 会绑定统计来源、规则 ID、域名、路径和有效期，最长 365 天。Runtime 验证后会删除该参数，再通过短期安全 Cookie 完成后续无参数请求。无效 Token 会被移除，但不会写成有效渠道。

### 受控短链接链

短链接 A 跳到同一统计命名空间内的 B 时，A 会添加两分钟有效的签名上游 Token。B 在匹配前验证并移除它，统计存储对同一个上游事件只认领一次。

对于 A → B → C：

- 三条规则各有一条自己的命中事件；
- 只有 A 是入口请求；
- B 的内部来源是 A，C 的内部来源是 B。

这条链不依赖浏览器 Referer，也不会把 Token 发送给非 HTTPS 或命名空间之外的目标。

## 机器人和未匹配流量

这些分类只描述请求表现出来的特征，不能证明访问者身份：

- `declared_bot`：User-Agent 明确表现为已知爬虫、预览或监控工具；
- `suspected_automation`：出现自动化客户端、扫描器或可疑路径特征；
- `browser_like`：具有浏览器导航信号；
- `unknown`：没有足够信号。

WordPress 探测、环境变量文件、管理路径、版本控制元数据和路径穿越等未匹配请求会先在 Runtime 本地归类。Collector 只收到类别，不会收到原始未匹配路径或完整 User-Agent。

未匹配与系统事件按 10% 抽样，因此页面同时显示观测样本和估算请求。`suspected_automation` 只代表分类器认为“像自动化”，不等于已经确认是机器人。

## 不会保存哪些内容

统计事件不包含：

- IP 地址；
- 完整 User-Agent；
- 完整来源 URL；
- 原始查询参数；
- 跳转或反代目标地址；
- 原始未匹配路径。

匹配事件只保存配置中的规则路径和稳定统计 ID。域名、标识符、枚举、正文长度、时间戳和 Token 有效期都会在入库前校验。Collector 只接受当前实例的 Source ID，签名请求有效窗口为五分钟。

## 配置和密钥

实例设置保存统计接收地址和来源 ID：

```json
{
  "analytics": {
    "ingestEndpoint": "https://u.i0c.cc/api/analytics/events",
    "sourceId": "i0c.cc"
  }
}
```

WebUI 与所有 Runtime 使用同一个 `NAMI_SECRET`。PostgreSQL 统计存储还需要 `DATABASE_URL`；D1 使用启动配置中的 Account 与 Database ID，以及仅服务端可见的 `CLOUDFLARE_D1_API_TOKEN`。

轮换 `NAMI_SECRET` 会让现有 WebUI Session 失效，并要求重新部署每一个 Runtime。新旧值混用时，快照认证、统计投递和短链接归因都会失败。

## 数据库结构和保留期

PostgreSQL 与 D1 实现同一套统计存储契约，查询口径相同。它们各自维护有顺序、带校验值的数据库更新历史；构建、启动和普通请求不会自动改表。

更新已有统计数据库时使用：

```sh
pnpm database:update postgres analytics
pnpm database:update d1 analytics
```

原始规则事件、Runtime 事件、幂等记录和过期上游声明保留 181 天。小时与天级聚合继续保留，因此 90 天趋势和上一周期对比不要求无限保存原始请求。保留任务由 WebUI 在有事件写入后安排，每个运行实例每天最多执行一次。

181 天足以覆盖两个完整 90 天周期，并额外留出一天处理时区边界和清理间隔。它为手动重建聚合保留数据基础，但不会自动触发重建。

## 核对实现时可用的场景

- 同一规则分别通过三个 Runtime 域名访问一次：总数为 3，各域名为 1；
- 外部网页带 Referer 点击：记录来源域名；
- 二维码、复制粘贴或 `noreferrer`：显示为 `direct`；
- 签名渠道链接：记录渠道，路由请求不再包含 `_nami_via`；
- A → B：两条规则各记录一次，但入口请求只增加一次；
- 机器人访问未匹配路径：可以进入抽样 Runtime 与机器人分析；
- Collector 不可用：跳转仍成功，但事件可能丢失。
