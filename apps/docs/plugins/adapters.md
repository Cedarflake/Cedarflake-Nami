---
title: Write an adapter
description: Add a Runtime platform, data repository, or analytics store without coupling it to application core.
---

# Write an adapter

i0c supports self-authored adapters for Runtime platforms and database-backed WebUI services. Adapters are compile-time plugins: the package is added to this workspace, registered in the root installation config, and bundled when its host is rebuilt.

## Choose the extension slot

| Goal | Plugin kind | Contract | Installation target |
| --- | --- | --- | --- |
| Run redirects on another edge provider | `runtime-platform` | Convert the provider request into a `RuntimeRequestHandler` call | `i0c.runtime.config.ts` |
| Store instance configuration and redirect rules elsewhere | `data-repository` | `I0cDataRepository` | `i0c.webui.config.ts` |
| Store and query analytics elsewhere | `analytics-store` | `I0cAnalyticsStore` | `i0c.webui.config.ts` |

Use a data repository for the two control-plane documents: `config` and `redirects`. Use an analytics store for events, queries, aggregate rebuilds, and retention. They are separate slots even when both use the same database product.

A database product that supports both jobs normally uses this layout:

```text
packages/database-example/       # optional shared client and schema-update mechanics
plugins/repository/example/      # config and redirect documents
plugins/store/example/           # analytics events and queries
```

The shared provider package should contain only reusable connection, transaction, and schema-update primitives. Repository and analytics behavior remains in their respective plugins.

## Common authoring flow

1. Generate the package in the correct plugin category.
2. Add the workspace package to the root development dependencies with pnpm.
3. Define its manifest, bilingual description, capabilities, configuration Schema, and secret bindings.
4. Implement the extension-slot contract.
5. Add contract and manifest tests.
6. Add its manifest to the Runtime or WebUI manifest catalog.
7. Register its factory or platform descriptor in the root installation config.
8. Select and configure the installed implementation in bootstrap and instance configuration.
9. Initialize its schema, or apply pending schema updates, when the adapter owns database tables.
10. Rebuild and deploy the affected host.

The generator creates a workspace package, but deliberately does not activate it:

```sh
pnpm plugin:create --kind <kind> --name <kebab-name>
```

After generation, use pnpm to add the generated package to the root manifest; do not hand-edit the lockfile:

```sh
pnpm add -Dw <plugin-package-name>@workspace:*
```

## Add a Runtime platform

Create the package:

```sh
pnpm plugin:create --kind runtime-platform --name example-edge
```

Then implement these package surfaces:

```text
plugins/runtime/example-edge/
├─ src/manifest.ts
├─ src/runtime.ts
├─ src/installation.ts
└─ tests/
```

The Runtime module must export `runtimePlatformPlugin`. Its `create(handler)` function adapts the provider entrypoint to the shared handler and supplies the provider context, environment bindings, background-task hook, country, and cache only when the platform exposes them.

Replace the generated generic `./plugin` export with explicit `./runtime` and `./installation` package exports so the build can load both surfaces independently.

The installation descriptor tells the build system which module and packages belong in that platform bundle:

```ts
import { defineRuntimePlatformInstallation } from "@i0c/plugin-sdk/runtime"

import { exampleEdgeManifest } from "./manifest"

export const exampleEdgeInstallation = defineRuntimePlatformInstallation({
  key: "example-edge",
  manifest: exampleEdgeManifest,
  runtimeModule: "@i0c/plugin-runtime-example-edge/runtime",
  bundlePackages: ["@i0c/plugin-runtime-example-edge"],
  outputEntry: "platforms/example-edge",
})
```

Import the manifest into `i0c.runtime.manifests.ts` and append it to `runtimePlatformManifests`; this lets configuration validation and WebUI status views discover the platform. Then import the descriptor and append it to `runtimeInstallationConfig.platforms` in `i0c.runtime.config.ts`. The redirect handler does not need a new provider `switch`.

