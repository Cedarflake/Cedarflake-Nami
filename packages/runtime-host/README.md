# Runtime Host

`@nami/runtime-host` owns the provider-neutral Runtime assembly contracts. It combines the Nami request handler with one compile-time platform plugin and validates the installed Runtime Data Source, Analytics Sink, and Feature set without importing concrete implementations.

Workspace-local plugins expose their Manifest and typed factory or Runtime Installation entrypoints, then join the build through the root `nami.runtime.config.ts`. Platform and Feature fixtures prove that this assembly does not require changes to `apps/runtime` source. Public package distribution is not part of the current contract.

## Checks

```bash
pnpm --filter @nami/runtime-host check
pnpm --filter @nami/runtime-host test
```

Apache-2.0. See the repository root `LICENSE`.

---

English · [简体中文](README.zh-CN.md)
