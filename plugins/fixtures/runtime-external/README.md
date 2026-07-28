# External Runtime plugin fixture

This private package simulates independently authored Runtime platform and feature plugins. It uses `@i0c/plugin-sdk` for manifests, plugin definitions, and installation descriptors, then proves that `apps/runtime` can build both categories from a build-time installation config without plugin-specific host source changes.

It is a test fixture under the plugin subsystem, not a deployable supported platform. The package uses the repository Apache-2.0 license.
