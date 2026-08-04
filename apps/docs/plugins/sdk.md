---
title: Plugin SDK
description: Author a new compile-time plugin with the private workspace SDK.
---

# Plugin SDK

`@i0c/plugin-sdk` is the repository-internal authoring layer for compile-time plugins. It reduces repeated manifest, configuration, and installation wiring without turning the host into a dynamic loader.

## Supported plugin kinds

- `runtime-platform`
- `data-source`
- `data-repository`
- `analytics-sink`
- `analytics-store`
- `feature`

## Scaffold a package

From the repository root:

```sh
pnpm plugin:create --kind feature --name request-sampler
```

The generator creates a package in the matching `plugins/<category>/` directory with a manifest, configuration definition, typed implementation skeleton, contract test, and bilingual README.

It deliberately does not activate the plugin. Register the reviewed installation in `i0c.runtime.config.ts`, `i0c.webui.config.ts`, or the owning WebUI extension registry.

For a complete Runtime-platform, data-repository, or analytics-store workflow, see [Write an adapter](/plugins/adapters).

## Authoring contract

Use the SDK to define:

1. a typed manifest with bilingual summary text and capabilities;
2. a configuration Schema, defaults, and resolver;
3. a Runtime or WebUI plugin installation;
4. contract tests for the selected extension slot.

The WebUI reads installed manifest configuration metadata and renders the generic settings editor. A plugin owns its fields and localized descriptions; the WebUI owns the visual controls and persistence flow.

## Boundaries

- The SDK is private to this workspace and exports TypeScript source.
- Plugins are installed before build and bundled with the host.
- Remote instance configuration can configure or disable installed plugins, but cannot install code.
- A new implementation inside an existing slot should not require application-core switches.
- A genuinely new extension concept still requires a new shared protocol and host integration.

## Validate a plugin

```sh
pnpm --filter @i0c/plugin-sdk check
pnpm --filter @i0c/plugin-sdk test
pnpm plugins:check
```

After activating a plugin, also run the check and build for its Runtime or WebUI host.

For complete API examples, see the package-owned [Plugin SDK README](https://github.com/Revaea/i0c.cc/blob/main/packages/plugin-sdk/README.md).
