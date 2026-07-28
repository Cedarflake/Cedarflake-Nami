export type PluginKind =
  | "analytics-sink"
  | "analytics-store"
  | "data-repository"
  | "data-source"
  | "feature"
  | "runtime-platform"

export interface CreatePluginPackageOptions {
  dryRun?: boolean
  kind: PluginKind
  name: string
  root?: string
  scope?: string
}

export interface CreatePluginPackageResult {
  files: readonly string[]
  packageName: string
  registrationTarget: string
  targetDirectory: string
}

export interface PluginCliOptions extends CreatePluginPackageOptions {
  dryRun: boolean
  root: string | undefined
  scope: string
}

export function createPluginPackage(
  options: CreatePluginPackageOptions,
): CreatePluginPackageResult

export function parseCliOptions(
  argv: readonly string[],
): PluginCliOptions | { help: true }

export function resolvePluginDefinition(
  options: CreatePluginPackageOptions,
): Readonly<Record<string, unknown>>
