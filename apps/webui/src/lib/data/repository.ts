import type {
  DataDocument,
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositorySnapshot,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@i0c/config";
import type { AtomicVersionedDataRepository } from "@i0c/plugin-api";

export type AppDataRepository = AtomicVersionedDataRepository<
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositoryWriteInput,
  DataDocument,
  DataRepositoryWriteResult,
  DataRepositorySnapshot
>;
