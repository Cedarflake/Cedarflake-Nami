# <img src="./assets/brand/wordmark.webp" alt="Nami" width="420">

Nami is a personal edge redirect playground with a database-backed control plane, provider-selectable Runtime, optional analytics, and compile-time extensions.

It is maintained for personal use and engineering experiments. It is not a hosted URL-shortening service or an enterprise redirect platform.

## What it provides

- Deploy one Runtime adapter for Cloudflare Workers, Vercel Edge Functions, or Netlify Edge Functions.
- Manage instance configuration and redirect rules through a Next.js WebUI.
- Store editable data and analytics in PostgreSQL by default, or select Cloudflare D1 adapters.
- Keep the Runtime independent from database credentials through validated WebUI snapshots.
- Compose data sources, repositories, analytics, features, and platform adapters at build time.

## Workspace

| Project | Path | Responsibility |
| --- | --- | --- |
| Runtime | [apps/runtime](apps/runtime) | Edge redirect and transparent-proxy data plane |
| WebUI | [apps/webui](apps/webui) | Authentication, editing, revisions, settings, and analytics control plane |
| Documentation | [apps/docs](apps/docs) | Bilingual VitePress user, deployment, operations, and extension guides |
| Shared packages | [packages](packages) | Configuration, database infrastructure, plugin protocols, SDK, host, and build contracts |
| Official plugins | [plugins](plugins) | Runtime platforms, data sources and repositories, analytics, and Runtime features |

Runtime and WebUI plugins are selected explicitly before build. Remote instance configuration can configure installed code, but it never downloads or executes a new package.

## Live endpoints

- Cloudflare Runtime: https://i0c.cc, https://www.i0c.cc, https://api.i0c.cc
- Vercel Runtime: https://vc.i0c.cc
- Netlify Runtime: https://nf.i0c.cc
- WebUI: https://u.i0c.cc
- Documentation: https://d.i0c.cc

## Local setup

Use Node.js 22 and the pnpm version declared by the repository:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Common entrypoints:

```bash
pnpm webui:dev
pnpm runtime:dev:cf
pnpm docs:dev
pnpm database:init
```

Run `pnpm check` for the full workspace suite, or use the owner-specific commands documented below. Database initialization, schema updates, and provider deploys are explicit external operations and are not part of builds or checks.

Brand image sources live in [`assets/brand`](assets/brand). After replacing a source file, synchronize and verify its Runtime, WebUI, and documentation outputs:

```bash
pnpm assets:sync
pnpm assets:check
```

## Documentation

- [About this project](apps/docs/guide/getting-started.md)
- [How it works](apps/docs/guide/architecture.md)
- [Choose a setup](apps/docs/deployment/choose-a-topology.md)
- [Create the first rule](apps/docs/guide/first-rule.md)
- [Read analytics](apps/docs/guide/analytics.md)
- [Database initialization and schema updates](apps/docs/operations/database.md)
- [Analytics semantics reference](apps/docs/reference/analytics.md)
- [Compile-time plugin architecture](apps/docs/plugins/architecture.md)
- [Command reference](apps/docs/reference/commands.md)
- [Runtime package documentation](apps/runtime/README.md)
- [WebUI package documentation](apps/webui/README.md)

## License

Apache-2.0. See [LICENSE](LICENSE).

---

English · [简体中文](README.zh-CN.md)
