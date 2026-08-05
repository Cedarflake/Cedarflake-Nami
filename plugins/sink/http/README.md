# HTTP analytics sink plugin

Signs analytics events with HMAC-SHA256 and delivers them to the configured collector with edge-compatible manual redirects and bounded transient retries. Delivery failures are reported to the Runtime host, which keeps redirect responses fail-open.

---

English · [简体中文](README.zh-CN.md)
