import { dirname, join } from "node:path"

import tsconfigPathsPluginModule from "@esbuild-plugins/tsconfig-paths"
import type { Plugin } from "esbuild"
import { build } from "tsup"
import type { Options } from "tsup"

import type { RuntimePlatformManifest } from "@nami/plugin-api"

import type { RuntimePlatformInstallation } from "./config"

const tsconfigPathsPlugin = resolveTsconfigPathsPlugin(tsconfigPathsPluginModule)
const runtimePlatformModuleFilename = "virtual-runtime-platform.ts"

export interface RuntimePlatformBuildOptions {
  baseBundlePackages: readonly string[]
  clean?: boolean
  entryFile: string
  installedPlatformManifests: readonly RuntimePlatformManifest[]
  moduleResolveDirectory: string
  onSuccess?: string
  outDir: string
  platform: RuntimePlatformInstallation
  runtimeConfigFile: string
  tsconfig: string
  watch?: boolean
}

export async function buildRuntimePlatform(
  options: RuntimePlatformBuildOptions,
): Promise<void> {
  await build(createRuntimePlatformBuildOptions(options))
}

export function createRuntimePlatformBuildOptions(
  options: RuntimePlatformBuildOptions,
): Options {
  const noExternal = new Set([
    ...options.baseBundlePackages,
    ...options.platform.bundlePackages,
  ])

  return {
    entry: {
      [options.platform.outputEntry]: options.entryFile,
    },
    format: ["esm"],
    target: "es2021",
    outDir: options.outDir,
    clean: options.clean ?? true,
    dts: false,
    outExtension: () => ({ js: ".js" }),
    splitting: false,
    sourcemap: false,
    treeshake: true,
    minify: false,
    noExternal: [...noExternal],
    skipNodeModulesBundle: true,
    shims: false,
    platform: "neutral",
    esbuildPlugins: [
      createRuntimeConfigModulePlugin(options),
      createRuntimePlatformModulePlugin(options),
      tsconfigPathsPlugin({ tsconfig: options.tsconfig }),
    ],
    ...(options.onSuccess ? { onSuccess: options.onSuccess } : {}),
    ...(options.watch ? { watch: true } : {}),
  }
}

function createRuntimeConfigModulePlugin(
  options: RuntimePlatformBuildOptions,
): Plugin {
  return {
    name: "nami-runtime-config",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@nami\/runtime-config$/ }, () => ({
        path: options.runtimeConfigFile,
      }))
    },
  }
}

function createRuntimePlatformModulePlugin(
  options: RuntimePlatformBuildOptions,
): Plugin {
  const modulePath = join(dirname(options.entryFile), runtimePlatformModuleFilename)
  const manifests = JSON.stringify(options.installedPlatformManifests)
  const selectedManifest = JSON.stringify(options.platform.manifest)
  const runtimeModule = JSON.stringify(options.platform.runtimeModule)

  return {
    name: "nami-runtime-platform",
    setup(buildContext) {
      buildContext.onLoad(
        { filter: /virtual-runtime-platform\.ts$/ },
        (args) => {
          if (args.path !== modulePath) {
            return undefined
          }
          return {
            contents: [
              `export { runtimePlatformPlugin } from ${runtimeModule}`,
              `export const installedRuntimePlatformManifests = ${manifests}`,
              `export const selectedRuntimePlatformManifest = ${selectedManifest}`,
            ].join("\n"),
            loader: "js",
            resolveDir: options.moduleResolveDirectory,
          }
        },
      )
    },
  }
}

function resolveTsconfigPathsPlugin(
  moduleValue: unknown,
): (options: { tsconfig: string }) => Plugin {
  const candidate = typeof moduleValue === "function"
    ? moduleValue
    : (moduleValue as { default?: unknown }).default
  if (typeof candidate !== "function") {
    throw new TypeError("Failed to load the tsconfig paths build plugin")
  }
  return candidate as (options: { tsconfig: string }) => Plugin
}

export * from "./config"
