import assert from "node:assert/strict"

import {
  DataDocumentNotFoundError,
  DataRepositoryConflictError,
  DataRepositoryInitializationError,
  type DataDocument,
  type DataDocumentKind,
  type DataRepositoryManagement,
  type DataRepositoryReadOptions,
  type DataRepositorySnapshot,
  type DataRepositoryWriteInput,
  type DataRepositoryWriteResult,
} from "@i0c/config"
import {
  type AnalyticsSink,
  type AnalyticsStore,
  type AnalyticsStoreTypes,
  type AtomicVersionedDataRepository,
  type PluginHealthCheck,
  type PluginManifest,
  type PluginSchemaMigrationProvider,
  type RuntimeDataSource,
  RuntimeFeaturePipeline,
  type RuntimeFeatureRegistration,
  type RuntimePlatformAdapter,
  type RuntimePlatformPlugin,
  type VersionedDataRepository,
  validatePluginManifest,
} from "@i0c/plugin-api"

export function assertPluginManifest(manifest: PluginManifest): void {
  const result = validatePluginManifest(manifest)

  assert.equal(
    result.valid,
    true,
    `Invalid plugin manifest:\n${result.issues.map((issue) => `- ${issue}`).join("\n")}`,
  )
}

export async function assertHealthCheck(
  plugin: PluginHealthCheck,
  expectedStatus: "degraded" | "healthy" | "unhealthy" = "healthy",
): Promise<void> {
  const report = await plugin.healthCheck()

  assert.equal(report.status, expectedStatus)
}

export async function assertSchemaMigrationState(
  plugin: PluginSchemaMigrationProvider,
  expectedTargetVersion: string,
): Promise<void> {
  const [status, plan] = await Promise.all([
    plugin.schemaMigrationStatus(),
    plugin.schemaMigrationPlan(),
  ])

  assert.equal(status.targetVersion, expectedTargetVersion)
  assert.equal(plan.targetVersion, expectedTargetVersion)
  assert.equal(status.currentVersion, plan.currentVersion)
  assert.equal(status.pending, plan.actions.length)
}

export interface RuntimeDataSourceContractInput<TConfig, TRules> {
  source: RuntimeDataSource<TConfig, TRules>
  expectedConfig: TConfig | null
  expectedRules: TRules | null
}

export async function assertRuntimeDataSourceContract<TConfig, TRules>(
  input: RuntimeDataSourceContractInput<TConfig, TRules>,
): Promise<void> {
  const config = await input.source.loadConfig()
  const rules = await input.source.loadRules()

  assert.deepEqual(config, input.expectedConfig)
  assert.deepEqual(rules, input.expectedRules)
}

export interface AnalyticsSinkContractInput<TEvent, TContext> {
  sink: AnalyticsSink<TEvent, TContext>
  event: TEvent
  context: TContext
  verify(): void | Promise<void>
}

export async function assertAnalyticsSinkContract<TEvent, TContext>(
  input: AnalyticsSinkContractInput<TEvent, TContext>,
): Promise<void> {
  await input.sink.emit(input.event, input.context)
  await input.verify()
}

export interface VersionedDataRepositoryContractInput<
  TKind extends string,
  TReadOptions,
  TWriteInput,
  TDocument,
  TWriteResult,
> {
  repository: VersionedDataRepository<
    TKind,
    TReadOptions,
    TWriteInput,
    TDocument,
    TWriteResult
  >
  kind: TKind
  readOptions: TReadOptions
  writeInput: TWriteInput
  expectedBefore: TDocument
  expectedWriteResult: TWriteResult
  expectedAfter: TDocument
}

export async function assertVersionedDataRepositoryContract<
  TKind extends string,
  TReadOptions,
  TWriteInput,
  TDocument,
  TWriteResult,
>(
  input: VersionedDataRepositoryContractInput<
    TKind,
    TReadOptions,
    TWriteInput,
    TDocument,
    TWriteResult
  >,
): Promise<void> {
  const before = await input.repository.read(input.kind, input.readOptions)
  const writeResult = await input.repository.write(input.kind, input.writeInput)
  const after = await input.repository.read(input.kind, input.readOptions)

  assert.deepEqual(before, input.expectedBefore)
  assert.deepEqual(writeResult, input.expectedWriteResult)
  assert.deepEqual(after, input.expectedAfter)
}

export type ManagedDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
> & {
  management: DataRepositoryManagement
}

