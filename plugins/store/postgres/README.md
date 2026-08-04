# PostgreSQL analytics store plugin

Owns PostgreSQL analytics ingestion, domain queries, aggregate rebuilds, retention, health checks, and versioned SQL migrations. WebUI and Collector consume the store through `@i0c/plugin-api`; they do not issue SQL directly.

PostgreSQL and D1 share the same analytics semantics, capability set, and behavior contract. Their SQL, transaction, and indexing strategies remain backend-specific.

The plugin owns analytics tables and domain queries. Shared PostgreSQL client construction and migration-history enforcement lives in `@i0c/database-postgres`.

Migrations run only through the explicit plugin migration command. Builds, application startup, and ordinary requests never apply migrations automatically.
