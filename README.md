# <img src="./logo.webp" alt="i0c.cc" width="420">

i0c.cc is a personal edge redirect playground with Git as its default data backend. It runs the same core through optional edge-platform adapters and provides a WebUI with optional analytics for my own use.

## Positioning

This repository is maintained for personal use and engineering experimentation. It is not intended to be a hosted URL-shortening service or an enterprise redirect platform.

- Deploy whichever Runtime adapter fits the environment; Cloudflare, Vercel, and Netlify are supported alternatives rather than required replicas.
- Keep Git as the simple default, or select the PostgreSQL Repository when immediate database-backed saves are more useful.
- Use the WebUI and analytics when they help the personal workflow; the roadmap prioritizes clarity and reliability over feature parity with commercial products.

## Projects

| Project | Path | Description |
|---------|------|-------------|
| Runtime | [apps/runtime](apps/runtime) | Provider-selectable redirect runtime for Cloudflare Workers, Vercel Edge Functions, and Netlify Edge Functions. |
| WebUI | [apps/webui](apps/webui) | Next.js management panel for editing `config.json` and `redirects.json`, inspecting plugins, and querying analytics. |
| Configuration | [packages/config](packages/config) | Bootstrap defaults, both data-document schemas, and validation shared by both applications. |
| Plugin API | [packages/plugin-api](packages/plugin-api) | Stable compile-time manifests, lifecycle contracts, and typed extension boundaries for official plugins. |
| Plugin Testkit | [packages/plugin-testkit](packages/plugin-testkit) | Shared plugin contracts and dependency-boundary checks. |
| Plugin Catalog | [packages/plugin-catalog](packages/plugin-catalog) | Optional official presets and host-specific plugin configuration validation. |
| Runtime Host | [packages/runtime-host](packages/runtime-host) | Platform-neutral Runtime deployment and executable-plugin installation contracts. |
| Runtime Build | [packages/runtime-build](packages/runtime-build) | Build-time installation validation, root-config binding, and selected-adapter bundling. |
| Official plugins | [plugins](plugins) | Git and PostgreSQL data backends, an HTTP Runtime snapshot source, three Runtime adapters, analytics delivery and storage, and bot classification. |

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

Build from a full monorepo checkout so the Runtime can import the shared workspace packages. On Vercel, keep **Include source files outside of the Root Directory in the Build Step** enabled. The default Runtime Source reads the `data` branch; the optional HTTP Snapshot Source reads one atomic snapshot from the WebUI. Analytics delivery only requires the `ANALYTICS_WRITE_KEY` secret on each provider.

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

GitHub Contents remains the default Repository and preserves commits on the `data` branch. The optional PostgreSQL Repository uses optimistic document revisions and exposes an atomic two-document snapshot. The WebUI can edit both documents; invalid `config.json` content remains visible to managers so it can be repaired.

The default GitHub Runtime Source reads both Raw documents with independent caches. The optional HTTP Snapshot Source reads one validated WebUI snapshot so config and rules always come from the same Repository revision. It uses ETags, bounded retries and timeouts, and the last valid memory or platform cache. Runtime deployments never receive PostgreSQL credentials.

[packages/config](packages/config) owns schemas, validation, safe defaults, and the build-time Repository and Source selection. Bootstrap changes such as GitHub paths, PostgreSQL connection policy, HTTP snapshot URL, or GitHub OAuth scope require rebuilding. PostgreSQL Repository migrations are deliberate external writes and never run during a build or application startup.

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

The two Repository implementations use the same document schemas:

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
