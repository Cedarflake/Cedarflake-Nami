import type {
  RuntimePlatformAdapter,
  RuntimePlatformPlugin,
  RuntimeRequestHandler,
} from "@nami/plugin-api"

import { netlifyRuntimeManifest } from "./manifest"

declare const Netlify: undefined | {
  env?: {
    get(key: string): string | undefined
  }
}

export interface NetlifyContext {
  geo?: {
    country?: {
      code?: string
    }
  }
  waitUntil?(promise: Promise<unknown>): void
}

export type NetlifyHandler = (
  request: Request,
  context: NetlifyContext,
) => Promise<Response> | Response

export interface NetlifyRuntimeServices {
  readEnvironment?(name: string): string | undefined
}

export function createNetlifyAdapter(
  handler: RuntimeRequestHandler,
  services: NetlifyRuntimeServices = {},
): RuntimePlatformAdapter<readonly [Request, NetlifyContext]> {
  return {
    id: "netlify",
    async handle(request, context) {
      const country = context.geo?.country?.code
      const readEnvironment = services.readEnvironment ?? ((name: string) =>
        typeof Netlify !== "undefined" ? Netlify.env?.get(name) : undefined)
      const waitUntil =
        typeof context.waitUntil === "function"
          ? (promise: Promise<unknown>) => context.waitUntil?.(promise)
          : undefined

      return handler(request, {
        ...(country ? { country } : {}),
        provider: "netlify",
        readEnvironment,
        ...(waitUntil ? { waitUntil } : {}),
      })
    },
  }
}

export function createNetlifyEdgeHandler(
  handler: RuntimeRequestHandler,
  services?: NetlifyRuntimeServices,
): NetlifyHandler {
  const adapter = createNetlifyAdapter(handler, services)
  return (request, context) => adapter.handle(request, context)
}

export const netlifyRuntimePlugin = {
  manifest: netlifyRuntimeManifest,
  create: createNetlifyEdgeHandler,
} satisfies RuntimePlatformPlugin<ReturnType<typeof createNetlifyEdgeHandler>>

export const runtimePlatformPlugin = netlifyRuntimePlugin
