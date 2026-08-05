# Netlify Runtime plugin

Adapts Netlify Edge requests, geo context, selected environment bindings, and `waitUntil` to the provider-neutral Runtime handler contract.

The environment binding allowlist is a compile-time adapter option because it is needed before remote configuration loads. The remote plugin declaration has no adapter fields and is used to require the selected platform to remain enabled.

---

English · [简体中文](README.zh-CN.md)
