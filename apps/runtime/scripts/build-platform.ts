import path from "node:path"
import { pathToFileURL } from "node:url"
import process from "node:process"

import { buildRuntimePlatform } from "@nami/runtime-build"
import {
  assertRuntimePlatformModuleMatchesInstallation,
  defineRuntimeInstallationConfig,
  parseRuntimeInstallationConfig,
  resolveRuntimePlatformInstallation,
} from "@nami/runtime-build/config"
import {
  installedPluginManifests,
  validateInstalledPluginDeclarations,
} from "@nami/plugin-catalog"
import {
  listRuntimePluginManifests,
  type RuntimePluginInstallations,
} from "@nami/runtime-host/installations"

async function main(): Promise<void> {
  const platformKey = process.argv[2]
  if (!platformKey || platformKey.startsWith("--")) {
    throw new TypeError("A Runtime platform installation key is required")
  }

  const isWatch = process.argv.includes("--watch")
  const shouldClean = !process.argv.includes("--preserve-output")
  const runtimeRoot = path.resolve(process.cwd())
  const workspaceRoot = path.resolve(runtimeRoot, "../..")
  const configArgumentIndex = process.argv.indexOf("--config")
  const configPath = configArgumentIndex >= 0
    ? process.argv[configArgumentIndex + 1]
    : path.join(workspaceRoot, "nami.runtime.config.ts")
  if (!configPath) {
    throw new TypeError("The --config option requires a file path")
  }
  const configModule = await import(
    pathToFileURL(path.resolve(runtimeRoot, configPath)).href
  )
  const parsedInstallationConfig = parseRuntimeInstallationConfig(
    configModule.runtimeInstallationConfig,
  )
  const runtimePluginInstallations = configModule.runtimePluginInstallations as
    RuntimePluginInstallations
  const runtimePluginManifests = listRuntimePluginManifests(
    runtimePluginInstallations,
  )
  const runtimeInstallationConfig = defineRuntimeInstallationConfig({
    ...parsedInstallationConfig,
    reservedPluginIds: [...new Set([
      ...(parsedInstallationConfig.reservedPluginIds ?? []),
      ...runtimePluginManifests.map((manifest) => manifest.id),
      ...installedPluginManifests
        .filter((manifest) => manifest.kind !== "runtime-platform")
        .map((manifest) => manifest.id),
    ])],
  })
  const manifestIssues = validateInstalledPluginDeclarations(
    {},
    [
      ...runtimePluginManifests,
      ...runtimeInstallationConfig.platforms.map(
        (installation) => installation.manifest,
      ),
    ],
  )
  if (manifestIssues.length > 0) {
    throw new TypeError(manifestIssues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n"))
  }
  const platform = resolveRuntimePlatformInstallation(
    runtimeInstallationConfig,
    platformKey,
  )
  const runtimeModule: unknown = await import(platform.runtimeModule)
  assertRuntimePlatformModuleMatchesInstallation(runtimeModule, platform)

  await buildRuntimePlatform({
    baseBundlePackages: [
      "@nami/analytics-domain",
      "@nami/config",
      "@nami/plugin-api",
      "@nami/plugin-catalog",
      "@nami/plugin-sdk",
      "@nami/runtime-build",
      "@nami/runtime-host",
      "zod",
      ...runtimeInstallationConfig.platforms.flatMap(
        (installation) => installation.bundlePackages,
      ),
      ...runtimePluginInstallations.bundlePackages,
    ],
    clean: shouldClean,
    entryFile: path.join(runtimeRoot, "src/entry.ts"),
    installedPlatformManifests: runtimeInstallationConfig.platforms.map(
      (installation) => installation.manifest,
    ),
    moduleResolveDirectory: workspaceRoot,
    onSuccess: "node scripts/remove-empty-dirs.mjs dist",
    outDir: path.join(runtimeRoot, "dist"),
    platform,
    runtimeConfigFile: path.resolve(runtimeRoot, configPath),
    tsconfig: path.join(runtimeRoot, "tsconfig.json"),
    watch: isWatch,
  })
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