export async function assertManagedDataRepositoryBehaviorContract(
  repository: ManagedDataRepository,
): Promise<void> {
  const actorGitHubUserId = "123"
  const initialConfig = "{\"schemaVersion\":1}"
  const initialRedirects = "{\"Slots\":{}}"
  const updatedConfig = "{\"schemaVersion\":1,\"updated\":true}"
  const importedConfig = "{\"schemaVersion\":1,\"imported\":true}"
  const importedRedirects = "{\"Slots\":{\"/\":\"https://example.com\"}}"

  assert.deepEqual(
    await repository.management.inspectSetupState(),
    { state: "empty", existingKinds: [] },
  )

  const initialized = await repository.management.initialize({
    actorGitHubUserId,
    configContent: initialConfig,
    redirectsContent: initialRedirects,
  })
  assert.equal(initialized.config.revision, "1")
  assert.equal(initialized.redirects.revision, "1")
  assert.match(initialized.revision, /^[0-9a-f]{64}$/)
  assert.deepEqual(
    await repository.management.inspectSetupState(),
    { state: "initialized" },
  )
  await assert.rejects(
    repository.management.initialize({
      actorGitHubUserId,
      configContent: initialConfig,
      redirectsContent: initialRedirects,
    }),
    DataRepositoryInitializationError,
  )

  assert.deepEqual(
    await repository.write("config", {
      actorGitHubUserId,
      content: updatedConfig,
      expectedRevision: "1",
    }),
    { revision: "2" },
  )
  await assert.rejects(
    repository.write("config", {
      actorGitHubUserId,
      content: "{\"schemaVersion\":1,\"stale\":true}",
      expectedRevision: "1",
    }),
    (error) => {
      assert.ok(error instanceof DataRepositoryConflictError)
      assert.equal(error.kind, "config")
      assert.equal(error.expectedRevision, "1")
      assert.equal(error.actualRevision, "2")
      return true
    },
  )

  const firstConfigRevision = await repository.management.readRevision({
    kind: "config",
    revision: "1",
  })
  assert.equal(firstConfigRevision.content, initialConfig)
  assert.equal(firstConfigRevision.operation, "initialize")
  assert.equal(firstConfigRevision.actorGitHubUserId, actorGitHubUserId)
  assert.match(firstConfigRevision.checksum, /^[0-9a-f]{64}$/)
  assert.ok(Number.isFinite(Date.parse(firstConfigRevision.createdAt)))

  assert.deepEqual(
    await repository.management.restore({
      actorGitHubUserId,
      expectedRevision: "2",
      kind: "config",
      revision: "1",
    }),
    { revision: "3" },
  )
  assert.equal(
    (await repository.read("config", {})).content,
    initialConfig,
  )

  const imported = await repository.management.importSnapshot({
    actorGitHubUserId,
    configContent: importedConfig,
    expectedConfigRevision: "3",
    expectedRedirectsRevision: "1",
    redirectsContent: importedRedirects,
  })
  assert.equal(imported.config.revision, "4")
  assert.equal(imported.redirects.revision, "2")
  assert.equal(imported.config.content, importedConfig)
  assert.equal(imported.redirects.content, importedRedirects)

  const beforeConflict = await repository.readSnapshot({})
  await assert.rejects(
    repository.management.importSnapshot({
      actorGitHubUserId,
      configContent: "{\"schemaVersion\":1,\"mustNotPersist\":true}",
      expectedConfigRevision: "4",
      expectedRedirectsRevision: "1",
      redirectsContent: "{\"Slots\":{\"/stale\":\"https://example.com\"}}",
    }),
    (error) => {
      assert.ok(error instanceof DataRepositoryConflictError)
      assert.equal(error.kind, "redirects")
      assert.equal(error.expectedRevision, "1")
      assert.equal(error.actualRevision, "2")
      return true
    },
  )
  assert.deepEqual(await repository.readSnapshot({}), beforeConflict)

  assert.deepEqual(
    (await repository.management.listRevisions({
      kind: "config",
      limit: 10,
    })).map((revision) => [revision.revision, revision.operation]),
    [
      ["4", "import"],
      ["3", "rollback"],
      ["2", "save"],
      ["1", "initialize"],
    ],
  )
  assert.deepEqual(
    (await repository.management.listRevisions({
      beforeRevision: "3",
      kind: "config",
      limit: 10,
    })).map((revision) => revision.revision),
    ["2", "1"],
  )
  await assert.rejects(
    repository.management.readRevision({
      kind: "config",
      revision: "999",
    }),
    DataDocumentNotFoundError,
  )
}

