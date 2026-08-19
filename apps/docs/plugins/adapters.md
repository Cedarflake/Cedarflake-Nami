---
title: Write an adapter
description: Add another Runtime platform, rules database, or analytics database to Nami.
---

# Write an adapter

The easiest way to add an adapter is to begin with a nearby built-in implementation. Use `plugins/runtime` for another edge provider, or the PostgreSQL and D1 plugins for another database. This page describes the boundaries to keep; provider SDK details remain inside the new plugin.

An adapter is a build-time plugin. After adding it to the workspace, rebuild the Runtime or WebUI. Instance settings can only select implementations already present in that build.

## Decide which layer you are replacing

Another edge provider is a `runtime-platform` loaded by the Runtime. Another rules database is a `data-repository`, while another analytics database is an `analytics-store`; both database plugins are loaded by the WebUI.

Rules and analytics use separate contracts. Even when one database product supports both jobs, keep two plugins: one owns settings, rules, and revisions, while the other owns events, queries, aggregates, and retention.

## Start from the generated package

Generate the matching package kind first:

```sh
pnpm plugin:create --kind <kind> --name <kebab-name>
```

The generator creates a manifest, configuration, implementation skeleton, and tests, but does not enable the plugin. After implementing it, add the manifest to the host list and the factory or platform descriptor to the root installation config. Add the new workspace dependency with pnpm rather than editing the lockfile:

```sh
pnpm add -Dw <plugin-package-name>@workspace:*
```

Run the plugin contracts and the owning application build. The plugin appears in instance settings only after that build is deployed.

## Add a Runtime platform

Scaffold the platform package:

```sh
pnpm plugin:create --kind runtime-platform --name example-edge
```

A platform plugin normally contains:

```text
plugins/runtime/example-edge/
├─ src/manifest.ts
├─ src/runtime.ts
├─ src/installation.ts
└─ tests/
```

`runtime.ts` converts the provider request, environment, background work, and geographic metadata into input for the shared `RuntimeRequestHandler`. Matching, redirects, and proxy behavior remain in the Runtime core; do not copy them into the adapter.

`installation.ts` tells the build system which module to load, which dependencies to bundle, and where to write the output:

```ts
import { defineRuntimePlatformInstallation } from "@nami/plugin-sdk/runtime"

import { exampleEdgeManifest } from "./manifest"

export const exampleEdgeInstallation = defineRuntimePlatformInstallation({
  key: "example-edge",
  manifest: exampleEdgeManifest,
  runtimeModule: "@nami/plugin-runtime-example-edge/runtime",
  bundlePackages: ["@nami/plugin-runtime-example-edge"],
  outputEntry: "platforms/example-edge",
})
```

Register it in two places:

- `nami.runtime.manifests.ts` makes it visible to validation and the WebUI status page;
- `nami.runtime.config.ts` includes it in Runtime builds.

Build the new platform on its own while developing:

```sh
pnpm --filter nami-runtime build:platform example-edge
```

Provider-specific deployment wrappers, output preparation, and configuration stay at the Runtime deployment boundary. The shared handler should not import a provider SDK.

## Add a rules database

Scaffold a data repository:

```sh
pnpm plugin:create --kind data-repository --name example-database
```

Implement `NamiDataRepository`. Its important behavior is:

- read a versioned settings or rules document;
- reject a write based on an old version instead of silently overwriting another editor;
- read a consistent settings-and-rules snapshot;
- optionally provide initialization, import, history, and restore operations.

When the database owns tables, also implement `PluginSchemaMigrationProvider`. Its update history must be ordered; where transactions exist, the structural change and version record should succeed or fail together.

Register the manifest in `nami.webui.manifests.ts` and the factory in `nami.webui.config.ts`. One WebUI build selects one active rules store. Editors and API routes should not gain a database-specific branch.

## Add an analytics database

Scaffold an analytics store:

```sh
pnpm plugin:create --kind analytics-store --name example-database
```

Implement `NamiAnalyticsStore`, including:

- idempotent Runtime event ingestion;
- overview, single-rule, entry-domain, and automation queries;
- aggregate rebuild and data retention;
- health and missing-configuration status;
- updates for the store's own database structure.

Add the manifest to the analytics-store list in `nami.webui.manifests.ts`, and add the factory to `nami.webui.config.ts`. A build may contain several analytics stores, with instance configuration choosing which one is enabled.

When one new database product supports both uses, prefer this shape:

```text
packages/database-example/       # Shared connection, transaction, and schema-update tools
plugins/repository/example/      # Rules, settings, and revisions
plugins/store/example/           # Analytics events and queries
```

Keep only genuinely shared database infrastructure in the common package. Do not merge the two business contracts into one large adapter.

## Making the registered adapter usable

Root installation config puts code in the build, and the manifest list lets validation and the WebUI recognize it. If the application needs the adapter before it can open instance data, startup config must select it as well. After deployment, instance settings own public options and enabled state; the deployment environment still supplies real secrets.

Another implementation of an existing kind does not require application-core changes. A new database name also has to be understood by shared startup config, validation, and initialization, because the application must select it before it can read the instance document.

## Checks to run before finishing

Check the plugin first:

```sh
pnpm --filter <plugin-package-name> check
pnpm --filter <plugin-package-name> test
pnpm plugins:check
```

Then build the owning application. A Runtime platform needs its platform build; a rules or analytics database needs the WebUI lint and build. Initialize a new database with `pnpm database:init`; use the exact `pnpm database:update` command only when an existing database has a new structural change.

Use current implementations as working references:

- Runtime: `plugins/runtime/cloudflare`, `plugins/runtime/vercel`, `plugins/runtime/netlify`;
- rules storage: `plugins/repository/postgres`, `plugins/repository/d1`;
- analytics storage: `plugins/store/postgres`, `plugins/store/d1`.

These commands check source and build output only. Database updates and external deployment still require their own confirmed targets.
