# D1 analytics Store plugin

Cloudflare D1 implementation of the nami `AnalyticsStore` domain contract. It owns independent SQLite-compatible migrations and supports idempotent ingest, traffic and automation queries, hourly and daily aggregation, raw-event rebuild, 181-day raw retention, health, and capability reporting.

D1 and PostgreSQL share the same analytics semantics, capability set, and behavior contract. Their SQL, transaction, and indexing strategies remain backend-specific.

A WebUI host can select this plugin after providing a compatible `D1Database` through `configureAnalyticsStoreBinding`. Cloudflare hosts can pass a native binding; other server hosts can use the `@nami/database-d1/rest` transport with a server-only API token. Initialize a newly selected database with `pnpm database:init`, and apply later Analytics Schema revisions with `pnpm database:update d1 analytics`. Schema changes are never applied automatically.

The plugin owns analytics tables and domain queries. Shared D1 transport, migration, and test infrastructure lives in `@nami/database-d1`.

```bash
pnpm --filter @nami/plugin-analytics-store-d1 check
pnpm --filter @nami/plugin-analytics-store-d1 test
```

---

English · [简体中文](README.zh-CN.md)
