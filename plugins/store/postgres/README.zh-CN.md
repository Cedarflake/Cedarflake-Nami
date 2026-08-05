# PostgreSQL 统计 Store 插件

负责 PostgreSQL 统计写入、领域查询、聚合重算、保留清理、健康检查与版本化 SQL 迁移。WebUI 和 Collector 通过 `@i0c/plugin-api` 使用 Store，不直接执行 SQL。

PostgreSQL 与 D1 共用同一套统计语义、能力集合与行为契约；两者的 SQL、事务和索引策略仍由各自后端实现。

插件负责统计表结构与领域查询；共用的 PostgreSQL 客户端创建和迁移历史校验位于 `@i0c/database-postgres`。

首次使用新数据库时运行 `pnpm database:init` 完成初始化；后续 Analytics Schema 变更使用 `pnpm database:update postgres analytics` 更新。构建、应用启动和普通请求不会自动更新 Schema。

---

[English](README.md) · 简体中文
