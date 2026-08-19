import {
  validateDataConfig,
  validateRedirectsConfig,
  type DataConfig,
  type RedirectsConfig,
} from "@nami/config"
import type {
  PluginLogger,
  RuntimeCache,
  RuntimeDataSource,
} from "@nami/plugin-api"

import type { GitHubRawSourceBootstrapConfig } from "./config"
import { githubRawSourceManifest } from "./manifest"

interface MemoryCacheEntry<T> {
  etag?: string
  expiresAt: number
  value: T
}

interface RemoteLoadOptions<T> {
  cache?: RuntimeCache
  fetchImpl: typeof fetch
  fetchInit?: RequestInit
  failureBackoffSeconds: number
  getTtlSeconds(value: T): number
  inFlightLoads: Map<string, Promise<T | null>>
  label: string
  logger: PluginLogger
  memoryCache: Map<string, MemoryCacheEntry<T>>
  now(): number
  parse(text: string): T | null
  url: string
  waitUntil?(promise: Promise<unknown>): void
}

export interface GitHubRawSourceServices {
  cache?: RuntimeCache
  fetchImpl: typeof fetch
  fetchInit?: RequestInit
  getCurrentDataConfig(): DataConfig
  logger: PluginLogger
  now(): number
  setCurrentDataConfig(config: DataConfig): void
  validateDataConfig?(config: DataConfig): void
  waitUntil?(promise: Promise<unknown>): void
}

const dataConfigMemoryCache = new Map<string, MemoryCacheEntry<DataConfig>>()
const redirectsMemoryCache = new Map<string, MemoryCacheEntry<RedirectsConfig>>()
const dataConfigInFlightLoads = new Map<string, Promise<DataConfig | null>>()
const redirectsInFlightLoads = new Map<string, Promise<RedirectsConfig | null>>()
const remoteRetryAfter = new Map<string, number>()
const platformCacheWrites = new Map<string, Promise<void>>()

export function createGitHubRawDataSource(
  config: GitHubRawSourceBootstrapConfig,
  services: GitHubRawSourceServices,
): RuntimeDataSource<DataConfig, RedirectsConfig> {
  return {
    async loadConfig() {
      if (!config.dataConfigUrl) {
        return null
      }

      const value = await loadRemoteJson({
        cache: services.cache,
        fetchImpl: services.fetchImpl,
        fetchInit: services.fetchInit,
        failureBackoffSeconds: config.configFailureBackoffSeconds,
        getTtlSeconds: (dataConfig) =>
          dataConfig.runtime.configCacheTtlSeconds || config.dataConfigCacheTtlSeconds,
        inFlightLoads: dataConfigInFlightLoads,
        label: "data config",
        logger: services.logger,
        memoryCache: dataConfigMemoryCache,
        now: services.now,
        parse: (text) => parseDataConfig(
          text,
          services.logger,
          services.validateDataConfig,
        ),
        url: config.dataConfigUrl,
        waitUntil: services.waitUntil,
      })

      if (value) {
        services.setCurrentDataConfig(value)
      }

      return value
    },
    loadRules() {
      return loadRemoteJson({
        cache: services.cache,
        fetchImpl: services.fetchImpl,
        fetchInit: services.fetchInit,
        failureBackoffSeconds: config.redirectsFailureBackoffSeconds,
        getTtlSeconds: () =>
          services.getCurrentDataConfig().runtime.redirectsCacheTtlSeconds ||
          config.redirectsCacheTtlSeconds,
        inFlightLoads: redirectsInFlightLoads,
        label: "redirect config",
        logger: services.logger,
        memoryCache: redirectsMemoryCache,
        now: services.now,
        parse: (text) => parseRedirectsConfig(text, services.logger),
        url: config.redirectsConfigUrl,
        waitUntil: services.waitUntil,
      })
    },
  }
}

export const githubRawSourcePlugin = {
  manifest: githubRawSourceManifest,
  create: createGitHubRawDataSource,
}

async function loadRemoteJson<T>(options: RemoteLoadOptions<T>): Promise<T | null> {
  const memo = options.memoryCache.get(options.url)
  if (memo && memo.expiresAt > options.now()) {
    return memo.value
  }

  const retryKey = `${options.label}:${options.url}`
  if ((remoteRetryAfter.get(retryKey) ?? 0) > options.now()) {
    return memo?.value ?? null
  }

  const inFlight = options.inFlightLoads.get(options.url)
  if (inFlight) {
    return inFlight
  }

  const load = loadRemoteJsonFresh(options)
  options.inFlightLoads.set(options.url, load)

  try {
    return await load
  } finally {
    if (options.inFlightLoads.get(options.url) === load) {
      options.inFlightLoads.delete(options.url)
    }
  }
}

