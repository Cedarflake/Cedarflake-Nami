# Cloudflare D1 data repository

This compile-time WebUI plugin stores `config` and `redirects` as versioned
Cloudflare D1 documents. It implements the same managed Data Repository
behavior contract as the PostgreSQL plugin:

- atomic first-run initialization and two-document import;
- optimistic revision checks for every write;
- immutable revision history and non-destructive restore;
- atomic snapshots for the Runtime HTTP Snapshot Source;
- migration checksums and continuous-history validation.

## Host requirements

The WebUI host must provide a compatible `D1Database` binding through
`configureAppDataRepositoryBinding` before the Repository is first used. Apply
both SQL files in [migrations](migrations) to that binding deliberately; builds
and application startup never mutate the database.

The checked-in Vercel WebUI continues to use PostgreSQL. Selecting D1 is meant
for a D1-capable WebUI host and still requires the HTTP Runtime data source.

## Checks

```bash
pnpm --filter @i0c/plugin-data-repository-d1 check
pnpm --filter @i0c/plugin-data-repository-d1 test
```
