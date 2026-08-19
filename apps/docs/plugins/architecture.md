---
title: Plugin architecture
description: How Nami keeps platform, database, and analytics implementations outside the application core.
---

# Plugin architecture

Nami uses a plugin layer to separate platform and storage implementations. The same routing code runs on Cloudflare, Vercel, and Netlify, while rules may live in PostgreSQL, D1, or GitHub. Wiring those implementations directly into the applications would require Runtime changes for every platform and WebUI changes for every database.

The applications now depend on a small set of stable contracts, and each implementation lives in its own workspace package. “Plugin” in this repository means one of those packages assembled at build time. It does not mean an extension downloaded from the WebUI.

## How a plugin enters a build

A plugin package contains a manifest and a factory. The manifest describes the plugin, its capabilities, and its configuration. The factory creates the implementation.

Root installation config decides which factories enter a build. Only then can the WebUI list them under **Installed plugins**. Instance settings may change public options or disable an optional plugin, but a running application cannot download another npm package.

PostgreSQL rule storage is a useful example:

1. `plugins/repository/postgres` implements the rules-storage contract;
2. `nami.webui.config.ts` installs it in the WebUI;
3. startup config selects PostgreSQL;
4. the deployment environment provides `DATABASE_URL`;
5. WebUI code reads and writes through the shared interface without branching on the database in every API route.

D1 follows the same path. Adding another database should not add another group of `if` statements to the core editors.

## What can currently be replaced

The Runtime has extension points for its platform, snapshot source, analytics delivery, and a restricted feature hook. The WebUI has separate storage for rules and analytics, plus a few statically registered UI slots.

Current implementations include:

- Cloudflare, Vercel, and Netlify Runtimes;
- HTTP Snapshot and GitHub Raw sources;
- PostgreSQL, D1, and GitHub Contents rule storage;
- PostgreSQL and D1 analytics storage;
- signed HTTP analytics delivery and the bot classifier.

One database product may serve both rules and analytics, but the code remains in two plugins. Rule storage owns settings, rules, revisions, and a consistent snapshot. Analytics storage owns events, queries, aggregates, and retention. Keeping them apart makes it possible to replace one side without replacing the other.

## What remains in the core

`exact`, `prefix`, status codes, path appending, and basic proxy semantics remain part of routing. Every platform must produce the same result for the same rule, so there is no useful alternative implementation to select.

An extension belongs in the plugin layer when different deployments may choose different implementations. Platforms, databases, and delivery paths vary; the rule language understood by every Runtime does not.

## Why configuration lives in several places

Some choices must exist before an application can read its instance document. The WebUI has to know whether that document is in PostgreSQL or D1; the Runtime has to know where its first snapshot comes from. Those values belong to startup config.

After the instance document is available, the WebUI can edit cache intervals, access lists, and plugin switches. Actual secrets stay with the deployment provider; documents contain binding names such as `NAMI_SECRET` and `DATABASE_URL`.

Each layer therefore owns one job:

- root installation config decides whether code is in the build;
- startup config tells an application where to find its initial data;
- instance config stores non-secret options that may change online.

Putting all three in one remote document creates a loop: the application would need that document to decide where to find the document.

## Packages used while writing a plugin

Most implementations start with `@nami/plugin-sdk`, which provides typed helpers for manifests, configuration, and Runtime or WebUI plugins. `@nami/plugin-testkit` checks that an implementation follows the existing contracts.

`@nami/plugin-api`, `@nami/runtime-host`, and `@nami/runtime-build` sit closer to the host. A normal plugin should not import internal files from `apps/runtime` or `apps/webui`; if that seems necessary, the shared contract probably needs one explicit capability first.

PostgreSQL and D1 each have a small shared database package for connection, transaction, and schema-update code used by more than one plugin. Rule and analytics behavior still stays in the owning plugins.

## What changes when adding an implementation

For an existing extension point, add a package, register its manifest, add its factory to the root installation config, and write contract tests. Then rebuild the affected Runtime or WebUI.

The application core should not learn another plugin ID. A genuinely new kind of extension, rather than another implementation of an existing one, still needs a protocol and host change.

The current scope is source-level modularity within Nami. It does not include a marketplace, runtime package loading, or an untrusted-code sandbox, and there is no plan to publish the SDK and plugins as public packages.

Continue with the [plugin SDK](/plugins/sdk) when you are ready to write code. For a new platform or database, go directly to [write an adapter](/plugins/adapters).
