# Plugin API

`@nami/plugin-api` defines the stable compile-time protocol shared by nami hosts and plugins.

It owns plugin manifests, host and slot declarations, capabilities, configuration metadata, secret requirements, initialization services, health checks, migration contracts, and the typed extension boundaries used by Runtime and WebUI.

The package contains no provider SDK, database driver, React component, or dynamic plugin loader. Plugins are explicit workspace or package dependencies selected by a host at build time.

Plugin configuration schemas use a deliberately small, validated JSON Schema subset: `type`, `properties`, `required`, boolean `additionalProperties`, `items`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `pattern`, `uniqueItems`, and the `uri` format. Unsupported keywords, types, invalid regular expressions, and non-JSON literals are rejected when the manifest is registered.

---

English · [简体中文](README.zh-CN.md)
