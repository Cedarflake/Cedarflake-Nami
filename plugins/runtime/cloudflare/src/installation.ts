import { defineRuntimePlatformInstallation } from "@nami/runtime-build/config"

import { cloudflareRuntimeManifest } from "./manifest"

export const cloudflareRuntimeInstallation = defineRuntimePlatformInstallation({
  key: "cloudflare",
  manifest: cloudflareRuntimeManifest,
  runtimeModule: "@nami/plugin-runtime-cloudflare/runtime",
  bundlePackages: ["@nami/plugin-runtime-cloudflare"],
  outputEntry: "platforms/cloudflare",
})
