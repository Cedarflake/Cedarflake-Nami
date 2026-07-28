# @i0c/config

Shared data contracts and bootstrap package for Runtime and WebUI configuration.

Normal instance settings live in `config.json` on the `data` branch and are validated by [config.schema.json](config.schema.json) plus the edge-compatible validator in [src/validation.ts](src/validation.ts). Runtime and WebUI fetch the document remotely, so valid updates do not require rebuilding either application.

Redirect rules live beside it in `redirects.json` and are described by [redirects.schema.json](redirects.schema.json). Keeping both data document schemas here avoids coupling the WebUI editor to the Runtime application package.

[src/defaults.ts](src/defaults.ts) contains only the safe fallback and bootstrap values needed before remote configuration can be loaded: the GitHub repository, data branch, document paths, and OAuth scope. Change these values only when moving the source itself; bootstrap changes require rebuilding consumers.

Secrets and deployment bindings remain in each application's environment variables. This package must never contain credentials, database URLs, signing keys, or authentication secrets.

The `webui.access` contract stores the access mode, manager GitHub numeric IDs, and an optional blocked-user list for the non-allowlist modes.

Plugin settings are namespaced under `plugins`. Public JSON values may be stored there, while `secrets` contains environment-variable binding names rather than secret values. Consumers bundle the TypeScript source directly, so the package build validates the source without producing a checked-in artifact.

Run the package check from the repository root:

```bash
pnpm config:check
```

See [README.zh-CN.md](README.zh-CN.md) for the Chinese version.
