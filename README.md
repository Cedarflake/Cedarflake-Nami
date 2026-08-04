# <img src="./logo.webp" alt="i0c.cc" width="420">

i0c.cc is a personal edge redirect playground with a database-backed control plane, PostgreSQL enabled by default, and an archived Git fallback. It runs the same core through optional edge-platform adapters and provides a WebUI with optional analytics for my own use.

## Positioning

This repository is maintained for personal use and engineering experimentation. It is not intended to be a hosted URL-shortening service or an enterprise redirect platform.

- Deploy whichever Runtime adapter fits the environment; Cloudflare, Vercel, and Netlify are supported alternatives rather than required replicas.
- Use PostgreSQL by default, or access Cloudflare D1 through a native binding or the server-only REST adapter, for immediate saves, immutable history, and rollback; Git remains an archived build-time fallback.
- Use the WebUI and analytics when they help the personal workflow; the roadmap prioritizes clarity and reliability over feature parity with commercial products.

## Projects

| Project | Path | Description |
|---------|------|-------------|
| Runtime | [apps/runtime](apps/runtime) | Provider-selectable redirect runtime for Cloudflare Workers, Vercel Edge Functions, and Netlify Edge Functions. |
| WebUI | [apps/webui](apps/webui) | Next.js management panel for editing `config.json` and `redirects.json`, inspecting plugins, and querying analytics. |
| Configuration | [packages/config](packages/config) | Bootstrap defaults, both data-document schemas, and validation shared by both applications. |
| D1 infrastructure | [packages/database-d1](packages/database-d1) | Binding-compatible D1 contract, REST transport, migration mechanics, and test adapter shared by D1 plugins. |
| PostgreSQL infrastructure | [packages/database-postgres](packages/database-postgres) | PostgreSQL client construction and file-backed migration mechanics shared by PostgreSQL plugins. |
| Plugin API | [packages/plugin-api](packages/plugin-api) | Stable compile-time manifests, lifecycle contracts, and typed extension boundaries for official plugins. |
| Plugin SDK | [packages/plugin-sdk](packages/plugin-sdk) | Internal authoring helpers and scaffolding for workspace compile-time plugins. |
| Plugin Testkit | [packages/plugin-testkit](packages/plugin-testkit) | Shared plugin contracts and dependency-boundary checks. |
| Plugin Catalog | [packages/plugin-catalog](packages/plugin-catalog) | Optional official presets and host-specific plugin configuration validation. |
| Runtime Host | [packages/runtime-host](packages/runtime-host) | Platform-neutral Runtime deployment and executable-plugin installation contracts. |
| Runtime Build | [packages/runtime-build](packages/runtime-build) | Build-time installation validation, root-config binding, and selected-adapter bundling. |
| Official plugins | [plugins](plugins) | Git, PostgreSQL, and D1 data backends, an HTTP Runtime snapshot source, three Runtime adapters, analytics delivery and storage, and bot classification. |

Executable plugins are selected at build time: Runtime installations live in [i0c.runtime.config.ts](i0c.runtime.config.ts), WebUI server installations in [i0c.webui.config.ts](i0c.webui.config.ts), and client-safe WebUI renderers in [apps/webui/webui.extensions.ts](apps/webui/webui.extensions.ts). The remote `config.json` document configures installed code but never downloads or executes new packages.

## Live previews

- Runtime Cloudflare domains: https://i0c.cc, https://www.i0c.cc, https://api.i0c.cc
- Runtime Vercel deployment: https://vc.i0c.cc
- Runtime Netlify deployment: https://nf.i0c.cc
- WebUI: https://u.i0c.cc

## Deploy

This repository is a monorepo. Deploy each project from its own root directory instead of deploying the repository root as a single app.

### Runtime

Deploy the redirect runtime from [apps/runtime](apps/runtime).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Revaea/i0c.cc&root-directory=apps/runtime)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Revaea/i0c.cc)
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Revaea/i0c.cc)

If the platform detects multiple projects, choose `apps/runtime`.

Use these settings when the platform asks for project or build configuration:

