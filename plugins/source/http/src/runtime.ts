import {
  validateDataConfig,
  validateRedirectsConfig,
  type DataConfig,
  type RedirectsConfig,
  type RuntimeDataSnapshot,
} from "@nami/config"
import type {
  PluginLogger,
  RuntimeCache,
  RuntimeDataSource,
} from "@nami/plugin-api"

import type { HttpSnapshotSourceBootstrapConfig } from "./config"
import { httpSnapshotSourceManifest } from "./manifest"

interface MemoryCacheEntry {
  etag?: string
  expiresAt: number
  snapshot: RuntimeDataSnapshot
}

export interface HttpSnapshotSourceServices {
  cache?: RuntimeCache
  fetchImpl: typeof fetch
  fetchInit?: RequestInit
  logger: PluginLogger
  now(): number
  setCurrentDataConfig(config: DataConfig): void
  validateDataConfig?(config: DataConfig): void
  waitUntil?(promise: Promise<unknown>): void
}

const memoryCache = new Map<string, MemoryCacheEntry>()
const inFlightLoads = new Map<string, Promise<RuntimeDataSnapshot | null>>()
const remoteRetryAfter = new Map<string, number>()
const platformCacheWrites = new Map<string, Promise<void>>()

export function createHttpSnapshotDataSource(
  config: HttpSnapshotSourceBootstrapConfig,
  services: HttpSnapshotSourceServices,
): RuntimeDataSource<DataConfig, RedirectsConfig> {
  return {
    async loadConfig() {
      const snapshot = await loadSnapshot(config, services)
      if (!snapshot) {
        return null
      }
      services.setCurrentDataConfig(snapshot.config)
      return snapshot.config
    },
    async loadRules() {
      const snapshot = await loadSnapshot(config, services)
      return snapshot?.redirects ?? null
    },
  }
}

export const httpSnapshotSourcePlugin = {
  manifest: httpSnapshotSourceManifest,
  create: createHttpSnapshotDataSource,
}

async function loadSnapshot(
  config: HttpSnapshotSourceBootstrapConfig,
  services: HttpSnapshotSourceServices,
): Promise<RuntimeDataSnapshot | null> {
  const cached = memoryCache.get(config.snapshotUrl)
  if (cached && cached.expiresAt > services.now()) {
    return validateCachedSnapshot(cached.snapshot, services)
  }

  if ((remoteRetryAfter.get(config.snapshotUrl) ?? 0) > services.now()) {
    return cached
      ? validateCachedSnapshot(cached.snapshot, services)
      : null
  }

  const inFlight = inFlightLoads.get(config.snapshotUrl)
  if (inFlight) {
    const snapshot = await inFlight
    return snapshot ? validateCachedSnapshot(snapshot, services) : null
  }

  const load = loadFreshSnapshot(config, services)
  inFlightLoads.set(config.snapshotUrl, load)

  try {
    const snapshot = await load
    return snapshot ? validateCachedSnapshot(snapshot, services) : null
  } finally {
    if (inFlightLoads.get(config.snapshotUrl) === load) {
      inFlightLoads.delete(config.snapshotUrl)
    }
  }
}

async function loadFreshSnapshot(
  config: HttpSnapshotSourceBootstrapConfig,
  services: HttpSnapshotSourceServices,
): Promise<RuntimeDataSnapshot | null> {
  const cached = memoryCache.get(config.snapshotUrl)
  const platformCached = cached
    ? null
    : await readPlatformCache(config, services)
  if (platformCached) {
    return platformCached
  }

  for (let attempt = 1; attempt <= config.maximumFetchAttempts; attempt += 1) {
    try {
      const response = await fetchSnapshot(config, services, cached?.etag)

      if (response.status === 304 && cached) {
        cached.expiresAt = services.now() + getSnapshotTtlMs(cached.snapshot)
        remoteRetryAfter.delete(config.snapshotUrl)
        return cached.snapshot
      }

      if (response.ok) {
        const text = await response.text()
        const snapshot = parseRuntimeSnapshot(text, services)
        if (snapshot) {
          const etag = response.headers.get("etag") ?? undefined
          memoryCache.set(config.snapshotUrl, {
            snapshot,
            expiresAt: services.now() + getSnapshotTtlMs(snapshot),
            ...(etag ? { etag } : {}),
          })
          writePlatformCache(config, services, text, snapshot, etag)
          remoteRetryAfter.delete(config.snapshotUrl)
          return snapshot
        }
        break
      }

      const status = response.status
      await discardResponse(response)
      services.logger.error("Failed to fetch Runtime data snapshot", { status })
      if (!isTransientStatus(status) || attempt === config.maximumFetchAttempts) {
        break
      }
    } catch (error) {
      services.logger.error("Failed to load Runtime data snapshot", {
        error: error instanceof Error ? error.message : String(error),
      })
      if (
        services.fetchInit?.signal?.aborted
        || attempt === config.maximumFetchAttempts
      ) {
        break
      }
    }
  }

  remoteRetryAfter.set(
    config.snapshotUrl,
    services.now() + config.failureBackoffSeconds * 1000,
  )
  return cached?.snapshot ?? null
}

