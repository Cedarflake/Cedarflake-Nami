---
title: Redirect rules
description: Define exact redirects, prefix redirects, and transparent proxy routes.
---

# Redirect rules

Rules are grouped under a `Slots`, `slots`, or legacy `SLOT` root. Path keys may be nested into named groups for management without changing the public path.

```json
{
  "$schema": "https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json",
  "Slots": {
    "Main": {
      "/": {
        "type": "proxy",
        "target": "https://example.com",
        "appendPath": true,
        "description": "Primary site"
      },
      "/docs": {
        "type": "exact",
        "target": "https://docs.example.com",
        "status": 302
      }
    }
  }
}
```

## Rule types

| Type | Matching and response |
| --- | --- |
| `exact` | Matches only the full path and returns an HTTP redirect |
| `prefix` | Matches a path prefix and returns an HTTP redirect |
| `proxy` | Matches a path prefix and forwards the request to one upstream |

A string value is shorthand for a prefix redirect. Explicit objects are recommended for stable analytics IDs, descriptions, priorities, and proxy options.

## Common fields

- `target`: destination URL. `to` and `url` remain accepted aliases, but only one may be present.
- `appendPath`: appends the unmatched suffix for prefix and proxy routes.
- `status`: redirect status for non-proxy rules.
- `priority`: lower values run first when several rules share a base path.
- `analyticsId`: stable UUID used to preserve a route's analytics identity across path or target edits.
- `description`: a management-only note, limited to 500 characters and ignored by routing.

## Transparent proxy defaults

Proxy rules forward request methods, bodies, cookies, authorization, origin, referrer, and end-to-end headers by default. Upstream `Set-Cookie` headers are returned and their domain is rewritten to the public Runtime host when needed.

Advanced `proxyOptions` are overrides for an upstream that requires explicit behavior:

- request and response header set/remove operations;
- a 1–120 second upstream timeout;
- an application request-body limit up to 100 MB;
- followed or passthrough redirects, with a maximum hop count;
- response cookie domain rewrite, preservation, or stripping.

Provider limits still apply. Hop-by-hop and platform-controlled headers cannot be safely forwarded as ordinary overrides.

## Safe editing

The WebUI generates and preserves `analyticsId` values. Editing raw JSON is supported, but replacing a stable ID creates a new analytics identity. Schema validation runs before a repository revision is saved.
