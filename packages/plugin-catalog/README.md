# @nami/plugin-catalog

Static installed-plugin catalog for nami hosts. It exposes Runtime- and WebUI-specific manifest projections and validates remote declarations against installed manifests, host support, plugin-owned Schemas, Secret declarations, and slot conflicts.

This package performs compile-time registration only. It does not discover or load packages at runtime.

```bash
pnpm --filter @nami/plugin-catalog check
pnpm --filter @nami/plugin-catalog test
```

See [../../apps/docs/plugins/architecture.md](../../apps/docs/plugins/architecture.md) for the complete architecture.

---

English · [简体中文](README.zh-CN.md)
