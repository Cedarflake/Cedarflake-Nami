# Bot classifier feature plugin

Classifies bounded Runtime analytics events through the `onAnalyticsEvent` feature hook. The registration uses deterministic ordering, a configured timeout, and fail-open behavior so classification failures cannot replace redirect responses.

The remote declaration may set `hookTimeoutMs` or disable the feature. No IP address, full User-Agent, query string, destination, or raw unmatched path is retained.

```bash
pnpm --filter @nami/plugin-feature-bot-classifier check
pnpm --filter @nami/plugin-feature-bot-classifier test
```

---

English · [简体中文](README.zh-CN.md)
