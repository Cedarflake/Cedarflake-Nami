# @i0c/plugin-catalog

Static installed-plugin catalog for i0c.cc hosts. It exposes Runtime- and WebUI-specific manifest projections and validates remote declarations against installed manifests, host support, plugin-owned Schemas, Secret declarations, and slot conflicts.

This package performs compile-time registration only. It does not discover or load packages at runtime.

```bash
pnpm --filter @i0c/plugin-catalog check
pnpm --filter @i0c/plugin-catalog test
```

See [../../apps/docs/plugins/architecture.md](../../apps/docs/plugins/architecture.md) for the complete architecture.

---

English · [简体中文](README.zh-CN.md)