Build the adapter directly while developing it:

```sh
pnpm --filter i0c-redirect-worker build:platform example-edge
```

A provider may still require its own deployment wrapper, output preparation, or provider configuration. Add those at the Runtime deployment boundary; do not move provider-specific APIs into the shared handler.

## Add a data repository

Create the package:

```sh
pnpm plugin:create --kind data-repository --name example-database
```

Implement the `I0cDataRepository` contract exported by `@i0c/plugin-sdk`:

- `read` reads one versioned document;
- `write` performs an optimistic, atomic revision update;
- `readSnapshot` returns a consistent configuration-and-rules snapshot;
- optional `management` operations initialize, import, inspect, list revisions, and restore data.

Database-backed repositories should also expose a `PluginSchemaMigrationProvider` from `@i0c/plugin-api`. Schema history must be ordered, checksummed where the database supports it, and applied atomically when possible.

The generated plugin factory can be installed without changing WebUI application code:

```ts
dataRepository: {
  enabledByDefault: true,
  ...exampleDatabaseRepositoryPlugin,
}
```

Add the manifest and its default-enabled state to the repository selection in `i0c.webui.manifests.ts`. Register exactly one active repository factory in `webUiPluginInstallations.dataRepository` in `i0c.webui.config.ts`. The WebUI continues to call the shared repository contract and does not need database-specific branches in editors or API routes.

## Add an analytics store

Create the package:

```sh
pnpm plugin:create --kind analytics-store --name example-database
```

Implement the `I0cAnalyticsStore` contract exported by `@i0c/plugin-sdk`:

- ingest events idempotently;
- provide overview, detail, automation, and entry-domain queries;
- rebuild aggregates and enforce retention;
- report health and whether the store is configured;
- expose optional `schemaMigrations` for owned tables.

Add the manifest descriptor to `webUiPluginDescriptors.analyticsStores` in `i0c.webui.manifests.ts`, then add the matching factory installation to `webUiPluginInstallations.analyticsStores` in `i0c.webui.config.ts`. Multiple analytics stores may be compiled in, while instance configuration determines which installed store is enabled. Its configuration fields appear in WebUI only after its manifest is statically installed and declared in the default instance configuration.

```ts
analyticsStores: [
  {
    enabledByDefault: false,
    ...exampleDatabaseAnalyticsStorePlugin,
  },
]
```

## Select the adapter

Installation and selection are separate:

- `i0c.runtime.config.ts` and `i0c.webui.config.ts` decide which code is bundled;
- `i0c.runtime.manifests.ts` and `i0c.webui.manifests.ts` expose installed metadata to validation and WebUI;
- bootstrap configuration selects infrastructure needed before remote configuration can be read;
- instance configuration controls non-secret plugin settings and enablement;
- deployment environment bindings provide secrets and provider-native objects.

The current bootstrap provider unions list the built-in GitHub, PostgreSQL, and D1 choices. Replacing the implementation behind an existing slot does not change application core. Introducing a new selectable provider identifier also requires extending the shared bootstrap type, validation, defaults, and setup documentation. That is configuration-model work, not redirect or analytics business-logic work.

## Validate and ship

Run checks serially from the repository root:

```sh
pnpm --filter <plugin-package-name> check
pnpm --filter <plugin-package-name> test
pnpm plugins:check
```

Then run the owning host build. Initialize a new database with `pnpm database:init`; use `pnpm database:update <provider> <purpose>` only for pending schema changes in an existing database. Deployment remains a separate, explicitly authorized operation.

Use the existing implementations as reference:

- `plugins/runtime/cloudflare`, `plugins/runtime/vercel`, and `plugins/runtime/netlify` for platform adapters;
- `plugins/repository/d1` and `plugins/repository/postgres` for rule/configuration repositories;
- `plugins/store/d1` and `plugins/store/postgres` for analytics stores.
