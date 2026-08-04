---
title: Choose a deployment topology
description: Select one control plane, one storage plan, and one or more independent Runtime providers.
---

# Choose a deployment topology

The provider adapters are deployment choices, not a requirement to run three copies of the application.

## Recommended default

```text
Vercel WebUI ──► PostgreSQL
      ▲              ├── configuration and rules
      │              └── analytics
      │
one Runtime ──► Cloudflare, Vercel, or Netlify
```

This is the least surprising setup because the checked-in defaults already select PostgreSQL for both stores.

## Cloudflare storage

```text
WebUI ──► D1 repository database
   └───► D1 analytics database

Runtime ──► WebUI snapshot and collector endpoints
```

Use two D1 databases so repository revisions and high-volume analytics events have separate schema migration histories and operational limits. The WebUI reaches D1 through its server-only adapter; the Runtime still receives no database credentials.

## Multiple Runtime providers

Deploy several Runtime providers only when you want independent domains, provider comparison, or a manual fallback. Each provider:

- builds the same routing host;
- reads the same WebUI snapshot;
- uses the same analytics `sourceId`;
- records its own `provider` and `entryDomain`.

i0c.cc does not provide global traffic steering between these deployments. DNS or another external traffic layer decides which provider receives a request.

## Mixed stores

The repository and analytics store are separate plugin slots, so they can use different providers. A mixed setup is valid, but it adds two operational systems. Prefer one database family until you have a concrete reason to split them.

## Decision table

| Need | Suggested choice |
| --- | --- |
| Smallest setup | PostgreSQL and one Runtime |
| Cloudflare-managed data | Two D1 databases and one Runtime |
| Immediate edits without Git rebuilds | PostgreSQL or D1 repository |
| Provider comparison | Multiple Runtime deployments sharing one WebUI |
| Read-only Git history as the data source | GitHub repository adapter |
