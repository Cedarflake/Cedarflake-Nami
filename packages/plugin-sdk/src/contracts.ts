import type { AnalyticsDomainStoreShape } from "@nami/analytics-domain/store"
import type {
  DataDocument,
  DataDocumentKind,
  DataRepositoryManagement,
  DataRepositoryReadOptions,
  DataRepositorySnapshot,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@nami/config"
import type {
  AnalyticsStore,
  AnalyticsStoreTypes,
  AtomicVersionedDataRepository,
} from "@nami/plugin-api"

export type NamiAnalyticsStore = AnalyticsStore<
  AnalyticsDomainStoreShape & AnalyticsStoreTypes
> & {
  readonly configured: boolean
}

export type NamiDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
> & {
  management?: DataRepositoryManagement
}
