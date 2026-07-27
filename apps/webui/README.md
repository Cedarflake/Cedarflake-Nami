<img src="./public/img/E617F59CDD7A58032DC2B01D78A97986.webp" alt="i0c.cc" width="720">

## Project Overview

i0c.cc WebUI is a management panel based on Next.js 16, designed for online editing of `config.json` and `redirects.json` after logging in via GitHub OAuth. The checked-in deployment uses PostgreSQL for immediate, optimistic saves, atomic snapshots, immutable revision history, and rollback. The former GitHub Contents workflow remains an archived build-time alternative and is not enabled by default.

This WebUI supports the personal [i0c.cc](https://github.com/Revaea/i0c.cc) workflow. It is maintained as an optional management surface rather than a general-purpose enterprise URL management product.

Server-side Data Repository and Analytics Store factories are installed at build time through [../../i0c.webui.config.ts](../../i0c.webui.config.ts). Client-safe UI renderers use [webui.extensions.ts](webui.extensions.ts) so they remain in the client bundle. Workspace fixtures exercise both installation paths without adding factory mappings to WebUI host source; the production renderer list is intentionally empty.

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

2. Create a PostgreSQL database and configure `DATABASE_URL` for the WebUI. The deliberate Data Repository migration command uses the same connection. Apply the migrations from the repository root:

   ```bash
   pnpm --filter @i0c/plugin-data-repository-postgres migrate
   ```

   Migrations are deliberate external writes. They are never run by the build, startup, health checks, or ordinary requests.

3. Create a GitHub OAuth App with callback URL `http(s)://<localhost:3000 or your domain>/api/auth/callback/github`. Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The default OAuth scope is `read:user user:email`; Repository permissions are not required by the PostgreSQL control plane.

4. Generate one `I0C_SECRET` value of at least 32 random bytes and configure the same value on the WebUI and every Runtime provider. NextAuth normally infers the request origin; set the optional `NEXTAUTH_URL` override only when a self-hosted proxy does not forward it correctly.

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

6. Open [http://localhost:3000](http://localhost:3000) or your deployment. When the database is empty, the WebUI enters its setup page. Sign in with GitHub, enter the shared `I0C_SECRET`, choose the deployed Runtime adapters and public origins, then create the initial `config.json` and empty `redirects.json` atomically. The signed-in GitHub account becomes the first manager.

7. Keep `I0C_SECRET` configured after initialization because it also signs WebUI sessions and Runtime analytics events.

## Data repository

The checked-in deployment selects PostgreSQL through [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts) and uses `DATABASE_URL`. A D1-capable WebUI host may select `provider: "d1"` and inject a `D1Database` binding through `configureAppDataRepositoryBinding` before the Repository is first used.

PostgreSQL and D1 are held to the same shared behavior contract. First-run setup creates both documents atomically and refuses partially initialized databases. Every save creates an immutable revision. Import validates both JSON files and replaces them atomically, while restore copies an old document into a new head revision instead of rewriting history. Managers can export, import, inspect, and restore revisions from **Settings → Data and history**.

D1 owns independent migrations in [../../plugins/repository/d1/migrations](../../plugins/repository/d1/migrations). Apply them deliberately to the bound database before opening setup. The current Vercel deployment remains on PostgreSQL because Vercel does not provide a native D1 binding.

The `seed` command remains available for controlled non-interactive migrations, but it is not part of the normal deployment flow:

```bash
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

For database-backed documents, also select the HTTP Runtime Source in the same bootstrap configuration and point it at `https://<webui-domain>/api/runtime/snapshot`. The public endpoint returns one validated config-and-rules revision with an ETag; it contains no Secret values. Edge Runtime deployments fetch this endpoint and never receive the database connection or binding.

GitHub Contents and GitHub Raw remain in the workspace as archived build-time alternatives. Re-enabling them requires deliberately changing the bootstrap Repository and Runtime Source selections, restoring the required OAuth Repository scope, and rebuilding both applications. They are not part of the default first-run flow.

## Short-link analytics

The deployed analytics feature selects the PostgreSQL Store plugin and does not depend on a vendor-specific database API. A free hosted PostgreSQL database such as [Neon](https://neon.com/pricing) is suitable for a small deployment; [Supabase](https://supabase.com/pricing) can use the same plugin and migrations. Prefer the provider's pooled connection URL when one is available.

The repository also contains a complete D1 Store that passes the same analytics behavior contract with independent migrations. It is a protocol-validation and alternate-host option; the current Vercel WebUI remains on PostgreSQL. A host selecting D1 must inject its D1 binding before the Store is initialized. Select exactly one Store through `data/config.json`; disabling every Store keeps rule editing available while analytics routes report the missing capability.

1. Create a PostgreSQL database and add these values to the WebUI environment:

   ```dotenv
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   I0C_SECRET="replace-with-the-shared-instance-secret"
   ```

2. Apply the PostgreSQL plugin migrations from the repository root:

   ```bash
   pnpm analytics:migrate
   ```

3. Configure every runtime deployment to send signed events to the WebUI:

   ```dotenv
   I0C_SECRET="the-same-value-as-the-WebUI-I0C_SECRET"
   ```

The collector endpoint and analytics source ID come from `data/config.json`. The source ID must be the shared base hostname, not a provider name. With `i0c.cc`, `i0c.cc`, `www.i0c.cc`, `api.i0c.cc`, `vc.i0c.cc`, and `nf.i0c.cc` can be reported independently without configuring a second domain list. Hostnames outside that namespace are stored as `unknown`.

After GitHub sign-in, analytics are available at `/<locale>/analytics` with 1, 7, 30, and 90-day ranges. The 1-day trend uses rolling hourly buckets; longer ranges use calendar-day buckets aligned to the current device's IANA time zone. The entry-domain filter applies consistently to totals, trends, routes, geography, devices, providers, referrers, campaigns, internal sources, and automation analysis. `/<locale>/analytics/automation` separates observed values from sampling-adjusted estimates for declared bots, suspected automation, and unmatched Runtime requests.

The ingestion endpoint accepts compatible V1 events and strict V2 link or Runtime events. It rejects stale, invalid, oversized, incorrectly classified, or wrong-source events. Query and campaign-link endpoints require an authenticated WebUI session.

Object-form rules use a stable per-rule `analyticsId`, so renaming a short path does not split future history while that ID is retained. Compact string rules use a deterministic legacy identity; converting one to object form starts a new stable identity. Matched events are collected at full rate; unmatched and system Runtime events are sampled at 10% and displayed with both observed and estimated values.

The Runtime sends the configured rule path for matched traffic, entry domain, provider, result, bounded traffic and bot classifications, country code, referrer hostname, and latency. It does not send IP addresses, full User-Agent strings, query strings, destination URLs, full referrer URLs, or raw unmatched paths. Browser referrers, explicit signed campaigns, and verified internal short-link sources are separate dimensions.

For campaign links, an authenticated client can call `POST /api/analytics/campaigns` with a Runtime URL, analytics ID, campaign ID, and 1–365 day lifetime. The returned signed `_i0c_via` parameter is bound to the exact host and normalized path, then removed by the Runtime before rule processing.

Keep the database URL and instance secret server-only. After analytics ingestion, the WebUI
periodically schedules retention in the background without a public maintenance endpoint or
another deployment secret. Raw events, idempotency receipts, and upstream claims expire after
181 days, while hourly and daily aggregates remain available. Free-plan quotas and inactivity
policies can change, so check the provider's current limits before production use.

See [../../docs/analytics.md](../../docs/analytics.md) for the complete event contract, attribution behavior, database migration order, privacy limits, delivery guarantees, and acceptance scenarios. Each Store plugin owns migration `status`, `plan`, and `apply`; migrations are deliberate external writes and are never run automatically by the WebUI build, startup, or health check.

## Deploy

Deploy this package from the monorepo with these Vercel settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Build Command | `pnpm build` |
| Output Directory | Next.js default |

Keep **Include source files outside of the Root Directory in the Build Step** enabled so Vercel includes the shared workspace packages. Set the required deployment bindings from [.env.example](.env.example) in Vercel. The GitHub OAuth callback URL must be `https://<your-domain>/api/auth/callback/github`. Configure `NEXTAUTH_URL` only when the deployment origin cannot be inferred correctly.

The WebUI does not read former non-sensitive environment variables as overrides or fallbacks. Values left in Vercel are ignored and can be removed after the versioned configuration deployment is verified.

## Features Overview

- Versioned authenticated, numeric-ID allowlist, or GitHub-wide read-only access with configured managers and optional blocked users.
- Visual editing of `redirects.json`: group tree management + rule form editing.
- GitHub Repository-only rules source override and JSON editor with line highlighting and syntax validation.
- Visual, validated `config.json` settings with a raw recovery editor only when the current document cannot be represented safely.
- First-run database initialization without hand-written JSON or a seed command.
- Immutable document history with Git-style line diffs, non-destructive rollback, and atomic JSON backup import/export.
- Authenticated plugin status reporting for installed manifests, configuration state, capabilities, missing bindings, and selected-Store health.
- Form behavior aligned with the schema (specification source: [https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json](https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json)).
- Supports undo/redo for quick editing rollback.
- Saves through the selected versioned Repository and rejects stale revisions instead of overwriting newer content.
- Shows a Repository result link after saves when the selected Repository provides one.

## Notes

- Repository OAuth permissions and public-target limitations apply only when the archived GitHub Repository is deliberately re-enabled.
- For production deployment, make sure to configure the credentials in `.env.local` into the environment variable management of the respective platform.

For the Chinese version, see [README.zh-CN.md](README.zh-CN.md).
