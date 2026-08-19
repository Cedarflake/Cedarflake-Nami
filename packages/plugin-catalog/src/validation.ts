import type {
  PluginConfigurationDeclaration,
  PluginManifest,
  PluginRegistryIssue,
} from "@nami/plugin-api"
import {
  arePluginManifestsEquivalent,
  StaticPluginRegistry,
  validatePluginManifest,
} from "@nami/plugin-api"

import { installedPluginManifests } from "./catalog"

export interface RuntimeRequiredPluginOptions {
  dataSourcePluginId: string
  runtimePlatformManifests: readonly PluginManifest[]
}

export function validateInstalledPluginDeclarations(
  declarations: Readonly<Record<string, PluginConfigurationDeclaration>>,
  additionalManifests: readonly PluginManifest[] = [],
): readonly PluginRegistryIssue[] {
  const issues: PluginRegistryIssue[] = []
  const validBaseManifests = collectValidManifests(installedPluginManifests, issues)
  const validAdditionalManifests = collectValidManifests(additionalManifests, issues)
  if (issues.length > 0) {
    return issues
  }
  const manifests = mergeManifests(
    validBaseManifests,
    validAdditionalManifests,
    issues,
  )
  const registry = new StaticPluginRegistry(manifests)
  const runtimePlatformPluginIds = manifests
    .filter((manifest) => manifest.kind === "runtime-platform")
    .map((manifest) => manifest.id)

  for (const selectedPlatformId of runtimePlatformPluginIds) {
    const runtimeDeclarations = { ...declarations }
    for (const platformId of runtimePlatformPluginIds) {
      if (platformId !== selectedPlatformId) {
        delete runtimeDeclarations[platformId]
      }
    }
    collectIssues(registry, "runtime", runtimeDeclarations, issues)
  }
  collectIssues(registry, "collector", declarations, issues)
  collectIssues(registry, "webui", declarations, issues)

  return issues.filter((issue, index, allIssues) =>
    allIssues.findIndex((candidate) =>
      candidate.path === issue.path && candidate.message === issue.message,
    ) === index,
  )
}

function collectValidManifests(
  manifests: readonly PluginManifest[],
  issues: PluginRegistryIssue[],
): readonly PluginManifest[] {
  return manifests.filter((manifest, index) => {
    const result = validatePluginManifest(manifest)
    if (result.valid) {
      return true
    }

    const manifestId = manifest !== null
      && typeof manifest === "object"
      && "id" in manifest
      && typeof manifest.id === "string"
      ? manifest.id
      : `invalid-${index}`
    issues.push(...result.issues.map((message) => ({
      path: `/manifests/${escapeJsonPointer(manifestId)}`,
      message,
    })))
    return false
  })
}

export function validateRuntimeRequiredPluginDeclarations(
  declarations: Readonly<Record<string, PluginConfigurationDeclaration>>,
  options: RuntimeRequiredPluginOptions,
): readonly PluginRegistryIssue[] {
  const requiredPluginIds = [
    options.dataSourcePluginId,
    ...options.runtimePlatformManifests.map((manifest) => manifest.id),
  ]

  return requiredPluginIds.flatMap((pluginId) =>
    declarations[pluginId]?.enabled === false
      ? [{
          path: `/plugins/${escapeJsonPointer(pluginId)}/enabled`,
          message: "must be enabled for the installed Runtime deployment",
        }]
      : [],
  )
}

export function validateWebUiRequiredPluginDeclarations(
  declarations: Readonly<Record<string, PluginConfigurationDeclaration>>,
  dataRepositoryPluginId: string,
): readonly PluginRegistryIssue[] {
  return declarations[dataRepositoryPluginId]?.enabled === false
    ? [{
        path: `/plugins/${escapeJsonPointer(dataRepositoryPluginId)}/enabled`,
        message: "must be enabled for the WebUI data repository",
      }]
    : []
}

function collectIssues(
  registry: StaticPluginRegistry,
  host: "collector" | "runtime" | "webui",
  declarations: Readonly<Record<string, PluginConfigurationDeclaration>>,
  issues: PluginRegistryIssue[],
): void {
  const result = registry.resolve(host, declarations)
  if (result.status === "invalid") {
    issues.push(...result.issues)
  }
}

function mergeManifests(
  baseManifests: readonly PluginManifest[],
  additionalManifests: readonly PluginManifest[],
  issues: PluginRegistryIssue[],
): readonly PluginManifest[] {
  const manifests = new Map(baseManifests.map((manifest) => [manifest.id, manifest]))
  for (const manifest of additionalManifests) {
    const existing = manifests.get(manifest.id)
    if (existing) {
      if (!arePluginManifestsEquivalent(existing, manifest)) {
        issues.push({
          path: `/manifests/${manifest.id.replaceAll("/", "~1")}`,
          message: "plugin ID conflicts with an installed manifest",
        })
      }
      continue
    }
    manifests.set(manifest.id, manifest)
  }
  return [...manifests.values()]
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1")
}
