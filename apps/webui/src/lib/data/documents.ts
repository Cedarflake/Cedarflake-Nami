import type {
  DataDocument,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@i0c/config";
import { webUiPluginInstallations } from "@i0c/webui-config";

import type { AppDataRepository } from "./repository";

export const APP_DATA_CONFIG_CACHE_TAG = "i0c:data-config";
export const APP_DATA_SNAPSHOT_CACHE_TAG = "i0c:data-snapshot";

export type DataDocumentUpdateInput = Omit<
  DataRepositoryWriteInput,
  "credential"
>;

let appDataRepository: AppDataRepository | null = null;

export function getAppDataSnapshot() {
  return getAppDataRepository().readSnapshot({
    cacheTags: [
      APP_DATA_CONFIG_CACHE_TAG,
      APP_DATA_SNAPSHOT_CACHE_TAG,
    ],
  });
}

export function getRedirectsDocument(
  credential: string | undefined,
  options?: { sourceUrl?: string | null },
): Promise<DataDocument> {
  return getAppDataRepository().read("redirects", {
    credential,
    sourceUrl: options?.sourceUrl,
  });
}

export function getAppDataConfigDocument(
  credential?: string,
): Promise<DataDocument> {
  return getAppDataRepository().read("config", {
    credential,
    cacheTags: [APP_DATA_CONFIG_CACHE_TAG],
  });
}

export function updateRedirectsDocument(
  credential: string,
  input: DataDocumentUpdateInput,
): Promise<DataRepositoryWriteResult> {
  return getAppDataRepository().write("redirects", { ...input, credential });
}

export function updateAppDataConfigDocument(
  credential: string,
  input: DataDocumentUpdateInput,
): Promise<DataRepositoryWriteResult> {
  return getAppDataRepository().write("config", { ...input, credential });
}

function getAppDataRepository(): AppDataRepository {
  appDataRepository ??= webUiPluginInstallations.dataRepository.create();
  return appDataRepository;
}
