# Cloudflare Runtime plugin

Adapts Cloudflare Worker requests, bindings, country metadata, Cache API, and `waitUntil` to the provider-neutral Runtime handler contract.

`useDefaultCache` is a compile-time adapter option because it affects how the remote configuration itself is loaded. The remote plugin declaration has no adapter fields and is used to require the selected platform to remain enabled.

---

English · [简体中文](README.zh-CN.md)
