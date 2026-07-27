<img src="./public/img/E617F59CDD7A58032DC2B01D78A97986.webp" alt="i0c.cc" width="720">

## Project Overview

i0c.cc WebUI is a management panel based on Next.js 16, designed for online editing of `config.json` and `redirects.json` after logging in via GitHub OAuth. Saves go through the selected build-time Data Repository. GitHub Contents remains the default and preserves commit history; PostgreSQL is available for optimistic database-backed saves and atomic snapshots.

This WebUI supports the personal [i0c.cc](https://github.com/Revaea/i0c.cc) workflow. It is maintained as an optional management surface rather than a general-purpose enterprise URL management product.

Server-side Data Repository and Analytics Store factories are installed at build time through [../../i0c.webui.config.ts](../../i0c.webui.config.ts). Client-safe UI renderers use [webui.extensions.ts](webui.extensions.ts) so they remain in the client bundle. Workspace fixtures exercise both installation paths without adding factory mappings to WebUI host source; the production renderer list is intentionally empty.

This project provides two rule-editing modes and a separate settings surface:

- Visual rule editing (group tree + form)
- Rules JSON editing (right panel, directly edit `redirects.json`)
- Visual instance settings in the bottom of the sidebar (`config.json`, with shared contract validation)

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

2. Create an OAuth App on GitHub, set the callback URL to `http(s)://<localhost:3000 or your domain>/api/auth/callback/github`, and write the `Client ID` and `Client Secret` into `.env.local` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. If deploying on ▲ Vercel, configure these as environment variables.

   Configure the OAuth scope in [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts). Use
   `read:user user:email public_repo` for a public target repository or replace `public_repo`
   with `repo` for a private repository. Configure the access mode and manager GitHub numeric
   user IDs in the `webui.access` section of `data/config.json`. Find a numeric user ID with `gh api user --jq .id`.
   `access.mode` accepts `authenticated`, `allowlist`, or `public-readonly`. Manager IDs are
   required by `allowlist` and optional for `public-readonly`.
   `blockedGitHubUserIds` optionally rejects selected numeric account IDs in `authenticated`
   and `public-readonly` modes. It is ignored in `allowlist` mode, and an ID cannot be both a
   manager and blocked.
   When GitHub Contents is selected, `public-readonly` loads the configured rules through
   GitHub's unauthenticated API for read-only accounts, so the target repository must be public.
   Any GitHub user may sign in to inspect rules and analytics, while listed users may edit
   config, create campaign URLs, and refresh analytics. Without listed IDs, no one can manage it.

3. The build-time Repository and Runtime Source selections are defined in [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts), while executable Repository factories are installed by [../../i0c.webui.config.ts](../../i0c.webui.config.ts). The default GitHub setup loads `config.json` and `redirects.json` from the `data` branch of `Revaea/i0c.cc`. The canonical Runtime origin used by QR codes comes from `config.json`.

4. Generate `NEXTAUTH_SECRET` and write it into `.env.local`. For production, set `NEXTAUTH_URL` to `https://your-domain`; for development, set it to `http://localhost:3000`.

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

6. Open [http://localhost:3000](http://localhost:3000) or **your domain** and sign in. Configured managers can edit both data documents; other permitted users receive the access defined by the selected mode.

## Data repository

GitHub Contents is the default Repository. It uses the configured branch commit as the snapshot revision and reads both documents at the same commit for Runtime publication.

To use PostgreSQL, change `data.repository` in [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts), configure `DATA_REPOSITORY_DATABASE_URL`, then deliberately migrate and seed the repository:

```bash
pnpm --filter @i0c/plugin-data-repository-postgres migrate
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

Both commands mutate the configured database and are never run by builds, startup, health checks, or ordinary requests. Seeding validates both files, creates only missing documents in one transaction, and never overwrites existing content. Before seeding, replace the GitHub Repository and Raw Source declarations in `config.json` with enabled `@i0c/data-repository-postgres` and `@i0c/http-snapshot-source` declarations so the document matches the selected build-time installations.

For database-backed documents, also select the HTTP Runtime Source in the same bootstrap configuration and point it at `https://<webui-domain>/api/runtime/snapshot`. The public endpoint returns one validated config-and-rules revision with an ETag; it contains no Secret values. Edge Runtime deployments fetch this endpoint and never receive the PostgreSQL connection string.

## Short-link analytics

The deployed analytics feature selects the PostgreSQL Store plugin and does not depend on a vendor-specific database API. A free hosted PostgreSQL database such as [Neon](https://neon.com/pricing) is suitable for a small deployment; [Supabase](https://supabase.com/pricing) can use the same plugin and migrations. Prefer the provider's pooled connection URL when one is available.

The repository also contains a complete D1 Store that passes the same analytics behavior contract with independent migrations. It is a protocol-validation and alternate-host option; the current Vercel WebUI remains on PostgreSQL. A host selecting D1 must inject its D1 binding before the Store is initialized. Select exactly one Store through `data/config.json`; disabling every Store keeps rule editing available while analytics routes report the missing capability.

1. Create a PostgreSQL database and add these values to the WebUI environment:

   ```dotenv
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   ANALYTICS_INGEST_SECRET="replace-with-a-separate-strong-secret"
   CRON_SECRET="replace-with-an-independent-strong-secret"
   ```

2. Apply the PostgreSQL plugin migrations from the repository root:

   ```bash
   pnpm analytics:migrate
   ```

3. Configure every runtime deployment to send signed events to the WebUI:

   ```dotenv
   ANALYTICS_WRITE_KEY="the-same-value-as-ANALYTICS_INGEST_SECRET"
   ```

The collector endpoint and analytics source ID come from `data/config.json`. The source ID must be the shared base hostname, not a provider name. With `i0c.cc`, `i0c.cc`, `www.i0c.cc`, `api.i0c.cc`, `vc.i0c.cc`, and `nf.i0c.cc` can be reported independently without configuring a second domain list. Hostnames outside that namespace are stored as `unknown`.

After GitHub sign-in, analytics are available at `/<locale>/analytics` with 1, 7, 30, and 90-day ranges. The 1-day trend uses rolling hourly buckets; longer ranges use calendar-day buckets aligned to the current device's IANA time zone. The entry-domain filter applies consistently to totals, trends, routes, geography, devices, providers, referrers, campaigns, internal sources, and automation analysis. `/<locale>/analytics/automation` separates observed values from sampling-adjusted estimates for declared bots, suspected automation, and unmatched Runtime requests.

The ingestion endpoint accepts compatible V1 events and strict V2 link or Runtime events. It rejects stale, invalid, oversized, incorrectly classified, or wrong-source events. Query and campaign-link endpoints require an authenticated WebUI session.

Object-form rules use a stable per-rule `analyticsId`, so renaming a short path does not split future history while that ID is retained. Compact string rules use a deterministic legacy identity; converting one to object form starts a new stable identity. Matched events are collected at full rate; unmatched and system Runtime events are sampled at 10% and displayed with both observed and estimated values.

The Runtime sends the configured rule path for matched traffic, entry domain, provider, result, bounded traffic and bot classifications, country code, referrer hostname, and latency. It does not send IP addresses, full User-Agent strings, query strings, destination URLs, full referrer URLs, or raw unmatched paths. Browser referrers, explicit signed campaigns, and verified internal short-link sources are separate dimensions.

For campaign links, an authenticated client can call `POST /api/analytics/campaigns` with a Runtime URL, analytics ID, campaign ID, and 1–365 day lifetime. The returned signed `_i0c_via` parameter is bound to the exact host and normalized path, then removed by the Runtime before rule processing.

Keep the database URL and signing secrets server-only. Vercel invokes the protected retention
endpoint daily: raw events, idempotency receipts, and upstream claims expire after 181 days, while
hourly and daily aggregates remain available. Free-plan quotas and inactivity policies can change,
so check the provider's current limits before production use.

See [../../docs/analytics.md](../../docs/analytics.md) for the complete event contract, attribution behavior, database migration order, privacy limits, delivery guarantees, and acceptance scenarios. Each Store plugin owns migration `status`, `plan`, and `apply`; migrations are deliberate external writes and are never run automatically by the WebUI build, startup, or health check.

## Deploy

Deploy this package from the monorepo with these Vercel settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Build Command | `pnpm build` |
| Output Directory | Next.js default |

Keep **Include source files outside of the Root Directory in the Build Step** enabled so Vercel includes the shared workspace packages. Set the deployment bindings and secrets from [.env.example](.env.example) in Vercel. For production,
`NEXTAUTH_URL` must match the deployed domain, `CRON_SECRET` must be configured for the daily retention request, and the GitHub OAuth callback URL must be
`https://<your-domain>/api/auth/callback/github`.

The WebUI does not read former non-sensitive environment variables as overrides or fallbacks. Values left in Vercel are ignored and can be removed after the versioned configuration deployment is verified.

## Features Overview

- Versioned authenticated, numeric-ID allowlist, or GitHub-wide read-only access with configured managers and optional blocked users.
- Visual editing of `redirects.json`: group tree management + rule form editing.
- Rules JSON editor: line numbers, current line highlighting, JSON syntax validation (error prompts for formatting issues).
- Visual, validated `config.json` settings with a raw recovery editor only when the current document cannot be represented safely.
- Authenticated plugin status reporting for installed manifests, configuration state, capabilities, missing bindings, and selected-Store health.
- Form behavior aligned with the schema (specification source: [https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json](https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json)).
- Supports undo/redo for quick editing rollback.
- Saves through the selected versioned Repository and rejects stale revisions instead of overwriting newer content.
- Shows a GitHub commit link after saves when the selected Repository provides one.

## Notes

- The OAuth app requires `repo` permissions to write to private repositories.
- If the target repository is private, ensure the logged-in account has the appropriate write permissions.
- With the GitHub Repository, `public-readonly` supports only public targets and is subject to GitHub's unauthenticated API limits.
- For production deployment, make sure to configure the credentials in `.env.local` into the environment variable management of the respective platform.

For the Chinese version, see [README.zh-CN.md](README.zh-CN.md).
