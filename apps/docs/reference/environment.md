---
title: Environment variables and secrets
description: Look up which values belong to the WebUI or Runtime environment and which settings should live elsewhere.
---

# Environment variables and secrets

Early versions of nami kept several non-secret settings in environment variables, which made every edit a multi-provider chore. Only secrets and provider-injected values remain there; domains, cache intervals, access lists, and plugin switches live in the WebUI or startup config.

For a value that changes regularly and is not a credential, add a settings or configuration surface instead of another environment variable.

## WebUI environment

| Variable | Required when | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Always | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | Always | GitHub OAuth Client Secret |
| `NAMI_SECRET` | Always | Sessions, first initialization, snapshot, analytics, and attribution signatures |
| `DATABASE_URL` | PostgreSQL stores rules or analytics | Server-only PostgreSQL connection string |
| `CLOUDFLARE_D1_API_TOKEN` | The WebUI reaches D1 through the Cloudflare API | Server-only D1 read/write token |
| `NEXTAUTH_URL` | Auth.js cannot infer the public address | Override the public WebUI URL; normally unnecessary |

The WebUI is the only application that connects to a database. Do not give `DATABASE_URL` or a D1 token to the Runtime.

## Runtime environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NAMI_SECRET` | Yes | Verify WebUI snapshots and sign analytics and attribution events |

The Runtime and WebUI values must match exactly and contain at least 32 characters. If Cloudflare, Vercel, and Netlify are all deployed, each uses that same value.

## Why settings show an environment-variable name

Plugin configuration records which name to read from the environment, not the secret itself:

```json
{
  "secrets": {
    "databaseUrl": "DATABASE_URL"
  }
}
```

The same instance document can then refer to provider-managed secrets without exposing values in database documents, Runtime snapshots, the browser, or API responses.

Entering an actual secret here makes the plugin treat that secret as an environment-variable name, so it will not find the intended value.

## Values that do not belong in the environment

These already have a better configuration surface:

- the public Runtime URL and cache intervals;
- the analytics collector URL and source ID;
- GitHub numeric manager and block lists;
- installed-plugin enabled states and public options;
- D1 Account and Database IDs;
- the database types used for rules and analytics.

The first four are editable in WebUI settings. D1 IDs and database types must be known before editable data can be opened, so they stay in repository startup configuration. They are not secrets, but changing them requires a rebuild.

## Rotate `NAMI_SECRET`

Treat rotation as one maintenance operation rather than a WebUI-only edit:

1. generate a new random value;
2. update the WebUI and every Runtime still in use;
3. redeploy those applications;
4. sign in again and verify snapshot and analytics delivery.

Rotation invalidates existing WebUI sessions. Mixing old and new values makes the Runtime reject snapshots and the collector reject analytics events.
