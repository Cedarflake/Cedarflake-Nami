---
title: 选择部署拓扑
description: 选择一个控制面、一套存储方案，以及一个或多个相互独立的 Runtime 平台。
---

# 选择部署拓扑

平台适配器代表可选的部署目标，并不要求你同时运行三份应用。

## 推荐默认方案

```text
Vercel WebUI ──► PostgreSQL
      ▲              ├── 配置与规则
      │              └── 统计
      │
一个 Runtime ──► Cloudflare、Vercel 或 Netlify
```

仓库默认已经为两个 Store 选择 PostgreSQL，因此这套方案最直接。

## Cloudflare 存储方案

```text
WebUI ──► D1 Repository 数据库
   └───► D1 统计数据库

Runtime ──► WebUI 快照与 Collector 端点
```

建议使用两个 D1 数据库，让 Repository 修订和高频统计事件拥有独立的 Schema migration 历史与运行限制。WebUI 通过服务端适配器访问 D1；Runtime 仍然不会接收数据库凭据。

## 多 Runtime 平台

只有在需要独立域名、比较平台或手动备用时，才需要部署多个 Runtime。每个部署都会：

- 构建相同的路由 Host；
- 读取同一份 WebUI 快照；
- 使用相同的统计 `sourceId`；
- 记录各自的 `provider` 与 `entryDomain`。

i0c.cc 不负责这些部署之间的全局流量调度。由 DNS 或其他外部流量层决定请求进入哪个平台。

## 混合 Store

Repository 与统计 Store 是两个独立插件槽，因此可以使用不同 Provider。混合方案是有效的，但也意味着维护两套外部系统；没有明确需求时，优先使用同一数据库家族。

## 选择参考

| 需求 | 建议选择 |
| --- | --- |
| 最精简部署 | PostgreSQL + 一个 Runtime |
| Cloudflare 托管数据 | 两个 D1 数据库 + 一个 Runtime |
| 编辑后立即生效，不依赖 Git 构建 | PostgreSQL 或 D1 Repository |
| 比较不同边缘平台 | 多个 Runtime 共享一个 WebUI |
| 以只读 Git 历史作为数据源 | GitHub Repository 适配器 |
