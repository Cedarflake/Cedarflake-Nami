---
title: Database initialization and schema updates
description: Initialize selected databases, then apply later schema updates explicitly and safely.
---

# Database initialization and schema updates

Database initialization and schema updates are external writes. They never run during `build`, application startup, or validation.

Before changing a schema, confirm the selected provider, exact database, current schema version, backup or rollback path, and the application version that will consume the result.

## First deployment

After provisioning the selected databases and exposing their credentials to the invoking shell, run:

```sh
pnpm database:init
```

This command reads `bootstrapConfig`, then initializes the selected data repository schema before the selected analytics store schema. A GitHub data repository has no database schema and is skipped. Internally, each provider applies ordered, checksummed schema migrations and does nothing when the schema is already current.

The command does not discover databases, create D1 databases, transfer data between providers, deploy applications, or run automatically. Review the provider-specific commands below when updating only one store.

## PostgreSQL repository

Set the PostgreSQL binding configured by `bootstrapConfig.data.repository.databaseUrlBinding` for the intended database. Its checked-in default is `DATABASE_URL`. Then run:

```sh
pnpm database:update postgres repository
```

This owns the instance configuration, rules, revision, backup, and rollback tables.

## PostgreSQL analytics

Set the Analytics Store database binding for the intended database. The bundled PostgreSQL Store defaults to `DATABASE_URL`. Then run:

```sh
pnpm database:update postgres analytics
```

The command delegates to `@i0c/plugin-analytics-store-postgres` and owns event, aggregate, retention, and schema history tables.

## D1 repository

Fill `bootstrapConfig.webui.d1.accountId`, the `dataRepository` database ID, and the configured API token binding. Then run:

```sh
pnpm database:update d1 repository
```

## D1 analytics

Fill the same account, the separate `analytics` database ID, and the API token binding. Then run:

```sh
pnpm database:update d1 analytics
```

## Safe sequence

1. Back up the target or confirm it contains disposable data.
2. On the first deployment, run `pnpm database:init` before sending production traffic to the WebUI.
3. On later additive upgrades, deploy code that can tolerate the current schema when appropriate.
4. Run the initialization command or the exact provider schema-update command against the intended target.
5. Inspect the schema version and application health.
6. Deploy or promote the consumer version if it was not deployed first.
7. Keep the rollback decision and old deployment available until checks pass.

Do not use a schema-update command merely to test whether credentials work. Use the plugin health/status surface or a read-only provider command instead.

Adding a table, column, index, or constraint is a **schema migration** in the implementation. The user-facing operation remains a **schema update** because no application data is being moved between database providers.

## Cross-provider moves

These commands only create or upgrade schemas. Moving rows between PostgreSQL and D1 is a separate **data migration** with its own export, transformation, import, verification, and rollback plan.
