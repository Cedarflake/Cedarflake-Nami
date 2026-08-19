import { defineRuntimePlatformInstallation } from "@nami/runtime-build/config"

import { vercelRuntimeManifest } from "./manifest"

export const vercelRuntimeInstallation = defineRuntimePlatformInstallation({
  key: "vercel",
  manifest: vercelRuntimeManifest,
  runtimeModule: "@nami/plugin-runtime-vercel/runtime",
  bundlePackages: [
    "@nami/plugin-runtime-vercel",
    "@vercel/functions",
  ],
  outputEntry: "api/index",
})
