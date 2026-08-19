import { defineRuntimePlatformInstallation } from "@nami/runtime-build/config"

import { netlifyRuntimeManifest } from "./manifest"

export const netlifyRuntimeInstallation = defineRuntimePlatformInstallation({
  key: "netlify",
  manifest: netlifyRuntimeManifest,
  runtimeModule: "@nami/plugin-runtime-netlify/runtime",
  bundlePackages: ["@nami/plugin-runtime-netlify"],
  outputEntry: "platforms/netlify-edge",
})
