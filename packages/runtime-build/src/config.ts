import type { RuntimePlatformManifest } from "@nami/plugin-api"
import {
  arePluginManifestsEquivalent,
  validatePluginManifest,
} from "@nami/plugin-api"

const installationKeyPattern = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/
const outputEntryPattern = /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/
const packageSpecifierSegmentPattern = /^@?[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/

export interface RuntimePlatformInstallation {
  bundlePackages: readonly string[]
  key: string
  manifest: RuntimePlatformManifest
  outputEntry: string
  runtimeModule: string
}

export interface RuntimeInstallationConfig {
  platforms: readonly RuntimePlatformInstallation[]
  reservedPluginIds?: readonly string[]
}

export function defineRuntimePlatformInstallation(
  installation: RuntimePlatformInstallation,
): RuntimePlatformInstallation {
  validateRuntimePlatformInstallation(installation)
  return installation
}

export function defineRuntimeInstallationConfig(
  config: RuntimeInstallationConfig,
): RuntimeInstallationConfig {
  if (!isRecord(config) || !Array.isArray(config.platforms)) {
    throw new TypeError("Runtime installation config must contain a platforms array")
  }
  const keys = new Set<string>()
  const reservedPluginIds = config.reservedPluginIds ?? []
  if (
    !Array.isArray(reservedPluginIds)
    || reservedPluginIds.some((id) => typeof id !== "string")
  ) {
    throw new TypeError("Runtime reserved plugin IDs must be a string array")
  }
  const ids = new Set(reservedPluginIds)
  const providers = new Set<string>()

  if (
    ids.size !== reservedPluginIds.length
    || reservedPluginIds.some((id) => !id.trim())
  ) {
    throw new TypeError("Runtime reserved plugin IDs must be unique and non-empty")
  }

  for (const platform of config.platforms) {
    validateRuntimePlatformInstallation(platform)
    assertUnique(keys, platform.key, "installation key")
    assertUnique(ids, platform.manifest.id, "plugin ID")
    assertUnique(providers, platform.manifest.provider, "provider")
  }

  return config
}

export function parseRuntimeInstallationConfig(
  value: unknown,
): RuntimeInstallationConfig {
  if (!isRecord(value) || !Array.isArray(value.platforms)) {
    throw new TypeError("Runtime installation config must contain a platforms array")
  }
  if (
    value.reservedPluginIds !== undefined
    && (
      !Array.isArray(value.reservedPluginIds)
      || value.reservedPluginIds.some((id) => typeof id !== "string")
    )
  ) {
    throw new TypeError("Runtime reserved plugin IDs must be a string array")
  }
  return defineRuntimeInstallationConfig({
    platforms: value.platforms as RuntimePlatformInstallation[],
    ...(value.reservedPluginIds
      ? { reservedPluginIds: value.reservedPluginIds as string[] }
      : {}),
  })
}

export function resolveRuntimePlatformInstallation(
  config: RuntimeInstallationConfig,
  key: string,
): RuntimePlatformInstallation {
  const installation = config.platforms.find((candidate) => candidate.key === key)
  if (!installation) {
    throw new TypeError(`Runtime platform ${key} is not installed`)
  }
  return installation
}

export function assertRuntimePlatformModuleMatchesInstallation(
  moduleValue: unknown,
  installation: RuntimePlatformInstallation,
): void {
  if (!isRecord(moduleValue)) {
    throw new TypeError("Runtime platform module must export an object")
  }
  const plugin = moduleValue.runtimePlatformPlugin
  if (!isRecord(plugin) || typeof plugin.create !== "function") {
    throw new TypeError(
      "Runtime platform module must export runtimePlatformPlugin with a create function",
    )
  }
  const manifestResult = validatePluginManifest(plugin.manifest)
  if (!manifestResult.valid) {
    throw new TypeError(manifestResult.issues.join("\n"))
  }
  const manifest = plugin.manifest as RuntimePlatformManifest
  if (!arePluginManifestsEquivalent(manifest, installation.manifest)) {
    throw new TypeError(
      "Runtime platform module manifest does not match its installation descriptor",
    )
  }
}

function validateRuntimePlatformInstallation(
  installation: unknown,
): asserts installation is RuntimePlatformInstallation {
  if (!isRecord(installation)) {
    throw new TypeError("Runtime platform installation must be an object")
  }
  const manifestResult = validatePluginManifest(installation.manifest)
  if (!manifestResult.valid) {
    throw new TypeError(manifestResult.issues.join("\n"))
  }
  const manifest = installation.manifest as RuntimePlatformManifest
  if (
    manifest.kind !== "runtime-platform"
    || manifest.slot !== "runtime-platform"
    || !manifest.hosts.includes("runtime")
  ) {
    throw new TypeError(
      "Runtime platform manifest must use the runtime-platform kind, slot, and host",
    )
  }
  if (
    typeof installation.key !== "string"
    || !installationKeyPattern.test(installation.key)
  ) {
    throw new TypeError("Runtime platform installation key is invalid")
  }
  if (
    typeof installation.runtimeModule !== "string"
    || !isSafePackageSpecifier(installation.runtimeModule)
  ) {
    throw new TypeError("Runtime platform module must be an installed package specifier")
  }
  if (typeof installation.outputEntry !== "string") {
    throw new TypeError("Runtime platform output entry must be a safe relative path")
  }
  const outputEntrySegments = installation.outputEntry.split("/")
  if (
    !outputEntryPattern.test(installation.outputEntry)
    || outputEntrySegments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError("Runtime platform output entry must be a safe relative path")
  }
  if (
    !Array.isArray(installation.bundlePackages)
    || installation.bundlePackages.some((name) => !isSafePackageSpecifier(name))
  ) {
    throw new TypeError("Runtime platform bundle packages must use package specifiers")
  }
}

function isSafePackageSpecifier(value: unknown): value is string {
  if (
    typeof value !== "string"
    || !value
    || value !== value.trim()
    || /[\\\s:]/u.test(value)
    || value.startsWith(".")
    || value.startsWith("/")
  ) {
    return false
  }

  const segments = value.split("/")
  if (
    segments.some((segment) => !packageSpecifierSegmentPattern.test(segment))
    || segments.slice(1).some((segment) => segment.startsWith("@"))
  ) {
    return false
  }
  return segments[0]?.startsWith("@") ? segments.length >= 2 : true
}

function assertUnique(values: Set<string>, value: string, label: string): void {
  if (values.has(value)) {
    throw new TypeError(`Runtime platform ${label} ${value} is duplicated`)
  }
  values.add(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
