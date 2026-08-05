---
title: Architecture
description: Learn how a rule moves from the WebUI to the database, snapshot, and Runtime response.
---

# Architecture

The following example shows how a rule moves from storage to a public response:

```text
/docs  →  https://docs.example.com
```

## Saving a rule

You enter the path and destination in the WebUI, then save. The WebUI validates the input before it writes a new revision to the database.

The database holds editable documents and their revision history. The Runtime does not query those tables. Instead, the WebUI exposes a separate snapshot containing only validated instance settings and redirect rules.

```text
Edit in the WebUI
        ↓
Validate and write to the database
        ↓
Expose a snapshot the Runtime can read
```

The practical result is that database credentials stay with the WebUI. The public Runtime never needs to know where the database lives.

## Handling a visitor request

A request for `https://go.example.com/docs` first reaches the selected edge platform. The Runtime finds `/docs` in its current snapshot and returns a redirect response.

```text
Visitor → Runtime → match /docs → return 302 → browser opens the destination
```

For a transparent proxy rule, the last step changes: the Runtime requests the upstream and passes its response back while `go.example.com` remains in the address bar.

The Runtime caches its last valid snapshot. A brief WebUI or database outage does not immediately remove working rules, and a failed refresh cannot replace the good snapshot with invalid data.

## Separating the control plane and Runtime

The WebUI and Runtime have different jobs:

- the WebUI needs sign-in, database access, form validation, and revision history;
- the Runtime needs to answer public requests quickly while holding as little state and as few secrets as possible.

Keeping them separate lets the management surface run on a regular application platform while public traffic runs in a Cloudflare, Vercel, or Netlify edge environment. Those three adapters solve the same hosting problem; they are choices, not required replicas.

## Analytics flow

When analytics is enabled, the Runtime sends signed events to the WebUI collector, and the WebUI writes them to the analytics database. A delivery failure does not change the redirect response already being served.

Events omit IP addresses, full User-Agent strings, destination URLs, and raw query parameters. “Effective visits” also excludes bots, link previews, and controlled continuation hops, so it will not always equal the matched-request count.

## Changes that require a rebuild

Everyday rules and instance settings live in the database. Saving them publishes a new snapshot without rebuilding an application.

The database type, Runtime snapshot source, and installed plugins must be known before the application starts. Those choices live in the repository's startup configuration (the bootstrap config) and require a rebuild when changed. Actual secret values remain in the deployment platform's environment settings.

Continue with [choose a setup](/deployment/choose-a-topology). A first deployment only needs one small combination and does not require prior knowledge of the complete plugin architecture.
