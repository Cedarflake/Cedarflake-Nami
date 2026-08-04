# D1 Analytics Store 插件

i0c.cc `AnalyticsStore` 领域契约的 Cloudflare D1 实现。它拥有独立的 SQLite 兼容迁移，并支持幂等写入、流量与自动化查询、小时与天级聚合、原始事件重算、181 天原始事件保留、健康检查和能力声明。

D1 与 PostgreSQL 共用同一套统计语义、能力集合与行为契约；两者的 SQL、事务和索引策略仍由各自后端实现。

WebUI 宿主可以通过 `configureAnalyticsStoreBinding` 提供兼容的 `D1Database` 后选择该插件。Cloudflare 宿主可以直接传入原生 binding；其他服务端宿主可以使用 `@i0c/database-d1/rest`，并配置仅服务端可见的 API Token。首次使用新数据库时运行 `pnpm database:init` 完成初始化；后续 Analytics Schema 变更使用 `pnpm database:update d1 analytics` 更新。Schema 变更不会自动执行。

插件负责统计表结构与领域查询；共用的 D1 传输、迁移和测试基础设施位于 `@i0c/database-d1`。

```bash
pnpm --filter @i0c/plugin-analytics-store-d1 check
pnpm --filter @i0c/plugin-analytics-store-d1 test
```
