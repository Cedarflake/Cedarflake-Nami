import { defineRuntimePlatformInstallation } from "@nami/plugin-sdk/runtime"

import { externalRuntimeManifest } from "./manifest"

export const externalRuntimeInstallation = defineRuntimePlatformInstallation({
  key: "external",
  manifest: externalRuntimeManifest,
  runtimeModule: "@nami/runtime-fixture-external/runtime",
  bundlePackages: ["@nami/runtime-fixture-external"],
  outputEntry: "platforms/external",
})
