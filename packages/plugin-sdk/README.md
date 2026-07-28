# Plugin SDK

`@i0c/plugin-sdk` is the internal authoring SDK for i0c.cc compile-time plugins. It reduces repeated manifest, configuration, installation, and host-wiring code while preserving explicit build-time composition.

The SDK is private to this workspace. It is not a dynamic loader, package marketplace, or compatibility promise for arbitrary third-party binaries. A plugin remains a normal workspace dependency that is selected in the relevant Runtime or WebUI installation configuration and bundled during the build.

## What it provides

- Typed manifest helpers for data sources, data repositories, analytics sinks, analytics stores, Runtime features, and Runtime platforms
- Bilingual plugin descriptions required by the WebUI
- Configuration Schema, defaults, and resolved-value validation
- Runtime plugin and platform authoring helpers
- WebUI repository, analytics store, and extension authoring helpers
- Shared repository and analytics store contracts for plugin authors
- A workspace scaffolder for creating a consistent plugin package

The lower-level protocol remains in `@i0c/plugin-api`. Host behavior remains in `@i0c/runtime-host`, `@i0c/runtime-build`, and the WebUI. Use this SDK when authoring a plugin; use the lower-level packages when implementing or maintaining host infrastructure.

## Create a plugin

From the repository root:

```bash
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

The command creates a package under the matching `plugins/<category>/` directory. It does not activate the plugin automatically. Add the generated plugin to `i0c.runtime.config.ts`, `i0c.webui.config.ts`, or the relevant WebUI extension registry so deployment choices remain explicit and reviewable.

## Define a manifest

```ts
import {
  defineRuntimeFeatureManifest,
} from "@i0c/plugin-sdk"

export const manifest = defineRuntimeFeatureManifest({
  id: "@i0c/feature-request-sampler",
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

The helper supplies the Plugin API version, kind, slot, and host invariants, then validates the completed manifest immediately.

## Define configuration

```ts
import {
  definePluginConfiguration,
} from "@i0c/plugin-sdk"

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

The Schema is validated when the module loads. Defaults and every resolved configuration are checked against the same Schema, preventing an authoring helper from returning a value the manifest rejects.

## Define a Runtime plugin

```ts
import {
  defineRuntimeFeaturePlugin,
} from "@i0c/plugin-sdk/runtime"

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

Runtime platform, data-source, analytics-sink, and feature helpers verify that the manifest belongs to the expected Runtime extension point before the host accepts it.

## Define a WebUI plugin

```ts
import {
  defineWebUiAnalyticsStorePlugin,
} from "@i0c/plugin-sdk/webui"

import { manifest } from "./manifest"

export const analyticsStorePlugin = defineWebUiAnalyticsStorePlugin({
  manifest,
  async create(context) {
    const connection = context.readEnvironment("DATABASE_URL")
    return connection ? createStore(connection) : null
  },
})
```

WebUI helpers cover data repositories, analytics stores, and static extension registrations. Plugins provide their contracts and configuration metadata; the WebUI remains responsible for rendering and editing the generic configuration surface.

## Validate changes

Run the SDK checks from the repository root:

```bash
pnpm --filter @i0c/plugin-sdk check
pnpm --filter @i0c/plugin-sdk test
pnpm plugins:check
```

Host-specific checks are still required after activating a plugin in Runtime or WebUI.
