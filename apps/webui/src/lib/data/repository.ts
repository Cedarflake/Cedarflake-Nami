import type {
  DataDocument,
  DataDocumentKind,
  DataRepositoryManagement,
  DataRepositoryReadOptions,
  DataRepositorySnapshot,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@nami/config";
import type { AtomicVersionedDataRepository } from "@nami/plugin-api";

export type AppDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
> & {
  management?: DataRepositoryManagement;
};
