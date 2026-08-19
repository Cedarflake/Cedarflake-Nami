import type { ExecutionContext } from "@cloudflare/workers-types"
import type {
  RuntimeCache,
  RuntimePlatformAdapter,
  RuntimePlatformPlugin,
  RuntimeRequestHandler,
} from "@nami/plugin-api"

import type { CloudflareRuntimeAdapterOptions } from "./config"
import { cloudflareRuntimeManifest } from "./manifest"

declare const caches: CacheStorage & { default: Cache }

export interface CloudflareRuntimeServices {
  cache?: RuntimeCache
}

export function createCloudflareAdapter(
  handler: RuntimeRequestHandler,
  config: CloudflareRuntimeAdapterOptions = { useDefaultCache: true },
  services: CloudflareRuntimeServices = {},
): RuntimePlatformAdapter<readonly [Request, unknown, ExecutionContext]> {
  return {
    id: "cloudflare",
    async handle(request, env, context) {
      const waitUntil =
        context && typeof context.waitUntil === "function"
          ? (promise: Promise<unknown>) => context.waitUntil(promise)
          : undefined
      const country = (request as Request & { cf?: { country?: string } }).cf?.country
      const cache = services.cache ?? getDefaultCache(config)
      const envBindings = env && typeof env === "object"
        ? env as Record<string, unknown>
        : undefined

      return handler(request, {
        ...(cache ? { cache } : {}),
        ...(country ? { country } : {}),
        ...(envBindings ? { envBindings } : {}),
        provider: "cloudflare",
        ...(envBindings
          ? { readEnvironment: (name: string) => envBindings[name] }
          : {}),
        ...(waitUntil ? { waitUntil } : {}),
      })
    },
  }
}

export function createCloudflareWorker(
  handler: RuntimeRequestHandler,
  config?: CloudflareRuntimeAdapterOptions,
  services?: CloudflareRuntimeServices,
) {
  const adapter = createCloudflareAdapter(handler, config, services)

  return {
    fetch(request: Request, env: unknown, context: ExecutionContext) {
      return adapter.handle(request, env, context)
    },
  }
}

export const cloudflareRuntimePlugin = {
  manifest: cloudflareRuntimeManifest,
  create(handler) {
    return createCloudflareWorker(handler, { useDefaultCache: true })
  },
} satisfies RuntimePlatformPlugin<ReturnType<typeof createCloudflareWorker>>

export const runtimePlatformPlugin = cloudflareRuntimePlugin

function getDefaultCache(config: CloudflareRuntimeAdapterOptions): RuntimeCache | undefined {
  if (!config.useDefaultCache || typeof caches === "undefined") {
    return undefined
  }
  return caches.default
}
