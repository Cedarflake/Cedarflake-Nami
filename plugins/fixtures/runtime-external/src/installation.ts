import { defineRuntimePlatformInstallation } from "@i0c/plugin-sdk/runtime"

import { externalRuntimeManifest } from "./manifest"

export const externalRuntimeInstallation = defineRuntimePlatformInstallation({
  key: "external",
  manifest: externalRuntimeManifest,
  runtimeModule: "@i0c/runtime-fixture-external/runtime",
  bundlePackages: ["@i0c/runtime-fixture-external"],
  outputEntry: "platforms/external",
})
