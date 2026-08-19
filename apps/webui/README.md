<img src="../../assets/brand/webui-wordmark.webp" alt="Nami" width="720">

## Project Overview

Nami WebUI is a management panel based on Next.js 16, designed for online editing of `config.json` and `redirects.json` after logging in via GitHub OAuth. The checked-in deployment uses PostgreSQL for immediate, optimistic saves, atomic snapshots, immutable revision history, and rollback. The former GitHub Contents workflow remains an archived build-time alternative and is not enabled by default.

This WebUI supports the personal [Nami](https://github.com/Cedarflake/Cedarflake-Nami) workflow. It is maintained as an optional management surface rather than a general-purpose enterprise URL management product.

Server-side Data Repository and Analytics Store factories are installed at build time through [../../nami.webui.config.ts](../../nami.webui.config.ts). Client-safe UI renderers use [webui.extensions.ts](webui.extensions.ts) so they remain in the client bundle. Workspace fixtures exercise both installation paths without adding factory mappings to WebUI host source; the production renderer list is intentionally empty.

This project provides two rule-editing modes and a separate settings surface:

- Visual rule editing (group tree + form)
- Rules JSON editing (right panel, directly edit `redirects.json`)
- Visual instance settings in the bottom of the sidebar (`config.json`, with shared contract validation)
- Database-backed backup import/export and immutable revision history

## Quick Start

1. From `apps/webui`, copy the example environment variables:

   - macOS/Linux:
     ```bash
     cp .env.example .env.local
     ```
   - Windows PowerShell:
     ```powershell
     Copy-Item .env.example .env.local
     ```

2. Create a PostgreSQL database and configure `DATABASE_URL` for the WebUI. From the repository root, initialize both selected database-backed plugin slots:

   ```bash
   pnpm database:init
   ```

   The command reads the checked-in Bootstrap provider choices, initializes the Data Repository first, then the Analytics Store. It is idempotent when both schemas are current. Initialization is a deliberate external write and is never run by the build, startup, health checks, or ordinary requests.

   To use D1 instead, select `provider: "d1"` for the Repository and Analytics Store in [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts). On a host without native D1 bindings, fill the non-sensitive Cloudflare Account and Database IDs in `bootstrapConfig.webui.d1`, then configure `CLOUDFLARE_D1_API_TOKEN` with D1 read/write permission before running the same initialization command.

   The initialization command only creates or upgrades the selected schemas. It does not
   copy PostgreSQL documents, revision history, or analytics records into D1.

   A host supplying native bindings may leave the REST identifiers empty, but it must apply the same plugin schema migrations through its own D1 tooling. Builds and startup never apply them automatically.

3. Create a GitHub OAuth App with callback URL `http(s)://<localhost:3000 or your domain>/api/auth/callback/github`. Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The default OAuth scope is `read:user user:email`; Repository permissions are not required by the PostgreSQL control plane.

4. Generate one `NAMI_SECRET` value of at least 32 random bytes and configure the same value on the WebUI and every Runtime provider. NextAuth normally infers the request origin; set the optional `NEXTAUTH_URL` override only when a self-hosted proxy does not forward it correctly.

   - Using OpenSSL:
     ```bash
     openssl rand -base64 32
     ```
   - Or using Node.js:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

5. From the repository root, install dependencies and start the development server:

   ```bash
   pnpm install
   pnpm webui:dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) or your deployment. When the database is empty, the WebUI enters its setup page. Sign in with GitHub, enter the shared `NAMI_SECRET`, choose the deployed Runtime adapters and public origins, then create the initial `config.json` and empty `redirects.json` atomically. The signed-in GitHub account becomes the first manager.

7. Keep `NAMI_SECRET` configured after initialization because it also signs WebUI sessions and Runtime analytics events.

## Data repository

The checked-in deployment selects PostgreSQL through [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts) and uses `DATABASE_URL`. Selecting D1 makes the bundled WebUI use an injected native `D1Database` binding when present, otherwise it connects through Cloudflare's server-side REST API using the configured Account ID, Database ID, and `CLOUDFLARE_D1_API_TOKEN`.

PostgreSQL and D1 are held to the same shared behavior contract. First-run setup creates both documents atomically and refuses partially initialized databases. Confirming a visual rule dialog saves that mutation immediately and creates an immutable revision. GitHub Contents instead advertises manual-save capability, so its editor retains the page-level Save action and local undo/redo. Import validates both JSON files and replaces them atomically, while restore copies an old document into a new head revision instead of rewriting history. Managers can export, import, inspect, and restore revisions from **Settings → Data and history**.

D1 owns independent schema migrations in [../../plugins/repository/d1/migrations](../../plugins/repository/d1/migrations). Use `pnpm database:init` for a new selected database and `pnpm database:update d1 repository` for later Repository Schema revisions. Vercel does not provide a native D1 binding, so the WebUI uses the same Binding-compatible contract through the server-only REST adapter.

The `seed` command remains available for controlled non-interactive initialization or import, but it is not part of the normal deployment flow:

```bash
pnpm --filter @nami/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

For database-backed documents, also select the HTTP Runtime Source in the same bootstrap configuration and point it at `https://<webui-domain>/api/runtime/snapshot`. The public endpoint returns one validated config-and-rules revision with an ETag; it contains no Secret values. Edge Runtime deployments fetch this endpoint and never receive the database connection or binding.

GitHub Contents and GitHub Raw remain in the workspace as archived build-time alternatives. Re-enabling them requires deliberately changing the bootstrap Repository and Runtime Source selections, restoring the required OAuth Repository scope, and rebuilding both applications. They are not part of the default first-run flow.

## Short-link analytics

The deployed analytics feature selects the PostgreSQL Store plugin and does not depend on a vendor-specific database API. A free hosted PostgreSQL database such as [Neon](https://neon.com/pricing) is suitable for a small deployment; [Supabase](https://supabase.com/pricing) can use the same plugin and schema migrations. Prefer the provider's pooled connection URL when one is available.

The repository also contains a complete D1 Store that passes the same analytics behavior contract with independent schema migrations. It can use either an injected native binding or the bundled server-side REST adapter. Select exactly one Store through `data/config.json`; the bootstrap Analytics Store choice controls the initial document created by setup. Disabling every Store keeps rule editing available while analytics routes report the missing capability.

1. Create a PostgreSQL database and add these values to the WebUI environment:

   ```dotenv
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   NAMI_SECRET="replace-with-the-shared-instance-secret"
   ```

2. Update the PostgreSQL analytics schema from the repository root:

   ```bash
   pnpm database:update postgres analytics
   ```

   When D1 uses the REST adapter, configure `CLOUDFLARE_D1_API_TOKEN` and run `pnpm database:update d1 analytics`. A native-binding host may apply the same schema migrations with its own D1 tooling. These commands never run during build or startup.

3. Configure every runtime deployment to send signed events to the WebUI:

   ```dotenv
   NAMI_SECRET="the-same-value-as-the-WebUI-NAMI_SECRET"
   ```

The collector endpoint and analytics source ID come from `data/config.json`. The source ID must be the shared base hostname, not a provider name. With `i0c.cc`, `i0c.cc`, `www.i0c.cc`, `api.i0c.cc`, `vc.i0c.cc`, and `nf.i0c.cc` can be reported independently without configuring a second domain list. Hostnames outside that namespace are stored as `unknown`.

After GitHub sign-in, analytics are available at `/<locale>/analytics` with 1, 7, 30, and 90-day ranges. The 1-day trend uses rolling hourly buckets; longer ranges use calendar-day buckets aligned to the current device's IANA time zone. The entry-domain filter applies consistently to totals, trends, routes, geography, devices, providers, referrers, campaigns, internal sources, and automation analysis. `/<locale>/analytics/automation` separates observed values from sampling-adjusted estimates for declared bots, suspected automation, and unmatched Runtime requests.

The ingestion endpoint accepts compatible V1 events and strict V2 link or Runtime events. It rejects stale, invalid, oversized, incorrectly classified, or wrong-source events. Query and campaign-link endpoints require an authenticated WebUI session.

Object-form rules use a stable per-rule `analyticsId`, so renaming a short path does not split future history while that ID is retained. Compact string rules use a deterministic legacy identity; converting one to object form starts a new stable identity. Matched events are collected at full rate; unmatched and system Runtime events are sampled at 10% and displayed with both observed and estimated values.

The Runtime sends the configured rule path for matched traffic, entry domain, provider, result, bounded traffic and bot classifications, country code, referrer hostname, and latency. It does not send IP addresses, full User-Agent strings, query strings, destination URLs, full referrer URLs, or raw unmatched paths. Browser referrers, explicit signed campaigns, and verified internal short-link sources are separate dimensions.

For campaign links, an authenticated client can call `POST /api/analytics/campaigns` with a Runtime URL, analytics ID, campaign ID, and 1–365 day lifetime. The returned signed `_nami_via` parameter is bound to the exact host and normalized path, then removed by the Runtime before rule processing.

Keep the database URL and instance secret server-only. After analytics ingestion, the WebUI
periodically schedules retention in the background without a public maintenance endpoint or
another deployment secret. Raw events, idempotency receipts, and upstream claims expire after
181 days, while hourly and daily aggregates remain available. Free-plan quotas and inactivity
policies can change, so check the provider's current limits before production use.

See [../docs/reference/analytics.md](../docs/reference/analytics.md) for the complete event contract, attribution behavior, schema-update order, privacy limits, delivery guarantees, and acceptance scenarios. Each Store plugin owns `schemaMigrationStatus`, `schemaMigrationPlan`, and `applySchemaMigrations`; schema updates are deliberate external writes and never run automatically during the WebUI build, startup, or health check.

## Deploy

Deploy this package from the monorepo with these Vercel settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Install Command | `corepack pnpm -C ../.. install --frozen-lockfile` |
| Build Command | `corepack pnpm build` |
| Output Directory | Next.js default |

The checked-in `vercel.json` owns the install and build commands so Vercel cannot fall back to npm when package-manager detection misses the repository-root lockfile. Keep **Include source files outside of the Root Directory in the Build Step** enabled so Vercel includes the shared workspace packages. Set the required deployment bindings from [.env.example](.env.example) in Vercel. The GitHub OAuth callback URL must be `https://<your-domain>/api/auth/callback/github`. Configure `NEXTAUTH_URL` only when the deployment origin cannot be inferred correctly.

The WebUI does not read former non-sensitive environment variables as overrides or fallbacks. Values left in Vercel are ignored and can be removed after the versioned configuration deployment is verified.

## Features Overview

- Versioned authenticated, numeric-ID allowlist, or GitHub-wide read-only access with configured managers and optional blocked users.
- Visual editing of `redirects.json`: group tree management, rule descriptions, rule forms, and an in-dialog advanced proxy editor.
- GitHub Repository-only rules source override and JSON editor with line highlighting and syntax validation.
- Visual, validated `config.json` settings with a raw recovery editor only when the current document cannot be represented safely.
- First-run database initialization without hand-written JSON or a seed command.
- Immutable document history with Git-style line diffs, non-destructive rollback, and atomic JSON backup import/export.
- Authenticated plugin status reporting for installed manifests, configuration state, capabilities, missing bindings, and selected-Store health.
- Form behavior aligned with the schema (specification source: [https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/redirects.schema.json](https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/redirects.schema.json)).
- GitHub Contents keeps local undo/redo until its explicit page-level save.
- Saves through the selected versioned Repository and rejects stale revisions instead of overwriting newer content.
- Shows a Repository result link after saves when the selected Repository provides one.

## Notes

- Repository OAuth permissions and public-target limitations apply only when the archived GitHub Repository is deliberately re-enabled.
- For production deployment, make sure to configure the credentials in `.env.local` into the environment variable management of the respective platform.

---

English · [简体中文](README.zh-CN.md)