| Platform | Project root | Build command | Output |
|----------|--------------|---------------|--------|
| Cloudflare Workers | `apps/runtime` | `pnpm build:cf` | `dist/platforms/cloudflare.js` |
| Vercel | `apps/runtime` | `pnpm build:vc` | `.vercel/output` |
| Netlify | `apps/runtime` | `pnpm build:nf` | `dist` |

Build from a full monorepo checkout so the Runtime can import the shared workspace packages. On Vercel, keep **Include source files outside of the Root Directory in the Build Step** enabled. The checked-in Runtime Source reads one atomic HTTP snapshot from the WebUI; GitHub Raw remains available as a build-time fallback. Configure the same `I0C_SECRET` on the WebUI and every Runtime provider.

### WebUI

Deploy the management panel from [apps/webui](apps/webui).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Revaea/i0c.cc&root-directory=apps/webui)

Use these settings on Vercel:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Build Command | `pnpm build` |
| Output Directory | Next.js default |

Keep **Include source files outside of the Root Directory in the Build Step** enabled so Vercel includes the shared workspace package. The WebUI environment contains only OAuth and deployment bindings, database access, and secrets. See [apps/webui/README.md](apps/webui/README.md) for details.

## Application configuration

The selected WebUI Repository contains two independently editable documents:

- `config.json` stores non-sensitive instance settings such as the canonical Runtime origin, cache TTLs, robots policy, analytics namespace and collector endpoint, WebUI access policy, and namespaced plugin configuration.
- `redirects.json` stores redirect rules.

The PostgreSQL and D1 Repositories implement the same optimistic-revision, atomic-snapshot, immutable-history, import/export, and rollback contract. The checked-in deployment selects PostgreSQL. The bundled WebUI can select D1 through either an injected native binding or its server-only Cloudflare REST transport. The REST path keeps D1 Account and Database IDs in bootstrap configuration and the API token in the WebUI environment.

GitHub Contents remains available as an archived build-time fallback that preserves commits on a configured branch, but it is not enabled by the checked-in deployment. The WebUI can edit both documents; invalid `config.json` content remains visible to managers so it can be repaired.

The checked-in HTTP Snapshot Source reads one validated WebUI snapshot so config and rules always come from the same Repository revision. It uses ETags, bounded retries and timeouts, and the last valid memory or platform cache. GitHub Raw remains available when Git-backed data is selected. Runtime deployments never receive database credentials or bindings.

[packages/config](packages/config) owns schemas, validation, safe defaults, and the build-time Repository and Source selection. Bootstrap changes such as GitHub paths, database provider or connection policy, HTTP snapshot URL, or GitHub OAuth scope require rebuilding. Repository migrations are deliberate external writes and never run during a build or application startup.

The former non-sensitive environment variables are not read as overrides or fallbacks. Existing values left in a provider dashboard are ignored and can be removed after the new deployment is verified. Secrets and deployment-specific bindings remain in each application's environment example.

## Local development

Enable Corepack so `pnpm` follows the version declared in `package.json`:

```bash
corepack enable
```

Install dependencies from the repository root:

```bash
pnpm install
```

Run the runtime:

```bash
pnpm runtime:dev:cf
```

Run the WebUI:

```bash
pnpm webui:dev
```

Build the selected Runtime adapter and WebUI separately:

```bash
pnpm runtime:build:cf
pnpm runtime:build:vc
pnpm runtime:build:nf
pnpm webui:build
```

Run the plugin, Runtime, and WebUI tests:

```bash
pnpm plugins:check
pnpm runtime:check
pnpm runtime:test
pnpm webui:test
```

Run the full local validation before committing:

```bash
pnpm check
```

## Data documents

All Repository implementations use the same document schemas:

```text
packages/config/config.schema.json
packages/config/redirects.schema.json
```

Each file declares its own schema through `$schema`. The default Git workflow can validate both documents from the local `origin/data` Git ref with:

```bash
pnpm data:validate
```

## Documentation

- Runtime documentation: [apps/runtime/README.md](apps/runtime/README.md)
- WebUI documentation: [apps/webui/README.md](apps/webui/README.md)
- Analytics architecture and semantics: [docs/analytics.md](docs/analytics.md)
- Internal plugin architecture: [docs/plugins.md](docs/plugins.md)
- Chinese overview: [README.zh-CN.md](README.zh-CN.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