async function readPlatformCache(
  config: HttpSnapshotSourceBootstrapConfig,
  services: HttpSnapshotSourceServices,
): Promise<RuntimeDataSnapshot | null> {
  if (!services.cache) {
    return null
  }

  try {
    const response = await services.cache.match(new Request(config.snapshotUrl))
    if (!response) {
      return null
    }

    const text = await response.text()
    const snapshot = parseRuntimeSnapshot(text, services)
    if (!snapshot) {
      return null
    }

    const etag = response.headers.get("etag") ?? undefined
    memoryCache.set(config.snapshotUrl, {
      snapshot,
      expiresAt: services.now() + getSnapshotTtlMs(snapshot),
      ...(etag ? { etag } : {}),
    })
    return snapshot
  } catch (error) {
    services.logger.error("Failed to read Runtime data snapshot cache", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function writePlatformCache(
  config: HttpSnapshotSourceBootstrapConfig,
  services: HttpSnapshotSourceServices,
  text: string,
  snapshot: RuntimeDataSnapshot,
  etag: string | undefined,
): void {
  if (!services.cache) {
    return
  }

  const ttlSeconds = Math.max(1, Math.floor(getSnapshotTtlMs(snapshot) / 1000))
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
  })
  if (etag) {
    headers.set("ETag", etag)
  }
  const response = new Response(text, { headers })
  const previousWrite = platformCacheWrites.get(config.snapshotUrl)
  const task = (previousWrite ?? Promise.resolve())
    .then(() => services.cache?.put(
      new Request(config.snapshotUrl),
      response,
    ))
    .then(() => undefined)
    .catch((error: unknown) => {
      services.logger.error("Failed to write Runtime data snapshot cache", {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  platformCacheWrites.set(config.snapshotUrl, task)
  void task.finally(() => {
    if (platformCacheWrites.get(config.snapshotUrl) === task) {
      platformCacheWrites.delete(config.snapshotUrl)
    }
  })

  if (services.waitUntil) {
    try {
      services.waitUntil(task)
      return
    } catch (error) {
      services.logger.error("Failed to schedule Runtime data snapshot cache write", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  void task
}

function parseRuntimeSnapshot(
  text: string,
  services: HttpSnapshotSourceServices,
): RuntimeDataSnapshot | null {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    services.logger.error("Failed to parse Runtime data snapshot", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }

  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !("schemaVersion" in value)
    || value.schemaVersion !== 1
    || !("revision" in value)
    || typeof value.revision !== "string"
    || !value.revision
    || !("config" in value)
    || !("redirects" in value)
  ) {
    services.logger.error("Invalid Runtime data snapshot envelope")
    return null
  }

  const configResult = validateDataConfig(value.config)
  const redirectsResult = validateRedirectsConfig(value.redirects)
  if (configResult.status !== "valid" || redirectsResult.status !== "valid") {
    services.logger.error("Invalid Runtime data snapshot content", {
      configIssues: configResult.status === "valid"
        ? ""
        : summarizeIssues(configResult.issues),
      redirectsIssues: redirectsResult.status === "valid"
        ? ""
        : summarizeIssues(redirectsResult.issues),
    })
    return null
  }

  try {
    services.validateDataConfig?.(configResult.config)
  } catch (error) {
    services.logger.error("Runtime data snapshot failed host validation", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }

  return {
    schemaVersion: 1,
    revision: value.revision,
    config: configResult.config,
    redirects: redirectsResult.config,
  }
}

function validateCachedSnapshot(
  snapshot: RuntimeDataSnapshot,
  services: HttpSnapshotSourceServices,
): RuntimeDataSnapshot | null {
  try {
    services.validateDataConfig?.(snapshot.config)
    return snapshot
  } catch (error) {
    services.logger.error("Cached Runtime data snapshot failed host validation", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function fetchSnapshot(
  config: HttpSnapshotSourceBootstrapConfig,
  services: HttpSnapshotSourceServices,
  etag: string | undefined,
): Promise<Response> {
  const controller = new AbortController()
  const externalSignal = services.fetchInit?.signal
  const abortFromExternal = () => controller.abort(externalSignal?.reason)
  if (externalSignal?.aborted) {
    abortFromExternal()
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true })
  }
  const timeout = setTimeout(
    () => controller.abort(new Error("Runtime data snapshot request timed out")),
    config.requestTimeoutMs,
  )
  const headers = new Headers(services.fetchInit?.headers)
  headers.set("Accept", "application/json")
  if (etag) {
    headers.set("If-None-Match", etag)
  }

  try {
    return await services.fetchImpl(config.snapshotUrl, {
      ...services.fetchInit,
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener("abort", abortFromExternal)
  }
}

function getSnapshotTtlMs(snapshot: RuntimeDataSnapshot): number {
  const ttlSeconds = Math.min(
    snapshot.config.runtime.configCacheTtlSeconds,
    snapshot.config.runtime.redirectsCacheTtlSeconds,
  )
  return Math.max(1, ttlSeconds) * 1000
}

function isTransientStatus(status: number): boolean {
  return status === 408
    || status === 425
    || status === 429
    || status >= 500
}

function summarizeIssues(
  issues: readonly { path: string; message: string }[],
): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ")
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
  }
}
