import type {
  RuntimePlatformContext,
  RuntimePlatformManifest,
  RuntimePlatformPlugin,
} from "@nami/plugin-api"
import {
  arePluginManifestsEquivalent,
  validatePluginManifest,
} from "@nami/plugin-api"

export interface RuntimeHostContext extends RuntimePlatformContext {
  platformPluginId: string
  runtimePlatformManifests: readonly RuntimePlatformManifest[]
}

export interface RuntimeHostRequestHandler {
  (request: Request, context: RuntimeHostContext): Promise<Response>
}

export interface RuntimeDeploymentOptions<TDeployment> {
  handler: RuntimeHostRequestHandler
  installedPlatformManifests: readonly RuntimePlatformManifest[]
  platform: RuntimePlatformPlugin<TDeployment>
  selectedPlatformManifest: RuntimePlatformManifest
}

export function createRuntimeDeployment<TDeployment>(
  options: RuntimeDeploymentOptions<TDeployment>,
): TDeployment {
  assertRuntimePlatformManifest(options.platform.manifest, "Runtime platform module")
  assertRuntimePlatformManifest(
    options.selectedPlatformManifest,
    "Runtime platform installation descriptor",
  )
  for (const manifest of options.installedPlatformManifests) {
    assertRuntimePlatformManifest(manifest, "Installed Runtime platform")
  }
  if (
    !arePluginManifestsEquivalent(
      options.platform.manifest,
      options.selectedPlatformManifest,
    )
  ) {
    throw new TypeError(
      "Runtime platform module manifest does not match its installation descriptor",
    )
  }
  const installedPlatformManifests = collectInstalledManifests(
    options.installedPlatformManifests,
    options.selectedPlatformManifest,
  )

  return options.platform.create((request, context) =>
    options.handler(request, {
      ...context,
      platformPluginId: options.selectedPlatformManifest.id,
      provider: options.selectedPlatformManifest.provider,
      runtimePlatformManifests: installedPlatformManifests,
    }))
}

function assertRuntimePlatformManifest(
  manifest: unknown,
  label: string,
): asserts manifest is RuntimePlatformManifest {
  const result = validatePluginManifest(manifest)
  if (!result.valid) {
    throw new TypeError(`${label} manifest is invalid: ${result.issues.join("; ")}`)
  }
  const platformManifest = manifest as RuntimePlatformManifest
  if (
    platformManifest.kind !== "runtime-platform"
    || platformManifest.slot !== "runtime-platform"
    || !platformManifest.hosts.includes("runtime")
  ) {
    throw new TypeError(
      `${label} manifest must use the runtime-platform kind, slot, and host`,
    )
  }
}

function collectInstalledManifests(
  manifests: readonly RuntimePlatformManifest[],
  selected: RuntimePlatformManifest,
): readonly RuntimePlatformManifest[] {
  const byId = new Map<string, RuntimePlatformManifest>()
  for (const manifest of [...manifests, selected]) {
    const existing = byId.get(manifest.id)
    if (existing && !arePluginManifestsEquivalent(existing, manifest)) {
      throw new TypeError(
        `Runtime platform manifest ${manifest.id} conflicts with another installation`,
      )
    }
    byId.set(manifest.id, manifest)
  }
  return [...byId.values()]
}