async function loadRemoteJsonFresh<T>(
  options: RemoteLoadOptions<T>,
): Promise<T | null> {
  const cached = options.memoryCache.get(options.url)

  if (options.cache) {
    const cacheValue = await readPlatformCache(options)
    if (cacheValue) {
      return cacheValue
    }
  }

  try {
    const response = await options.fetchImpl(
      options.url,
      withConditionalEtag(options.fetchInit, cached?.etag),
    )

    if (response.status === 304 && cached) {
      cached.expiresAt = options.now() + options.getTtlSeconds(cached.value) * 1000
      remoteRetryAfter.delete(`${options.label}:${options.url}`)
      return cached.value
    }

    if (response.ok) {
      const text = await response.text()
      const parsed = options.parse(text)

      if (parsed) {
        const ttlSeconds = options.getTtlSeconds(parsed)
        const etag = response.headers.get("etag") ?? undefined

        options.memoryCache.set(options.url, {
          value: parsed,
          expiresAt: options.now() + ttlSeconds * 1000,
          ...(etag ? { etag } : {}),
        })
        writePlatformCache(options, text, ttlSeconds)
        remoteRetryAfter.delete(`${options.label}:${options.url}`)
        return parsed
      }
    } else {
      await discardResponse(response)
      options.logger.error(`Failed to fetch ${options.label}`, {
        status: response.status,
      })
    }
  } catch (error) {
    options.logger.error(`Failed to load ${options.label}`, {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  remoteRetryAfter.set(
    `${options.label}:${options.url}`,
    options.now() + options.failureBackoffSeconds * 1000,
  )
  return cached?.value ?? null
}

async function readPlatformCache<T>(
  options: RemoteLoadOptions<T>,
): Promise<T | null> {
  if (!options.cache) {
    return null
  }

  try {
    const cached = await options.cache.match(new Request(options.url))
    if (!cached) {
      return null
    }

    const text = await cached.text()
    const parsed = options.parse(text)
    if (!parsed) {
      return null
    }

    options.memoryCache.set(options.url, {
      value: parsed,
      expiresAt: options.now() + options.getTtlSeconds(parsed) * 1000,
    })
    return parsed
  } catch (error) {
    options.logger.error(`Failed to read ${options.label} cache`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function writePlatformCache<T>(
  options: RemoteLoadOptions<T>,
  text: string,
  ttlSeconds: number,
): void {
  if (!options.cache) {
    return
  }

  const cache = options.cache
  const response = new Response(text, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
    },
  })

  const previousWrite = platformCacheWrites.get(options.url)
  const task = (previousWrite ?? Promise.resolve())
    .then(() => cache.put(new Request(options.url), response))
    .catch((error: unknown) => {
        options.logger.error(`Failed to write ${options.label} cache`, {
          error: error instanceof Error ? error.message : String(error),
        })
    })
  platformCacheWrites.set(options.url, task)
  void task.finally(() => {
    if (platformCacheWrites.get(options.url) === task) {
      platformCacheWrites.delete(options.url)
    }
  })

  try {
    if (options.waitUntil) {
      try {
        options.waitUntil(task)
      } catch (error) {
        options.logger.error(`Failed to schedule ${options.label} cache write`, {
          error: error instanceof Error ? error.message : String(error),
        })
        void task
      }
      return
    }

    void task
  } catch (error) {
    options.logger.error(`Failed to schedule ${options.label} cache write`, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function parseDataConfig(
  text: string,
  logger: PluginLogger,
  validateConfig?: (config: DataConfig) => void,
): DataConfig | null {
  const value = parseJson(text, "data config", logger)
  const result = validateDataConfig(value)

  if (result.status === "valid") {
    try {
      validateConfig?.(result.config)
    } catch (error) {
      logger.error("Invalid data config", {
        issues: error instanceof Error ? error.message : String(error),
      })
      return null
    }
    return result.config
  }

  logger.error("Invalid data config", {
    issues: result.issues
      .slice(0, 5)
      .map((item) => `${item.path}: ${item.message}`)
      .join("; "),
  })
  return null
}

function parseRedirectsConfig(
  text: string,
  logger: PluginLogger,
): RedirectsConfig | null {
  const value = parseJson(text, "redirect config", logger)
  const result = validateRedirectsConfig(value)

  if (result.status === "valid") {
    return result.config
  }

  logger.error("Invalid redirect config", {
    issues: result.issues
      .slice(0, 5)
      .map((item) => `${item.path}: ${item.message}`)
      .join("; "),
  })
  return null
}

function parseJson(text: string, label: string, logger: PluginLogger): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    logger.error(`Failed to parse ${label}`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function withConditionalEtag(
  fetchInit: RequestInit | undefined,
  etag: string | undefined,
): RequestInit | undefined {
  if (!etag) {
    return fetchInit
  }

  const headers = new Headers(fetchInit?.headers)
  headers.set("If-None-Match", etag)
  return {
    ...fetchInit,
    headers,
  }
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
  }
}
