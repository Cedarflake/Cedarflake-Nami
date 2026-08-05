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

The WebUI host must provide a compatible `D1Database` through
`configureAppDataRepositoryBinding` before the Repository is first used. A
native Cloudflare binding can be passed directly. Other server hosts can use
the `@i0c/database-d1/rest` transport with the account ID, database ID, and a
server-only API token.

Initialize a newly selected database with `pnpm database:init`. Apply later
Repository schema revisions with `pnpm database:update d1 repository`. Both
operations are deliberate; builds and application startup never mutate the
database. The Runtime still reads the published snapshot through the HTTP data
source.

The plugin owns its document schema and queries. Shared D1 transport,
migration, and test infrastructure lives in `@i0c/database-d1`.

## Checks

```bash
pnpm --filter @i0c/plugin-data-repository-d1 check
pnpm --filter @i0c/plugin-data-repository-d1 test
```

---

English · [简体中文](README.zh-CN.md)
