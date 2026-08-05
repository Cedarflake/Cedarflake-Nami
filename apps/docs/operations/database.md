---
title: Initialize or update the database
description: Create tables for a first deployment, then update an existing database only when a release changes its schema.
---

# Initialize or update the database

The database commands are easy to confuse. Use `pnpm database:init` for an empty database during the first deployment. Use the matching `pnpm database:update` only when an existing instance moves to a version that needs another table, column, or index.

Neither command moves PostgreSQL data to D1 or the other way around. If you only need to check a connection, use the plugin status page instead of a write command.

Builds and application startup never run these commands automatically. A normal deployment should not change a database before you have confirmed the target.

## First deployment

Follow [prepare the database](/deployment/databases) to create PostgreSQL, or create separate rules and analytics databases in D1. Once the current shell can read the required credentials, run this from the repository root:

```sh
pnpm database:init
```

The command reads the database choices already made in the repository. It prepares the rules-and-settings tables first, followed by analytics. If GitHub stores the rules, that part has no database schema and is skipped.

It is safe to run again when the tables are already current. It does not create a cloud database, deploy either application, or copy records between database products.

Open the WebUI after it finishes. An empty database should show **Initialize this deployment**; that screen creates the first instance settings and empty rule set.

## Update an existing database

Update only when the application version actually includes a schema change. Use this order:

1. confirm the exact database the command will reach;
2. back it up, or confirm that it contains disposable test data;
3. check how the old and new application versions relate to the change;
4. run the one command that matches the database and purpose below;
5. inspect plugin health, then test the WebUI and analytics queries;
6. keep the previous deployment and a rollback path until verification is complete.

| Database | Data it owns | Command |
| --- | --- | --- |
| PostgreSQL | Rules, settings, and revisions | `pnpm database:update postgres repository` |
| PostgreSQL | Analytics events and aggregates | `pnpm database:update postgres analytics` |
| D1 | Rules, settings, and revisions | `pnpm database:update d1 repository` |
| D1 | Analytics events and aggregates | `pnpm database:update d1 analytics` |

PostgreSQL reads its connection from `DATABASE_URL` by default. D1 reads the Account ID and Database IDs from startup configuration, plus `CLOUDFLARE_D1_API_TOKEN` from the server environment.

## Why D1 has two commands

D1 uses two independent databases: one for rules and settings, and another for analytics. Each has its own tables and version history. Do not swap their Database IDs, and do not expect updating one to update the other.

## What “schema migration” means in the source

The source and database tooling still use **schema migration** for a new table, column, index, or constraint. This guide calls that a database update to distinguish it from moving application data between PostgreSQL and D1.

When changing database products, the initialization and update commands only prepare the destination structure. Existing rules, revisions, and analytics need a separate export, conversion, import, verification, and rollback plan.
