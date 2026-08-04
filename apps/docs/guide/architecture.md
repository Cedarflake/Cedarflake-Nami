---
title: Architecture
description: Understand the control plane, data plane, storage, and compile-time extension boundaries.
---

# Architecture

i0c.cc separates management from request handling. The WebUI is the control plane; a Runtime deployment is the data plane.

```text
Browser ──► WebUI ──► Data repository
                └──► Analytics store

Visitor ──► Runtime ──► Upstream target
                ├──► WebUI snapshot endpoint
                └──► WebUI analytics collector
```

## WebUI control plane

The Next.js WebUI owns authentication, visual rule editing, instance settings, validation, immutable revisions, backup and rollback, and analytics queries. It is the only application that receives database credentials.

The default setup stores both editable data and analytics in PostgreSQL. D1 adapters can replace either store when selected in the bootstrap configuration.

## Runtime data plane

The Runtime reads a validated snapshot, caches it, matches requests, and produces redirects or transparent proxy responses. It does not connect directly to PostgreSQL or D1.

The same host core is built with one of three platform adapters:

- Cloudflare Workers
- Vercel Edge Functions
- Netlify Edge Functions

Deploy one provider or several independent providers. Each deployment reports its actual entry domain and provider into the same analytics source when analytics is enabled.

## Three configuration layers

1. **Bootstrap configuration** chooses implementations that must be known before the WebUI can load, such as the repository and analytics store providers.
2. **Instance configuration** contains editable, non-sensitive Runtime, analytics, access, and plugin settings.
3. **Redirect rules** contain groups and path-based routing behavior.

Secrets stay in deployment environment variables. Instance configuration stores only binding names such as `I0C_SECRET` or `DATABASE_URL`.

## Compile-time extensions

Plugins are statically installed and bundled. The host resolves a typed manifest and installation contract for data sources, repositories, analytics stores and sinks, features, and Runtime platforms.

This architecture is designed for source-level composition and predictable edge bundles. It is not a dynamic marketplace and does not download remote executable code at runtime.

## Built-in compatibility

| Extension point | Built-in implementations |
| --- | --- |
| Runtime platform | Cloudflare Workers, Vercel Edge Functions, Netlify Edge Functions |
| Runtime data source | WebUI HTTP snapshot, GitHub Raw |
| WebUI data repository | PostgreSQL, Cloudflare D1, GitHub Contents |
| Analytics store | PostgreSQL, Cloudflare D1 |
| Analytics delivery | Signed HTTP collector |
| Runtime feature | Privacy-safe bot classifier |

D1 plugins can consume an injected native binding in a compatible host or use the WebUI's server-only REST transport. The checked-in WebUI deployment uses the REST path when D1 is selected.

## Failure boundaries

- The Runtime keeps a last-known-good snapshot when a refresh fails.
- Repository writes use optimistic revisions to reject conflicting edits.
- Database initialization and schema updates are explicit, versioned operations.
- Disabling the adapter for a deployed Runtime makes that provider unavailable; it does not undeploy the provider automatically.
