---
title: Prepare the database
description: Create PostgreSQL or D1 storage and initialize the tables nami needs before the first deployment.
---

# Prepare the database

Only the WebUI connects to the database. It stores instance settings, redirect rules, revision history, and optional analytics; the Runtime never opens a database connection.

If you have not made a deliberate choice yet, use PostgreSQL. It is the repository default and one database is enough.

## Use PostgreSQL

Create an empty database in Neon or another PostgreSQL service and copy its connection string. It usually looks like this:

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

Add the value to the WebUI deployment environment. The local shell that runs initialization must also be able to read the same value temporarily.

After installing dependencies, run this from the repository root:

```sh
pnpm database:init
```

The command prepares the rule-and-settings tables first, then the analytics tables. It only touches the database plugins selected by the current bootstrap configuration, and it is safe to run again when their schemas are already current.

At this point the database structure exists, but the instance documents do not. The WebUI's first-run screen creates the first settings document and an empty rule set later.

## Use Cloudflare D1

D1 needs two empty databases:

- a rules database for settings, rules, and revisions;
- an Analytics database for events and aggregates.

Create both in the Cloudflare dashboard, then note the Account ID and both Database IDs. Update `packages/config/src/defaults.ts`:

1. set `data.repository.provider` to `"d1"`;
2. set `webui.analyticsStore.provider` to `"d1"`;
3. fill in `webui.d1.accountId` and both `databaseIds`.

Give the WebUI and the local initialization command a token with read/write access to those D1 databases:

```dotenv
CLOUDFLARE_D1_API_TOKEN="your-d1-read-write-api-token"
```

Then run the same command from the repository root:

```sh
pnpm database:init
```

The bundled WebUI reaches D1 through Cloudflare's server-side API. A future host that can inject native D1 bindings may use the same database contract through a custom adapter.

## Initialization is never automatic

`pnpm build`, application startup, and ordinary health checks do not create or update tables. Run `pnpm database:init` for a new deployment. When a later release adds schema changes to an existing instance, use the `pnpm database:update` commands described under [database updates](/operations/database).

Switching between PostgreSQL and D1 does not copy existing data. It only changes where later reads and writes happen; moving a live instance requires a separate export, conversion, import, and verification process.

Once the database is ready, continue with [deploy the WebUI](/deployment/webui).
