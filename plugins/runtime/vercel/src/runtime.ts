import { waitUntil as vercelWaitUntil } from "@vercel/functions"
import type {
  RuntimePlatformAdapter,
  RuntimePlatformPlugin,
  RuntimeRequestHandler,
} from "@nami/plugin-api"

import { vercelRuntimeManifest } from "./manifest"

declare const process: undefined | { env?: Record<string, string | undefined> }

export interface VercelRuntimeServices {
  readEnvironment?(name: string): string | undefined
  waitUntil?(promise: Promise<unknown>): void
}

export function createVercelAdapter(
  handler: RuntimeRequestHandler,
  services: VercelRuntimeServices = {},
): RuntimePlatformAdapter<readonly [Request]> {
  return {
    id: "vercel",
    async handle(request) {
      const country = request.headers.get("x-vercel-ip-country") ?? undefined
      const readEnvironment = services.readEnvironment ?? ((name: string) =>
        typeof process !== "undefined" ? process.env?.[name] : undefined)
      const waitUntil = services.waitUntil ?? ((promise: Promise<unknown>) => {
        vercelWaitUntil(promise)
      })

      return handler(request, {
        ...(country ? { country } : {}),
        provider: "vercel",
        readEnvironment,
        waitUntil,
      })
    },
  }
}

export function createVercelEdgeHandler(
  handler: RuntimeRequestHandler,
  services?: VercelRuntimeServices,
) {
  const adapter = createVercelAdapter(handler, services)
  return (request: Request) => adapter.handle(request)
}

export const vercelRuntimePlugin = {
  manifest: vercelRuntimeManifest,
  create: createVercelEdgeHandler,
} satisfies RuntimePlatformPlugin<ReturnType<typeof createVercelEdgeHandler>>

export const runtimePlatformPlugin = vercelRuntimePlugin
