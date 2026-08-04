---
title: Deploy the WebUI
description: Deploy the Next.js control plane and configure authentication, storage, and the shared instance secret.
---

# Deploy the WebUI

The WebUI project root is `apps/webui`. It is a Next.js application and the repository includes a Vercel build configuration.

## Required environment variables

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
I0C_SECRET="replace-with-a-32-byte-random-secret"
```

`NEXTAUTH_URL` is an optional compatibility override when the deployment URL cannot be inferred. Do not configure it by habit.

For the D1 REST adapter and D1 schema-update commands, also configure:

```dotenv
CLOUDFLARE_D1_API_TOKEN="your-d1-read-write-api-token"
```

## GitHub OAuth

Create a GitHub OAuth application for the WebUI origin. Use the deployment's Auth.js callback URL:

```text
https://your-webui.example.com/api/auth/callback/github
```

The WebUI uses the checked-in OAuth scope and numeric GitHub IDs from instance access settings. If an organization restricts third-party OAuth applications, authorize the OAuth application for that organization before expecting repository access.

## Vercel project settings

- Repository: `Revaea/i0c.cc` or your fork
- Root Directory: `apps/webui`
- Build command: `pnpm build`
- Framework: Next.js

Keep all secrets in the Vercel project environment. The monorepo workspace dependencies are installed from the repository root by pnpm.

## Initialize storage

Before the first WebUI deployment, expose the selected database credentials to the invoking shell and run:

```sh
pnpm database:init
```

This initializes the selected repository and analytics schemas in order. Run it before production traffic reaches the WebUI. Builds and application startup do not migrate databases.

See [Database initialization and schema updates](/operations/database) for provider-specific commands and upgrade safety.

## Post-deployment checks

1. Open the sign-in page without credentials embedded in the URL.
2. Sign in with a configured manager account.
3. Confirm settings and rules load from the selected repository.
4. Request `/api/runtime/snapshot` with the Runtime authentication contract.
5. Confirm the analytics collector rejects unsigned or incorrectly signed events.

Do not treat a successful Next.js build as proof that OAuth, storage, or the public deployment is healthy.
