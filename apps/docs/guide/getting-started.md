---
title: About this project
description: Understand what i0c.cc is, who it serves, and how to prepare a deployment.
---

# About this project

i0c.cc is a self-hosted edge redirect playground. A normal installation has one WebUI, one database backend, and one Runtime provider. The three Runtime adapters are alternatives; you do not need to deploy all of them.

**Who i0c.cc is for.** It is maintained for personal use and engineering experiments, and currently serves as Revaea's edge redirect infrastructure. It is not a hosted URL-shortening service or an enterprise redirect platform. There is currently no plan to publish its internal plugins or SDK as public packages; extensions remain source-level, compile-time modules within the repository.

**Who this documentation is for.** It records the architecture, deployment, and operations needed to maintain the project. Other developers who find the implementation useful can also follow it to study, self-deploy, or extend their own instance.

## Prerequisites

- Node.js 22
- Corepack and the pnpm version declared by the repository
- A GitHub OAuth application for WebUI sign-in
- PostgreSQL or two Cloudflare D1 databases
- One supported edge provider: Cloudflare, Vercel, or Netlify

## Install the workspace

```sh
git clone https://github.com/Revaea/i0c.cc.git
cd i0c.cc
corepack enable
pnpm install --frozen-lockfile
```

## Choose the initial topology

The default checked-in bootstrap configuration uses PostgreSQL for both editable data and analytics, and exposes Runtime snapshots through the WebUI.

For the smallest deployment:

1. Provision PostgreSQL and configure the WebUI environment locally.
2. Run `pnpm database:init` to initialize both selected schemas.
3. Deploy the WebUI.
4. Deploy one Runtime provider.
5. Configure the same `I0C_SECRET` on the WebUI and Runtime.
6. Point your public Runtime domain at that deployment.

Choose D1 instead when Cloudflare-managed storage is a better fit. D1 requires separate repository and analytics database IDs.

## Configure secrets

Copy the examples into provider-managed environment settings rather than committing local secret files.

WebUI requires:

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
I0C_SECRET="replace-with-a-32-byte-random-secret"
```

Every Runtime deployment requires the matching secret:

```dotenv
I0C_SECRET="replace-with-the-same-secret"
```

When D1 is selected, configure `CLOUDFLARE_D1_API_TOKEN` on the WebUI and fill the non-sensitive D1 account and database IDs in the checked-in bootstrap configuration.

## Initialize storage

After selecting the providers and making their credentials available to the invoking shell, run this once before the first WebUI deployment:

```sh
pnpm database:init
```

The command reads the checked-in bootstrap provider choices, initializes the selected data repository first, then the selected analytics store. Re-running it is safe when the schema is already current. It is an explicit external write and is never called by a build or application startup.

## Validate before deployment

Run only the checks for the owner you changed:

```sh
pnpm config:check
pnpm plugins:check
pnpm webui:lint
pnpm webui:build
pnpm runtime:build
```

The aggregate `pnpm check` command runs the full workspace suite. Database initialization, schema updates, and provider deploy commands are explicit operations and are never part of a build.

## Next steps

- [Choose a deployment topology](/deployment/choose-a-topology)
- [Deploy the WebUI](/deployment/webui)
- [Deploy a Runtime](/deployment/runtime)
- [Understand instance configuration](/guide/configuration)
