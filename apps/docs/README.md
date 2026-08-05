# i0c.cc documentation

VitePress source for the bilingual i0c.cc user, deployment, operations, and extension documentation.

Run commands from the repository root:

```bash
pnpm docs:dev
pnpm docs:check
pnpm docs:build
pnpm docs:preview
```

English pages live at the documentation root. Every user-facing page has a matching Chinese page under `zh-CN`. `pnpm docs:check` verifies this route parity before building the site.

The generated `.vitepress/dist` directory is local build output and must not be edited or committed. Publishing the site, configuring `d.i0c.cc`, or changing DNS remains a separate external operation.

## Vercel deployment

Create a separate Vercel project with `apps/docs` as its Root Directory. The checked-in [vercel.json](vercel.json) installs the workspace from the repository root with the Corepack-managed pnpm version, runs `corepack pnpm build`, and publishes `.vitepress/dist`. No repository-root Vercel configuration is required for the documentation site.

Attach `d.i0c.cc` only after the deployment is healthy. Project creation, deployment, domain attachment, and DNS changes remain explicit external operations.

---

English · [简体中文](README.zh-CN.md)