export interface RuntimePlatformContractInput<
  TArguments extends readonly unknown[],
> {
  adapter: RuntimePlatformAdapter<TArguments>
  args: TArguments
  expectedStatus: number
  expectedBody?: string
}

export async function assertRuntimePlatformContract<
  TArguments extends readonly unknown[],
>(input: RuntimePlatformContractInput<TArguments>): Promise<void> {
  assert.ok(input.adapter.id.trim())

  const response = await input.adapter.handle(...input.args)

  assert.equal(response.status, input.expectedStatus)

  if (input.expectedBody !== undefined) {
    assert.equal(await response.text(), input.expectedBody)
  }
}

export function assertRuntimePlatformPlugin(
  plugin: RuntimePlatformPlugin,
): void {
  assertPluginManifest(plugin.manifest)
  assert.equal(plugin.manifest.kind, "runtime-platform")
  assert.ok(plugin.manifest.provider.trim())
  assert.equal(typeof plugin.create, "function")
}

export interface RuntimeFeatureEventContractInput<TEvent> {
  registration: RuntimeFeatureRegistration<TEvent>
  event: TEvent
  expectedEvent: TEvent
}

export async function assertRuntimeFeatureEventContract<TEvent>(
  input: RuntimeFeatureEventContractInput<TEvent>,
): Promise<void> {
  const pipeline = new RuntimeFeaturePipeline([input.registration])

  assert.deepEqual(
    await pipeline.onAnalyticsEvent(input.event),
    input.expectedEvent,
  )
}

export interface AnalyticsStoreContractInput<TTypes extends AnalyticsStoreTypes> {
  store: AnalyticsStore<TTypes>
  event: TTypes["event"]
  scope: TTypes["scope"]
  emptyOverview: TTypes["overview"]
  emptyAutomation: TTypes["automation"]
  emptyEntryDomains: readonly TTypes["entryDomain"][]
  overviewAfterIngest: TTypes["overview"]
  automationAfterIngest: TTypes["automation"]
  entryDomainsAfterIngest: readonly TTypes["entryDomain"][]
}

export async function assertAnalyticsStoreReadContract<
  TTypes extends AnalyticsStoreTypes,
>(input: AnalyticsStoreContractInput<TTypes>): Promise<void> {
  assert.deepEqual(await input.store.getOverview(input.scope), input.emptyOverview)
  assert.deepEqual(await input.store.getAutomation(input.scope), input.emptyAutomation)
  assert.deepEqual(
    await input.store.getEntryDomains(input.scope),
    input.emptyEntryDomains,
  )

  await input.store.ingest(input.event)

  assert.deepEqual(
    await input.store.getOverview(input.scope),
    input.overviewAfterIngest,
  )
  assert.deepEqual(
    await input.store.getAutomation(input.scope),
    input.automationAfterIngest,
  )
  assert.deepEqual(
    await input.store.getEntryDomains(input.scope),
    input.entryDomainsAfterIngest,
  )
}

export interface AnalyticsStoreBehaviorContractInput<
  TTypes extends AnalyticsStoreTypes,
> {
  store: AnalyticsStore<TTypes>
  event: TTypes["event"]
  otherEntryDomainEvent: TTypes["event"]
  expiredEvent: TTypes["event"]
  scope: TTypes["scope"]
  createScope(
    range: "1d" | "7d" | "30d" | "90d",
    entryDomain: string,
  ): TTypes["scope"]
  detailInput: TTypes["detailInput"]
  missingDetailInput: TTypes["detailInput"]
  rebuildInput: TTypes["rebuildInput"]
  invalidRebuildInput: TTypes["rebuildInput"]
  retentionScope: TTypes["retentionScope"]
  prepareRetention(): Promise<void>
  expectedEntryDomain: string
  expectedOtherEntryDomain: string
  expectedExpiredEntryDomain: string
  expectedEstimatedRequests: number
  getOverviewObservedRequests(value: TTypes["overview"]): number
  getOverviewOutcomeObservedRequests(value: TTypes["overview"]): number
  getAutomationObservedRequests(value: TTypes["automation"]): number
  getAutomationEstimatedRequests(value: TTypes["automation"]): number
  getAutomationOutcomeObservedRequests(value: TTypes["automation"]): number
  getOverviewSeriesTimestamps(value: TTypes["overview"]): readonly string[]
  getEntryDomainValues(values: readonly TTypes["entryDomain"][]): readonly string[]
  getDetailObservedRequests(value: TTypes["detail"]): number | null
  getIsDuplicate(value: TTypes["ingestResult"]): boolean
  getRebuildReplayedEvents(value: TTypes["rebuildResult"]): number
  getRetentionDeletedRawEvents(value: TTypes["retentionResult"]): number
}

