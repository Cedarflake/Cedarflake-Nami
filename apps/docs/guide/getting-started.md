---
title: About this project
description: Learn the purpose, components, scope, and next steps of Nami.
---

# About this project

Nami is a personal edge redirect experiment that serves Revaea. It combines a database-backed control plane, optional edge Runtimes, optional analytics, and compile-time extensions in one repository.

It is not a hosted short-link service or an enterprise redirect platform. Its plugins and SDK serve this workspace and are not planned as public packages. This documentation describes the existing system and the steps required to deploy another instance.

## Use case

Suppose you want this result:

```text
https://go.example.com/docs  →  https://docs.example.com
```

A `/docs` rule created in the WebUI is stored in the database with its revision history. A Runtime deployed at the edge receives public requests for `go.example.com` and returns the redirect or proxy response.

## Main components

- **The WebUI** is the management surface. It handles sign-in, rule editing, settings, and analytics.
- **The database** stores editable state. PostgreSQL is the default, with Cloudflare D1 as an alternative.
- **The Runtime** handles visitor requests. Cloudflare, Vercel, and Netlify are alternative hosts; a first deployment needs only one.

The WebUI turns the stored configuration into a validated snapshot. The Runtime reads that snapshot, so it never needs a database account or connection string.

## Feature scope

The common uses are straightforward:

- send one short path such as `/docs` to a full URL;
- move a whole old path tree such as `/old/*` to a new site;
- transparently proxy an upstream while the Runtime domain stays in the browser address bar.

Analytics is optional. When enabled, it shows matched requests, estimated human visits, entry domains, and automated traffic without storing IP addresses, full User-Agent strings, full referrer URLs, or raw query parameters.

## Intended use

Nami primarily supports Revaea infrastructure and personal engineering experiments. It can also be studied or self-deployed by developers interested in the implementation.

Each component must be deployed and configured by its operator. Plugins are selected at build time, and changing database providers does not migrate existing data.

## Next steps

Read [how it works](/guide/architecture) for the data flow between the WebUI, database, and Runtime.

For deployment, continue with [choose a setup](/deployment/choose-a-topology). It begins with one practical combination without requiring prior knowledge of every provider and plugin.
