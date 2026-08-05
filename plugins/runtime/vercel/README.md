# Vercel Runtime plugin

Adapts Vercel Edge requests, country headers, selected environment bindings, and `waitUntil` to the provider-neutral Runtime handler contract.

The environment binding allowlist is a compile-time adapter option so the edge bundle can expose only known bindings before remote configuration loads. The remote plugin declaration has no adapter fields and is used to require the selected platform to remain enabled.

---

English · [简体中文](README.zh-CN.md)
