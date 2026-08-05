---
title: Deploy a Runtime
description: Put one Cloudflare, Vercel, or Netlify Runtime in front of public traffic and connect it to the WebUI snapshot.
---

# Deploy a Runtime

The Runtime is the public entry point. Visitor requests for short links arrive here, not at the WebUI.

Choose one of the three providers below. Before starting, finish the WebUI initialization and keep the exact same `I0C_SECRET` available for the Runtime environment.

## 1. Point the Runtime at your WebUI snapshot

The Runtime must know where to fetch its first snapshot before it is built. Open `packages/config/src/defaults.ts` and change:

```ts
bootstrapConfig.data.source.snapshotUrl
```

to your own WebUI endpoint:

```text
https://your-webui.example.com/api/runtime/snapshot
```

The checked-in default points to the public i0c.cc instance. A self-hosted Runtime left unchanged would not read the database you just initialized.

Changing the snapshot source requires a Runtime rebuild. Later rule and instance-setting edits made in the WebUI do not.

## 2. Choose one provider

### Cloudflare Workers

Create a Worker project from the complete monorepo checkout. Use `apps/runtime` as the project root. The included `wrangler.toml` specifies:

```text
Build command: pnpm build:cf
Entry file: dist/platforms/cloudflare.js
```

Add `I0C_SECRET` as a Worker secret, then deploy. The equivalent repository-root commands are:

```sh
pnpm runtime:build:cf
pnpm runtime:deploy:cf
```

The deploy command writes to the active Wrangler account, so run it only after confirming the intended account and environment.

### Vercel Edge Functions

Create a second Vercel project with `apps/runtime` as its Root Directory. Leave **Include source files outside of the Root Directory in the Build Step** enabled.

`apps/runtime/vercel.json` already declares:

```text
Build command: pnpm build:vc
Output directory: .vercel/output
```

Add `I0C_SECRET` to the project environment. You can also build and deploy from the repository root with:

```sh
pnpm runtime:build:vc
pnpm runtime:deploy:vc
```

### Netlify Edge Functions

Create a Netlify Site with `apps/runtime` as the Base directory. The included `netlify.toml` runs `pnpm build:nf` and maps the generated Edge Function to every path.

Add `I0C_SECRET` to the Site environment. The matching repository-root commands are:

```sh
pnpm runtime:build:nf
pnpm runtime:deploy:nf
```

## 3. Bind the public domain

Attach the planned `go.example.com` domain to this Runtime deployment. Do not point it at the WebUI.

With an empty rule set, opening the domain should show the i0c.cc 404 page. That is a useful result: DNS, the provider deployment, and the Runtime handler are connected, but no rule matches the path yet.

If you see the provider's own 404, a 500, or Bad Gateway instead, check the project root, provider build command, `I0C_SECRET`, and snapshot URL first.

<!-- Real screenshot needed: one successfully deployed Runtime provider showing the domain and environment setting location, without a secret value. -->

## 4. Check the instance settings

Back in the WebUI settings, confirm that the canonical Runtime URL is the HTTPS domain you just attached and that the provider you actually deployed is enabled. Disabling an adapter while its external deployment still exists sends that deployment into its error fallback; it does not delete the provider project for you.

The Runtime is ready. Continue with [create the first rule](/guide/first-rule) and turn that initial 404 into a real redirect.
