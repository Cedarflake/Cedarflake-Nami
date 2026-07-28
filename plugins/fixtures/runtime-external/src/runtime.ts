import type { RuntimeRequestHandler } from "@i0c/plugin-api"
import { defineRuntimePlatformPlugin } from "@i0c/plugin-sdk/runtime"

import { externalRuntimeManifest } from "./manifest"

export type ExternalRuntimeHandler = (request: Request) => Promise<Response>

function createExternalRuntimeHandler(
  handler: RuntimeRequestHandler,
): ExternalRuntimeHandler {
  return (request) => handler(request, {
    provider: externalRuntimeManifest.provider,
    readEnvironment: () => undefined,
  })
}

export const runtimePlatformPlugin = defineRuntimePlatformPlugin({
  manifest: externalRuntimeManifest,
  create: createExternalRuntimeHandler,
})
