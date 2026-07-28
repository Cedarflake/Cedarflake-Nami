import type { AnalyticsDomainStoreShape } from "@i0c/analytics-domain/store"
import type {
  DataDocument,
  DataDocumentKind,
  DataRepositoryManagement,
  DataRepositoryReadOptions,
  DataRepositorySnapshot,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@i0c/config"
import type {
  AnalyticsStore,
  AnalyticsStoreTypes,
  AtomicVersionedDataRepository,
} from "@i0c/plugin-api"

export type I0cAnalyticsStore = AnalyticsStore<
  AnalyticsDomainStoreShape & AnalyticsStoreTypes
> & {
  readonly configured: boolean
}

export type I0cDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
> & {
  management?: DataRepositoryManagement
}
