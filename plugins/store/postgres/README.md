# PostgreSQL analytics store plugin

Owns PostgreSQL analytics ingestion, domain queries, aggregate rebuilds, retention, health checks, and versioned SQL migrations. WebUI and Collector consume the store through `@nami/plugin-api`; they do not issue SQL directly.

PostgreSQL and D1 share the same analytics semantics, capability set, and behavior contract. Their SQL, transaction, and indexing strategies remain backend-specific.

The plugin owns analytics tables and domain queries. Shared PostgreSQL client construction and migration-history enforcement lives in `@nami/database-postgres`.

Initialize a newly selected database with `pnpm database:init`. Apply later Analytics Schema revisions with `pnpm database:update postgres analytics`. Builds, application startup, and ordinary requests never update the schema automatically.

---

English · [简体中文](README.zh-CN.md)
