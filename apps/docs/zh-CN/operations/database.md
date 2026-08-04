---
title: 数据库初始化与 Schema 更新
description: 首次初始化所选数据库，并在后续显式、安全地更新 Schema。
---

# 数据库初始化与 Schema 更新

数据库初始化和 Schema 更新都属于外部写入，不会随 `build`、应用启动或校验命令自动执行。

修改 Schema 前，请确认所选 Provider、准确数据库、当前 Schema 版本、备份或回滚路径，以及将使用新结构的应用版本。

## 首次部署

创建好所选数据库，并让执行命令的 Shell 能读取相应凭据后，运行：

```sh
pnpm database:init
```

该命令读取 `bootstrapConfig`，先初始化所选 Data Repository Schema，再初始化所选 Analytics Store Schema。GitHub Data Repository 没有数据库 Schema，因此会自动跳过。内部由各 Provider 按顺序执行带校验值的 Schema migration；Schema 已是最新时不会重复修改。

该命令不会自动发现或创建数据库，不会在 Provider 之间搬运数据，不会部署应用，也不会被自动调用。只升级某一个 Store 时，请使用下方对应的 Provider 命令。

## PostgreSQL Repository

把 `bootstrapConfig.data.repository.databaseUrlBinding` 配置的 PostgreSQL Binding 指向目标数据库；仓库默认值为 `DATABASE_URL`。然后运行：

```sh
pnpm database:update postgres repository
```

该命令负责创建或更新实例配置、规则、修订、备份和回滚相关表。

## PostgreSQL 统计

把 Analytics Store 的数据库 Binding 指向目标数据库；内置 PostgreSQL Store 默认使用 `DATABASE_URL`。然后运行：

```sh
pnpm database:update postgres analytics
```

该命令转交 `@i0c/plugin-analytics-store-postgres`，负责事件、聚合、保留期和 Schema 历史表。

## D1 Repository

填写 `bootstrapConfig.webui.d1.accountId`、`dataRepository` Database ID，以及配置的 API Token Binding，然后运行：

```sh
pnpm database:update d1 repository
```

## D1 统计

填写同一 Account、单独的 `analytics` Database ID 和 API Token Binding，然后运行：

```sh
pnpm database:update d1 analytics
```

## 安全顺序

1. 备份目标数据库，或确认其中是可丢弃的测试数据。
2. 首次部署时，在 WebUI 接收生产流量前运行 `pnpm database:init`。
3. 后续兼容新增的升级中，可在合适时先部署兼容旧 Schema 的代码。
4. 对明确的目标运行统一初始化命令或准确的 Provider 命令。
5. 检查 Schema 版本和应用健康状态。
6. 如果消费者版本尚未部署，再部署或提升该版本。
7. 验证完成前保留回滚方案和旧部署。

不要为了测试凭据而运行 Schema 更新。请使用插件健康状态页或 Provider 的只读命令。

新增表、字段、索引或约束，在实现层仍属于标准的 **Schema migration**；面向使用者时统一称为 **Schema 更新**，因为它并没有在数据库 Provider 之间搬运业务数据。

## 跨 Provider 搬迁

这些命令只负责创建或升级 Schema。把记录从 PostgreSQL 搬到 D1 或反向搬运，才属于单独的**数据迁移**，需要另行规划导出、转换、导入、核对和回滚。
