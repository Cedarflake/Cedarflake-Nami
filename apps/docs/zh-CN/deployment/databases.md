---
title: 选择数据库
description: 对比 PostgreSQL 与 Cloudflare D1 的 Repository 和统计适配器。
---

# 选择数据库

WebUI 有两个存储插件槽：

- Data Repository：保存实例配置、规则、修订、备份与回滚记录；
- Analytics Store：保存事件、聚合、保留期与查询数据。

Runtime 不会连接其中任何一个 Store。

## PostgreSQL

PostgreSQL 是仓库默认选项。一个 `DATABASE_URL` 可以同时支持两个插件槽，但每个插件仍维护独立的版本化 Schema 与 Schema 更新命令。

以下情况适合 PostgreSQL：

- 已经在使用 Neon 或其他托管 PostgreSQL；
- WebUI 与数据库的网络距离较近；
- 需要直接进行 SQL 检查和使用常规备份工具。

适配器共享 PostgreSQL 连接与 Schema migration 基础设施，但 Repository 与统计 Schema 仍然是独立职责。

## Cloudflare D1

D1 由 WebUI 的服务端适配器通过 Cloudflare API 凭据访问，需要配置两个 Database ID：

- `dataRepository`：实例配置、规则和修订；
- `analytics`：事件与聚合统计。

以下情况适合 D1：

- 更愿意使用 Cloudflare 托管的 SQLite 存储；
- 两个小型、相互隔离的数据库符合负载；
- WebUI 通过 API 管理数据库是可以接受的。

D1 适配器共享原子写入和 Schema migration 基础设施，但两个数据库仍保留独立的 Schema 与版本历史。

## 其他数据库

PostgreSQL 与 D1 是内置实现，不是封闭的数据库列表。一种新数据库通常需要提供保存配置和规则的 `data-repository` 插件、保存统计的 `analytics-store` 插件，并可选增加一个共享连接与 Schema 更新基础设施包。具体流程见[编写适配器](/zh-CN/plugins/adapters#新增规则数据库)。

## 切换 Provider 不会迁移数据

修改 Bootstrap Provider 只会改变后续读写位置，不会把 PostgreSQL 行复制到 D1，也不会把 D1 记录复制到 PostgreSQL。

切换已有数据的实例前，应当：

1. 暂停或限制写入；
2. 导出并转换当前 Repository 与统计数据；
3. 创建并初始化目标 Store；
4. 导入并核对数量与修订；
5. 切换 Bootstrap Provider 并重新部署；
6. 验收完成前保留来源 Store，以便回滚。

i0c.cc 目前提供 Schema 更新，不提供跨 Provider 自动数据迁移工具。