export async function assertAnalyticsStoreBehaviorContract<
  TTypes extends AnalyticsStoreTypes,
>(input: AnalyticsStoreBehaviorContractInput<TTypes>): Promise<void> {
  assert.equal((await input.store.healthCheck()).status, "healthy")
  assert.equal(
    input.getOverviewObservedRequests(
      await input.store.getOverview(input.scope),
    ),
    0,
  )
  assert.equal(
    input.getAutomationObservedRequests(
      await input.store.getAutomation(input.scope),
    ),
    0,
  )

  const first = await input.store.ingest(input.event)
  const duplicate = await input.store.ingest(input.event)
  const otherEntryDomain = await input.store.ingest(input.otherEntryDomainEvent)
  assert.equal(input.getIsDuplicate(first), false)
  assert.equal(input.getIsDuplicate(duplicate), true)
  assert.equal(input.getIsDuplicate(otherEntryDomain), false)
  const overview = await input.store.getOverview(input.scope)
  const automation = await input.store.getAutomation(input.scope)
  assert.equal(input.getOverviewObservedRequests(overview), 2)
  assert.equal(input.getOverviewOutcomeObservedRequests(overview), 0)
  assert.equal(input.getAutomationObservedRequests(automation), 2)
  assert.equal(
    input.getAutomationEstimatedRequests(automation),
    input.expectedEstimatedRequests,
  )
  assert.equal(input.getAutomationOutcomeObservedRequests(automation), 2)
  assert.equal(
    input.getDetailObservedRequests(
      await input.store.getDetail(input.detailInput),
    ),
    1,
  )
  assert.equal(
    input.getDetailObservedRequests(
      await input.store.getDetail(input.missingDetailInput),
    ),
    null,
  )
  assert.equal(
    input.getOverviewObservedRequests(
      await input.store.getOverview(
        input.createScope("1d", input.expectedEntryDomain),
      ),
    ),
    1,
  )
  assert.equal(
    input.getOverviewObservedRequests(
      await input.store.getOverview(
        input.createScope("1d", input.expectedOtherEntryDomain),
      ),
    ),
    1,
  )
  assert.deepEqual(
    [...input.getEntryDomainValues(
      await input.store.getEntryDomains(input.scope),
    )].sort(),
    [input.expectedEntryDomain, input.expectedOtherEntryDomain].sort(),
  )

  for (const range of ["1d", "7d", "30d", "90d"] as const) {
    const overview = await input.store.getOverview(
      input.createScope(range, "all"),
    )
    assertSeriesStep(
      input.getOverviewSeriesTimestamps(overview),
      range === "1d" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    )
  }

  await assert.rejects(
    input.store.rebuildAggregates(input.invalidRebuildInput),
    /sourceId must not be empty/,
  )
  const rebuild = await input.store.rebuildAggregates(input.rebuildInput)
  assert.equal(input.getRebuildReplayedEvents(rebuild), 2)
  assert.equal(
    input.getOverviewObservedRequests(
      await input.store.getOverview(input.scope),
    ),
    2,
  )

  assert.equal(input.getIsDuplicate(await input.store.ingest(input.expiredEvent)), false)
  assert.equal(
    input.getEntryDomainValues(
      await input.store.getEntryDomains(input.scope),
    ).includes(input.expectedExpiredEntryDomain),
    false,
  )
  await input.prepareRetention()
  const retention = await input.store.runRetention(input.retentionScope)
  assert.ok(input.getRetentionDeletedRawEvents(retention) >= 1)
}

function assertSeriesStep(
  timestamps: readonly string[],
  expectedStepMs: number,
): void {
  assert.ok(timestamps.length >= 2)
  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = Date.parse(timestamps[index - 1] ?? "")
    const current = Date.parse(timestamps[index] ?? "")
    assert.equal(current - previous, expectedStepMs)
  }
}
