# PostgreSQL data repository

This compile-time WebUI plugin stores `config` and `redirects` as versioned
PostgreSQL documents. It provides optimistic writes and an atomic read snapshot
without coupling the Runtime to PostgreSQL.

## Requirements

- PostgreSQL compatible with the `postgres` client.
- `DATA_REPOSITORY_DATABASE_URL` for the migration command and the WebUI
  bootstrap binding.
- Applied migrations from this package before selecting the plugin.
- Both documents seeded before the WebUI or Runtime snapshot endpoint reads
  them.

## Commands

```bash
pnpm --filter @i0c/plugin-data-repository-postgres check
pnpm --filter @i0c/plugin-data-repository-postgres test
pnpm --filter @i0c/plugin-data-repository-postgres migrate
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

The migration and seed commands mutate the configured database. Do not use
them as validation commands. Seeding validates both files and creates only
missing documents in one transaction; it never overwrites existing content.
The seed `config.json` must enable the PostgreSQL Repository and HTTP Snapshot
Source declarations selected by the build.

## Storage contract

- Document revision `0` means that the first write may create the document.
- Later writes must provide the current numeric revision.
- A stale revision is rejected instead of overwriting newer content.
- Snapshot reads return both documents from one repeatable-read transaction.
- This package has its own migration table and does not share analytics
  migrations.
