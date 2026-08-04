---
title: Environment bindings
description: Distinguish deployment secrets from editable non-sensitive configuration.
---

# Environment bindings

Environment variables are reserved for credentials and compatibility values. Non-sensitive settings belong in bootstrap or instance configuration.

## WebUI

| Variable | Required when | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Always | GitHub OAuth client identifier |
| `GITHUB_CLIENT_SECRET` | Always | GitHub OAuth client secret |
| `I0C_SECRET` | Always | Session, setup, analytics, and attribution signing secret |
| `DATABASE_URL` | PostgreSQL repository or analytics store is selected | Server-only PostgreSQL connection string |
| `CLOUDFLARE_D1_API_TOKEN` | D1 adapter or D1 schema-update command is used | Server-only D1 read/write API token |
| `NEXTAUTH_URL` | URL inference is unavailable | Optional Auth.js compatibility override |

## Runtime

| Variable | Required | Purpose |
| --- | --- | --- |
| `I0C_SECRET` | Yes | Verifies snapshots and signs analytics/attribution payloads |

The Runtime does not need database credentials. Its secret must exactly match the WebUI value and be at least 32 characters.

## Binding names in instance configuration

Plugin `secrets` objects contain environment variable names, not secret values:

```json
{
  "secrets": {
    "databaseUrl": "DATABASE_URL"
  }
}
```

This lets the same instance document refer to provider-managed values without exposing credentials in the repository, snapshot, browser, or API response.

## Non-sensitive settings

Do not reintroduce these as environment variables:

- Runtime canonical origin and cache TTLs;
- analytics collector URL and source ID;
- GitHub numeric access lists;
- plugin enabled state and public options;
- D1 account and database IDs;
- repository and store provider choices.

Provider choices and D1 identifiers are bootstrap configuration because they are needed before the editable repository can be opened. The remaining values are managed through the WebUI instance settings.

## Secret rotation

Rotating `I0C_SECRET` invalidates current WebUI sessions and requires every Runtime deployment to be updated. Plan the change as one maintenance boundary; mixed old and new values cause snapshot authorization and analytics delivery failures.
