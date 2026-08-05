# Runtime Build

`@i0c/runtime-build` resolves a compile-time Runtime platform installation and exposes it to the generic i0c Runtime entry through a virtual module. Platform packages provide their own Manifest, module specifier, bundle dependencies, and output entry; `apps/runtime` does not import concrete adapters.

External adapters can be installed in the root Runtime installation config and built without adding host source files.

## Checks

```bash
pnpm --filter @i0c/runtime-build check
pnpm --filter @i0c/runtime-build test
```

Apache-2.0. See the repository root `LICENSE`.

---

English · [简体中文](README.zh-CN.md)
