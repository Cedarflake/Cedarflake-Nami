import type { PluginInitializationContext } from "./context"
import type { PluginHealthCheck } from "./health"
import type { PluginManifest, RuntimePlatformManifest } from "./manifest"
import type { PluginMigrationProvider } from "./migrations"
import type { Awaitable, JsonObject } from "./types"

export interface RuntimeDataSource<TConfig, TRules> {
  loadConfig(): Promise<TConfig | null>
  loadRules(): Promise<TRules | null>
}

export interface AnalyticsSink<TEvent, TContext> {
  emit(event: TEvent, context: TContext): Promise<void>
}

export interface VersionedDataRepository<
  TKind extends string,
  TReadOptions,
  TWriteInput,
  TDocument,
  TWriteResult,
> {
  read(kind: TKind, options: TReadOptions): Promise<TDocument>
  write(kind: TKind, input: TWriteInput): Promise<TWriteResult>
}

export interface AtomicVersionedDataRepository<
  TKind extends string,
  TReadOptions,
  TWriteInput,
  TDocument,
  TWriteResult,
  TSnapshot,
> extends VersionedDataRepository<
  TKind,
  TReadOptions,
  TWriteInput,
  TDocument,
  TWriteResult
> {
  readSnapshot(options: TReadOptions): Promise<TSnapshot>
}

export interface RuntimePlatformAdapter<TArguments extends readonly unknown[]> {
  readonly id: string
  handle(...args: TArguments): Promise<Response>
}

export interface RuntimeCache {
  match(request: Request): Promise<Response | null | undefined>
  put(request: Request, response: Response): Promise<void>
}

export interface RuntimePlatformContext {
  cache?: RuntimeCache
  country?: string
  envBindings?: Record<string, unknown>
  provider: string
  readEnvironment?(name: string): unknown
  waitUntil?(promise: Promise<unknown>): void
}

export interface RuntimeRequestHandler {
  (request: Request, context: RuntimePlatformContext): Promise<Response>
}

export interface RuntimePlatformPlugin<TDeployment = unknown> {
  readonly manifest: RuntimePlatformManifest
  create(handler: RuntimeRequestHandler): TDeployment
}

export interface AnalyticsStoreTypes {
  event: unknown
  ingestResult: unknown
  scope: unknown
  overview: unknown
  automation: unknown
  entryDomain: unknown
  detailInput: unknown
  detail: unknown
  rebuildInput: unknown
  rebuildResult: unknown
  retentionScope: unknown
  retentionResult: unknown
}

export interface AnalyticsStore<TTypes extends AnalyticsStoreTypes>
  extends PluginHealthCheck {
  migrations?: PluginMigrationProvider
  ingest(event: TTypes["event"]): Promise<TTypes["ingestResult"]>
  getOverview(scope: TTypes["scope"]): Promise<TTypes["overview"]>
  getAutomation(scope: TTypes["scope"]): Promise<TTypes["automation"]>
  getEntryDomains(scope: TTypes["scope"]): Promise<readonly TTypes["entryDomain"][]>
  getDetail(input: TTypes["detailInput"]): Promise<TTypes["detail"]>
  rebuildAggregates(input: TTypes["rebuildInput"]): Promise<TTypes["rebuildResult"]>
  runRetention(scope: TTypes["retentionScope"]): Promise<TTypes["retentionResult"]>
}

export interface RuntimeFeatureHooks<TAnalyticsEvent> {
  onAnalyticsEvent?(event: TAnalyticsEvent): Awaitable<TAnalyticsEvent>
}

export interface PluginDefinition<
  TInstance,
  TConfig extends object = JsonObject,
  TServices extends object = Record<string, never>,
  TManifest extends PluginManifest = PluginManifest,
> {
  manifest: TManifest
  create(context: PluginInitializationContext<TConfig, TServices>): Awaitable<TInstance>
}

export interface PluginDeclaration<TConfig extends object = JsonObject> {
  id: string
  enabled: boolean
  config: TConfig
  secrets: Readonly<Record<string, string>>
}

export function definePlugin<
  TInstance,
  TConfig extends object,
  TServices extends object,
  TManifest extends PluginManifest,
>(
  definition: PluginDefinition<TInstance, TConfig, TServices, TManifest>,
): PluginDefinition<TInstance, TConfig, TServices, TManifest> {
  return definition
}
