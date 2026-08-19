---
title: Commands
description: Find the repository-owned pnpm command for development, validation, database setup, and deployment.
---

# Commands

This page is a lookup table. Run every command from the repository root with the pnpm version pinned by `package.json`. Common entry points come first; use the application sections when the command is not there.

| Task | Command |
| --- | --- |
| Start WebUI development | `pnpm webui:dev` |
| Start the documentation site | `pnpm docs:dev` |
| Check a documentation change | `pnpm docs:check` |
| Check the complete workspace serially | `pnpm check` |
| Initialize a first-deployment database | `pnpm database:init` |
| Build all three Runtime platforms | `pnpm runtime:build` |

A command containing `deploy` writes to an external provider. Do not use one as a build or validation command.

## Repository checks

| Command | Scope |
| --- | --- |
| `pnpm check` | Full serial workspace validation |
| `pnpm config:check` | Shared configuration package |
| `pnpm plugins:check` | Plugin packages, tests, and boundaries |
| `pnpm data:validate` | Configured local instance and redirect inputs |

## WebUI

| Command | Purpose |
| --- | --- |
| `pnpm webui:dev` | Start Next.js development |
| `pnpm webui:test` | Run WebUI tests |
| `pnpm webui:lint` | Run ESLint and locale-message validation |
| `pnpm webui:build` | Create the production build |
| `pnpm webui:start` | Start the built application |

## Runtime

| Command | Purpose |
| --- | --- |
| `pnpm runtime:check` | Type-check the Runtime |
| `pnpm runtime:test` | Run Runtime tests |
| `pnpm runtime:build` | Build all supported provider outputs serially |
| `pnpm runtime:build:cf` | Build Cloudflare output |
| `pnpm runtime:build:vc` | Build Vercel output |
| `pnpm runtime:build:nf` | Build Netlify output |
| `pnpm runtime:dev:cf` | Start Cloudflare development tools |
| `pnpm runtime:dev:vc` | Start Vercel development tools |
| `pnpm runtime:dev:nf` | Start Netlify development tools |

`runtime:deploy:cf`, `runtime:deploy:vc`, and `runtime:deploy:nf` write to external providers. Confirm the signed-in account and target environment before running one.

## Database initialization and schema updates

| Command | Target |
| --- | --- |
| `pnpm database:init` | Initialize the selected repository, then the selected analytics store |
| `pnpm database:update postgres repository` | PostgreSQL data repository |
| `pnpm database:update postgres analytics` | PostgreSQL analytics store |
| `pnpm database:update d1 repository` | D1 data repository |
| `pnpm database:update d1 analytics` | D1 analytics store |

## Plugin authoring

| Command | Purpose |
| --- | --- |
| `pnpm plugin:create --kind <kind> --name <name>` | Scaffold a workspace plugin |
| `pnpm plugins:boundaries` | Check dependency boundaries |
| `pnpm --filter @nami/plugin-sdk check` | Type-check the SDK |
| `pnpm --filter @nami/plugin-sdk test` | Test the SDK |

## Documentation

| Command | Purpose |
| --- | --- |
| `pnpm docs:dev` | Start the VitePress development server |
| `pnpm docs:check` | Check locale parity and build the site |
| `pnpm docs:build` | Build the documentation site |
| `pnpm docs:preview` | Preview the built site |
