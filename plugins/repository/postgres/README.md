# PostgreSQL data repository

This compile-time WebUI plugin stores `config` and `redirects` as versioned
PostgreSQL documents. It provides optimistic writes and an atomic read snapshot
without coupling the Runtime to PostgreSQL.

The plugin owns its document schema, transactions, and domain queries. Shared
PostgreSQL client construction and migration-history enforcement lives in
`@i0c/database-postgres`.

## Requirements

- PostgreSQL compatible with the `postgres` client.
- `DATABASE_URL` for the bundled database commands and optional seed command.
- The configured WebUI bootstrap database binding, `DATABASE_URL` by default;
  both variables may point to the same database.
- The selected Repository Schema initialized before opening the WebUI setup flow.
- Both documents initialized through the WebUI setup flow or the optional
  non-interactive seed command before the Runtime snapshot endpoint reads them.

## Commands

```bash
pnpm --filter @i0c/plugin-data-repository-postgres check
pnpm --filter @i0c/plugin-data-repository-postgres test
pnpm database:init
pnpm database:update postgres repository
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

The initialization, Schema-update, and seed commands mutate the configured
database. Do not use them as validation commands. The normal first-run flow
initializes the Schema, then lets the WebUI create both documents atomically after GitHub
authentication and shared instance-secret verification. Seeding remains
available for controlled non-interactive imports; it validates both files,
creates only missing documents in one transaction, and never overwrites
existing content.
The seed `config.json` must enable the PostgreSQL Repository and HTTP Snapshot
Source declarations selected by the build.

## Storage contract

- Document revision `0` means that the first write may create the document.
- Later writes must provide the current numeric revision.
- A stale revision is rejected instead of overwriting newer content.
- Snapshot reads return both documents from one repeatable-read transaction.
- Every initialization, save, import, and restore writes immutable
  history. Restoring old content creates a new head revision.
- This package has its own Schema history table and does not share Analytics
  Schema revisions.
