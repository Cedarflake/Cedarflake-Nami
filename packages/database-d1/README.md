# `@nami/database-d1`

Shared Cloudflare D1 infrastructure for Nami plugins.

The package exposes a small Binding-compatible database contract, checked operation helpers, an HTTP REST transport for non-Cloudflare hosts, and reusable migration mechanics. Domain tables and SQL remain owned by each Repository or Analytics Store plugin.

The REST transport requires a server-side Cloudflare API token. Never expose it to browser code or store it in instance data configuration.

---

English · [简体中文](README.zh-CN.md)
