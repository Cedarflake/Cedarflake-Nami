---
title: Plugin SDK
description: Use the repository SDK to scaffold, implement, register, and check one Runtime feature plugin.
---

# Plugin SDK

The quickest way to start a plugin is the generator at the repository root. This page uses `request-sampler` as an example and follows it from a new package to a Runtime installation.

The generator uses `@nami/plugin-sdk`, which collects the repeated parts of manifests, configuration checks, and host assembly. The plugin still owns its actual behavior and is still built together with the Runtime or WebUI.

For a new platform or database, the manifest and configuration steps here still apply; [write an adapter](/plugins/adapters) covers the specific contracts.

## What the SDK already handles

- typed Manifest helpers for Runtime platforms, data sources, data repositories, analytics sinks, analytics stores, and Runtime Features;
- bilingual plugin descriptions displayed by the WebUI;
- configuration Schema, defaults, and resolved-value validation;
- Runtime and WebUI installation helpers;
- shared Repository and Analytics Store contracts;
- a workspace scaffolder for a consistent package structure.

An ordinary plugin should need only `@nami/plugin-sdk`. `@nami/plugin-api`, `@nami/runtime-host`, and `@nami/runtime-build` sit closer to the host and shared protocol and are not required just to finish a normal implementation.

## 1. Scaffold a package

From the repository root:

```sh
pnpm plugin:create --kind feature --name request-sampler
```

Supported kinds are:

```text
runtime-platform
data-source
data-repository
analytics-sink
analytics-store
feature
```

The generator creates a package in the matching `plugins/<category>/` directory with a Manifest, configuration definition, typed implementation skeleton, contract test, and bilingual package documentation.

It deliberately does not activate the plugin. Installation remains an explicit, reviewable repository change.

## 2. Define the Manifest

This example creates a Runtime Feature that can sample analytics events:

```ts
import {
  defineRuntimeFeatureManifest,
} from "@nami/plugin-sdk"

export const manifest = defineRuntimeFeatureManifest({
  id: "@nami/feature-request-sampler",
  name: "Request sampler",
  version: "0.1.0",
  description: {
    summary: {
      en: "Samples Runtime events before delivery.",
      "zh-CN": "在 Runtime 事件投递前进行采样。",
    },
  },
  capabilities: ["analytics:sampling"],
})
```

The helper supplies the fixed Plugin API version, kind, slot, and host invariants, then validates the completed Manifest immediately.

## 3. Define editable configuration

```ts
import {
  definePluginConfiguration,
} from "@nami/plugin-sdk"

interface RequestSamplerConfig {
  rate: number
}

export const configuration = definePluginConfiguration<RequestSamplerConfig>({
  version: 1,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      rate: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    },
    required: ["rate"],
  },
  defaults: {
    rate: 1,
  },
  resolve(value) {
    return {
      rate: typeof value?.rate === "number" ? value.rate : 1,
    }
  },
})
```

The SDK validates the Schema when the module loads. Defaults and every resolved configuration are checked against the same Schema, so the resolver cannot silently return a value rejected by the Manifest.

Installed Manifest metadata also drives the WebUI's generic settings editor. The plugin owns field definitions and localized descriptions; the WebUI owns controls, validation feedback, and persistence.

## 4. Define a Runtime plugin

```ts
import {
  defineRuntimeFeaturePlugin,
} from "@nami/plugin-sdk/runtime"

import { manifest } from "./manifest"

export const requestSamplerPlugin = defineRuntimeFeaturePlugin({
  manifest,
  create() {
    return {
      id: manifest.id,
      order: 100,
      timeoutMs: 50,
      failurePolicy: "continue",
      hooks: {
        onAnalyticsEvent(event) {
          return event
        },
      },
    }
  },
})
```

Runtime helpers verify that the Manifest belongs to the expected Runtime extension point before the host accepts the installation.

## 5. Define a WebUI plugin

For a WebUI-owned extension such as an Analytics Store:

```ts
import {
  defineWebUiAnalyticsStorePlugin,
} from "@nami/plugin-sdk/webui"

import { manifest } from "./manifest"

export const analyticsStorePlugin = defineWebUiAnalyticsStorePlugin({
  manifest,
  async create(context) {
    const connection = context.readEnvironment("DATABASE_URL")
    return connection ? createStore(connection) : null
  },
})
```

WebUI helpers cover data repositories, analytics stores, and static extension registrations. An implementation returns its contract; the WebUI remains responsible for the surrounding application behavior.

## 6. Register the installation

Choose the registration point that owns the plugin:

- Runtime installations: `nami.runtime.config.ts`;
- Runtime Manifests used by configuration validation: `nami.runtime.manifests.ts`;
- WebUI installations: `nami.webui.config.ts`;
- WebUI Manifests or static extension registrations: the matching WebUI root registry.

Add the plugin package to the root workspace dependencies with pnpm. Do not add a host-core `switch` for another implementation of an existing extension slot.

When creating a new provider identifier rather than another implementation of an existing provider, the Bootstrap selection model also needs to recognize that identifier.

## 7. Validate the plugin

```sh
pnpm --filter @nami/plugin-sdk check
pnpm --filter @nami/plugin-sdk test
pnpm plugins:check
```

After activating a plugin, also run the owning host check and build. A Runtime plugin requires the applicable Runtime build; a WebUI plugin requires WebUI lint and build.

## Adapter-specific contracts

- A Runtime Platform adapts its provider entrypoint to `RuntimeRequestHandler`.
- A Data Repository implements `NamiDataRepository` for versioned configuration and redirect documents.
- An Analytics Store implements `NamiAnalyticsStore` for ingestion, queries, aggregate rebuilds, and retention.
- A database-backed adapter can expose `PluginSchemaMigrationProvider` for first-time initialization and later Schema updates.

Continue with [write an adapter](/plugins/adapters) for the registration flow and current reference implementations.

## SDK scope

Remote instance configuration can only configure or disable installed code. Another implementation in an existing slot should not add dispatch logic to the application core; a new slot still requires shared-protocol and host changes.

The SDK serves this workspace only. It does not provide public-package releases, independent compatibility guarantees, or third-party ecosystem support.
