---
title: Choose a setup
description: Pick one WebUI, one database option, and one Runtime for the first working deployment.
---

# Choose a setup

Nami supports several database and edge providers, but they are not a checklist you must complete. A first deployment needs three decisions: where the WebUI runs, where editable data lives, and which Runtime receives public traffic.

::: tip Prefer fewer decisions?
Deploy the WebUI on Vercel, use PostgreSQL, and choose whichever of Cloudflare, Vercel, or Netlify you already know best for the Runtime. The repository defaults are prepared for this path.
:::

## The smallest useful instance

A minimal deployment has three parts:

1. **One WebUI** where you sign in and manage rules;
2. **One storage backend** for rules, settings, revisions, and optional analytics;
3. **One Runtime** bound to the public redirect domain.

The public domain points to the Runtime, not the WebUI. For example, the management surface might use `admin.example.com` while visitors receive links under `go.example.com`.

## PostgreSQL or D1

**Choose PostgreSQL for the first deployment.** One database can hold both editable data and analytics, and hosted services such as Neon provide a usable connection string. PostgreSQL is also the repository default, so this path requires the fewest bootstrap changes.

**Choose D1 when you specifically want the data in Cloudflare.** D1 uses two databases: one for rules and settings, and another for analytics. If the WebUI runs outside Cloudflare, it reaches them through the Cloudflare API, which adds an Account ID, two Database IDs, and an API token to the setup.

Only the WebUI connects to either database. The Runtime always reads a snapshot and never receives database credentials.

## Which Runtime to use

All three built-in adapters run the same routing core. The practical difference is where you deploy it:

- choose Cloudflare Workers when your domain and edge resources already live in Cloudflare;
- choose Vercel Edge Functions when Vercel is your familiar deployment workflow;
- choose Netlify Edge Functions when your existing sites and tooling already use Netlify.

Support for three platforms is not a reason to deploy all three. Get one Runtime working first. Add another only when you have a real need for provider comparison, a separate entry domain, or a manually operated fallback.

## When multiple Runtimes make sense

Several Runtimes can read the same snapshot and report into the same analytics source. The analytics UI can still separate them by entry domain and provider.

Nami does not route traffic between those deployments. DNS or another traffic layer decides which Runtime receives a request. Without that extra requirement, another deployment only adds another domain, secret binding, and failure point to maintain.

## Write down the choice

Before continuing, fill in these four values:

```text
WebUI platform: ____________________
Database: PostgreSQL / D1
Runtime platform: Cloudflare / Vercel / Netlify
Public Runtime domain: ____________________
```

Next, [prepare the database](/deployment/databases). Once storage is ready, you can deploy the WebUI and Runtime.
