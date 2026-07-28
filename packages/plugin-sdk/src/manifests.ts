import {
  PLUGIN_API_VERSION,
  validatePluginManifest,
  type PluginDescriptionManifest,
  type PluginManifest,
  type RuntimePlatformManifest,
} from "@i0c/plugin-api"

export interface PluginBilingualText {
  readonly [locale: string]: string
  readonly en: string
  readonly "zh-CN": string
}

export interface PluginBilingualDescription extends PluginDescriptionManifest {
  readonly summary: PluginBilingualText
}

type AuthorManifestInput<
  TKind extends PluginManifest["kind"],
  THost extends PluginManifest["hosts"][number],
> = Omit<
  PluginManifest<TKind, THost>,
  "apiVersion" | "description" | "hosts" | "kind" | "slot"
> & {
  readonly description: PluginBilingualDescription
}

export type DataSourceManifestInput = AuthorManifestInput<
  "data-source",
  "runtime"
>

export type DataRepositoryManifestInput = AuthorManifestInput<
  "data-repository",
  "webui"
>

export type AnalyticsSinkManifestInput = AuthorManifestInput<
  "analytics-sink",
  "runtime"
>

export type AnalyticsStoreManifestInput = AuthorManifestInput<
  "analytics-store",
  "collector" | "webui"
>

export type RuntimeFeatureManifestInput = AuthorManifestInput<
  "feature",
  "runtime"
> & {
  readonly slot?: "feature" | `feature:${string}`
}

export type RuntimePlatformManifestInput = Omit<
  RuntimePlatformManifest,
  "apiVersion" | "description" | "hosts" | "kind" | "slot"
> & {
  readonly description: PluginBilingualDescription
}

export function definePluginManifest<
  const TManifest extends PluginManifest,
>(manifest: TManifest): TManifest {
  const result = validatePluginManifest(manifest)
  if (!result.valid) {
    throw new TypeError([
      `Invalid plugin manifest ${manifest.id}:`,
      ...result.issues.map((issue) => `- ${issue}`),
    ].join("\n"))
  }
  return manifest
}

export function defineDataSourceManifest<
  const TInput extends DataSourceManifestInput,
>(
  input: TInput,
) {
  return definePluginManifest({
    ...input,
    apiVersion: PLUGIN_API_VERSION,
    kind: "data-source",
    slot: "data-source",
    hosts: ["runtime"] as const,
  })
}

export function defineDataRepositoryManifest<
  const TInput extends DataRepositoryManifestInput,
>(
  input: TInput,
) {
  return definePluginManifest({
    ...input,
    apiVersion: PLUGIN_API_VERSION,
    kind: "data-repository",
    slot: "data-repository",
    hosts: ["webui"] as const,
  })
}

export function defineAnalyticsSinkManifest<
  const TInput extends AnalyticsSinkManifestInput,
>(
  input: TInput,
) {
  return definePluginManifest({
    ...input,
    apiVersion: PLUGIN_API_VERSION,
    kind: "analytics-sink",
    slot: "analytics-sink",
    hosts: ["runtime"] as const,
  })
}

export function defineAnalyticsStoreManifest<
  const TInput extends AnalyticsStoreManifestInput,
>(
  input: TInput,
) {
  return definePluginManifest({
    ...input,
    apiVersion: PLUGIN_API_VERSION,
    kind: "analytics-store",
    slot: "analytics-store",
    hosts: ["collector", "webui"] as const,
  })
}

export function defineRuntimeFeatureManifest<
  const TInput extends RuntimeFeatureManifestInput,
>(
  input: TInput,
) {
  return definePluginManifest({
    ...input,
    apiVersion: PLUGIN_API_VERSION,
    kind: "feature",
    slot: input.slot ?? "feature",
    hosts: ["runtime"] as const,
  })
}

export function defineRuntimePlatformManifest<
  const TInput extends RuntimePlatformManifestInput,
>(
  input: TInput,
) {
  return definePluginManifest({
    ...input,
    apiVersion: PLUGIN_API_VERSION,
    kind: "runtime-platform",
    slot: "runtime-platform",
    hosts: ["runtime"] as const,
  })
}
