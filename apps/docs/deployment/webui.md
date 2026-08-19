---
title: Deploy the WebUI
description: Configure GitHub sign-in and database access, deploy the management surface, and complete its first-run setup.
---

# Deploy the WebUI

The WebUI is the application you will open for everyday management. It owns sign-in, rule editing, instance settings, revision history, and analytics. It is also the only application that needs database credentials.

Before starting, [prepare the database](/deployment/databases) and decide which HTTPS domain the WebUI will use. The steps below use Vercel because the repository already includes its build configuration.

## 1. Create a GitHub OAuth App

Create an OAuth App in GitHub Developer settings. Use the WebUI address as the Homepage URL and this exact callback shape:

```text
https://your-webui.example.com/api/auth/callback/github
```

Save the Client ID and generate a Client Secret. The default database-backed control plane only reads GitHub identity and does not need repository permissions.

If the WebUI must access resources in an organization that restricts OAuth Apps, allow this App in the organization's settings as well.

## 2. Create the instance secret

The WebUI and every Runtime must share one `NAMI_SECRET`. Generate one with Node.js:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep the result. It should be at least 32 characters, must never be committed, and must match exactly across the WebUI and Runtime environments.

## 3. Create the Vercel project

Connect your nami repository or fork and use these project settings:

```text
Root Directory: apps/webui
Framework Preset: Next.js
```

Leave **Include source files outside of the Root Directory in the Build Step** enabled. The WebUI imports shared workspace packages from the rest of the monorepo.

`apps/webui/vercel.json` already pins the pnpm install and build commands, so you do not need to copy them into the Vercel dashboard.

## 4. Add environment variables

The default PostgreSQL deployment needs:

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
NAMI_SECRET="the-secret-generated-above"
```

Add this when using D1:

```dotenv
CLOUDFLARE_D1_API_TOKEN="your-d1-read-write-api-token"
```

Auth.js normally infers the public URL from the request. Use `NEXTAUTH_URL` only when a self-hosted proxy does not forward that information correctly; it is not a routine requirement.

## 5. Deploy and initialize the instance

Open the deployed WebUI and sign in with GitHub. An empty database sends you to “Initialize this deployment” instead of the rule list.

The form asks for:

- the same instance secret you set in the environment;
- the public WebUI URL;
- the public URL you plan to give the Runtime;
- the Runtime platform you are actually deploying;
- whether analytics should be enabled and which base domain identifies the source.

After confirmation, the WebUI atomically creates the first instance settings document and an empty rule set. The current GitHub account becomes the first manager.

<!-- Real screenshot needed: WebUI first-run form with the secret and account details redacted. -->

## How to tell it is ready

Initialization should take you to the rules page, where the sidebar shows an empty rule group and the settings page opens normally. Refresh the browser: if the same state returns, the WebUI is reading from the database rather than showing temporary client state.

If the page reports missing tables or asks for database structure setup, return to [prepare the database](/deployment/databases) and check `pnpm database:init` and the environment values.

Next, [deploy a Runtime](/deployment/runtime). The WebUI does not serve public short links by itself.
