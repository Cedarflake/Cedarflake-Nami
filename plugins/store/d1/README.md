# D1 analytics Store plugin

Cloudflare D1 implementation of the i0c.cc `AnalyticsStore` domain contract. It owns independent SQLite-compatible migrations and supports idempotent ingest, traffic and automation queries, hourly and daily aggregation, raw-event rebuild, 181-day raw retention, health, and capability reporting.

D1 and PostgreSQL share the same analytics semantics, capability set, and behavior contract. Their SQL, transaction, and indexing strategies remain backend-specific.

A D1-capable WebUI host can select this plugin after injecting its binding through `configureAnalyticsStoreBinding`. The checked-in Vercel deployment does not provide that binding. Migrations are never applied automatically.

```bash
pnpm --filter @i0c/plugin-analytics-store-d1 check
pnpm --filter @i0c/plugin-analytics-store-d1 test
```
