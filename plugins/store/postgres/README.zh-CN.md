# PostgreSQL 统计 Store 插件

负责 PostgreSQL 统计写入、领域查询、聚合重算、保留清理、健康检查与版本化 SQL 迁移。WebUI 和 Collector 通过 `@i0c/plugin-api` 使用 Store，不直接执行 SQL。

PostgreSQL 与 D1 共用同一套统计语义、能力集合与行为契约；两者的 SQL、事务和索引策略仍由各自后端实现。

迁移只能通过插件的显式迁移命令运行；构建、应用启动和普通请求不会自动执行迁移。
