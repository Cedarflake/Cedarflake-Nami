# Runtime Host

`@i0c/runtime-host` owns the provider-neutral Runtime assembly contracts. It combines the i0c request handler with one compile-time platform plugin and validates the installed Runtime Data Source, Analytics Sink, and Feature set without importing concrete implementations.

Workspace-local plugins expose their Manifest and typed factory or Runtime Installation entrypoints, then join the build through the root `i0c.runtime.config.ts`. Platform and Feature fixtures prove that this assembly does not require changes to `apps/runtime` source. Public package distribution is not part of the current contract.

## Checks

```bash
pnpm --filter @i0c/runtime-host check
pnpm --filter @i0c/runtime-host test
```

Apache-2.0. See the repository root `LICENSE`.

---

English · [简体中文](README.zh-CN.md)
