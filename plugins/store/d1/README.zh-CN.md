# D1 Analytics Store 插件

i0c.cc `AnalyticsStore` 领域契约的 Cloudflare D1 实现。它拥有独立的 SQLite 兼容迁移，并支持幂等写入、流量与自动化查询、小时与天级聚合、原始事件重算、181 天原始事件保留、健康检查和能力声明。

D1 与 PostgreSQL 共用同一套统计语义、能力集合与行为契约；两者的 SQL、事务和索引策略仍由各自后端实现。

支持 D1 的 WebUI 宿主可以通过 `configureAnalyticsStoreBinding` 注入 binding 后选择该插件。仓库当前的 Vercel 部署没有提供此 binding。迁移不会自动执行。

```bash
pnpm --filter @i0c/plugin-analytics-store-d1 check
pnpm --filter @i0c/plugin-analytics-store-d1 test
```
