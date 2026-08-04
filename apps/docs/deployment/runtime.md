---
title: Deploy a Runtime
description: Build and deploy the same redirect host to Cloudflare, Vercel, or Netlify.
---

# Deploy a Runtime

The Runtime project root is `apps/runtime`. Choose one platform adapter for a normal installation.

## Shared secret

Every deployment needs only the shared instance secret by default:

```dotenv
I0C_SECRET="the-same-32-character-or-longer-secret-as-the-webui"
```

Non-sensitive Runtime settings and rules come from the configured snapshot source. Runtime deployments do not need `DATABASE_URL` or D1 credentials.

## Cloudflare Workers

The checked-in `wrangler.toml` builds `dist/platforms/cloudflare.js`.

```sh
pnpm runtime:build:cf
pnpm runtime:dev:cf
pnpm runtime:deploy:cf
```

Set `I0C_SECRET` as a Worker secret. The deploy command is an external write and should be run only for the intended Cloudflare account and environment.

## Vercel Edge Functions

Create a Vercel project with `apps/runtime` as its Root Directory. The checked-in configuration uses:

```text
Build command: pnpm build:vc
Output directory: .vercel/output
```

Local wrapper commands are also available:

```sh
pnpm runtime:build:vc
pnpm runtime:dev:vc
pnpm runtime:deploy:vc
```

## Netlify Edge Functions

Create a Netlify site with `apps/runtime` as its Base directory. `netlify.toml` runs `pnpm build:nf`, publishes `dist`, and maps the generated edge function to `/*`.

```sh
pnpm runtime:build:nf
pnpm runtime:dev:nf
pnpm runtime:deploy:nf
```

## Domains and analytics

Configure each public hostname at the provider. Runtime analytics uses the actual request hostname as `entryDomain`, while `sourceId` identifies the whole i0c.cc instance. Multiple domains therefore remain filterable without splitting one instance into unrelated sources.

## Other platforms

Cloudflare, Vercel, and Netlify are the built-in adapters, not a closed platform list. You can implement another provider as a `runtime-platform` plugin, register it at build time, and keep provider-specific APIs outside the shared redirect handler. See [Write an adapter](/plugins/adapters#add-a-runtime-platform).

## Failure behavior

The Runtime validates new snapshots before accepting them and retains its last-known-good configuration when refreshes fail. If the platform adapter itself is disabled in instance configuration, a still-deployed provider cannot serve routing normally; remove unused provider deployments separately when they are no longer wanted.
