---
title: Instance configuration
description: Understand bootstrap choices, editable instance settings, and secret bindings.
---

# Instance configuration

i0c.cc intentionally separates choices needed at application startup from settings that can be edited through the WebUI.

## Bootstrap configuration

[`packages/config/src/defaults.ts`](https://github.com/Revaea/i0c.cc/blob/main/packages/config/src/defaults.ts) contains the checked-in bootstrap configuration. It chooses:

- the editable data repository provider;
- the Runtime snapshot source;
- the analytics store provider;
- PostgreSQL connection limits;
- D1 account and database identifiers;
- the GitHub OAuth scope.

Changing a bootstrap provider changes the dependencies the applications need and requires a rebuild and redeployment.

## Editable instance configuration

The WebUI manages the instance document described by `packages/config/config.schema.json`.

| Section | Purpose |
| --- | --- |
| `runtime` | Canonical origin, robots policy, and snapshot cache lifetimes |
| `analytics` | Collector endpoint and stable source ID |
| `webui.access` | Sign-in mode, manager IDs, and blocked IDs |
| `plugins` | Enabled state, public options, and environment binding names |

Repository-backed updates are available to the Runtime through the WebUI snapshot endpoint without rebuilding the application.

## Secret bindings

Plugin declarations may reference an environment variable by name:

```json
{
  "@i0c/analytics-sink-http": {
    "enabled": true,
    "version": 1,
    "secrets": {
      "writeKey": "I0C_SECRET"
    }
  }
}
```

The document stores `I0C_SECRET`, not its value. The actual value belongs in the WebUI and Runtime deployment environments and must match exactly.

## Access modes

- `authenticated`: any signed-in GitHub user can use the WebUI, except blocked users.
- `allowlist`: only configured manager IDs can enter.
- `public-readonly`: signed-in users may read, while managers may edit; blocked users are denied.

GitHub numeric user IDs are used because usernames can change.

## Validation and revisions

The shared schema and installed plugin manifests validate configuration before it is accepted. Repository writes use an expected revision, so a stale editor cannot silently overwrite a newer change.

Use the WebUI for normal edits. Use `pnpm data:validate` to validate the repository-configured local input; it does not fetch a newer remote Git ref.
