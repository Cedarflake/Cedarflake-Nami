import type {
  DataDocument,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@i0c/config";
import { webUiPluginInstallations } from "@i0c/webui-config";

export const APP_DATA_CONFIG_CACHE_TAG = "i0c:data-config";
export const APP_DATA_SNAPSHOT_CACHE_TAG = "i0c:data-snapshot";

export type DataDocumentUpdateInput = Omit<
  DataRepositoryWriteInput,
  "credential"
>;

export const appDataRepository = webUiPluginInstallations.dataRepository.create();

export function getAppDataSnapshot() {
  return appDataRepository.readSnapshot({
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
  return appDataRepository.read("redirects", {
    credential,
    sourceUrl: options?.sourceUrl,
  });
}

export function getAppDataConfigDocument(
  credential?: string,
): Promise<DataDocument> {
  return appDataRepository.read("config", {
    credential,
    cacheTags: [APP_DATA_CONFIG_CACHE_TAG],
  });
}

export function updateRedirectsDocument(
  credential: string,
  input: DataDocumentUpdateInput,
): Promise<DataRepositoryWriteResult> {
  return appDataRepository.write("redirects", { ...input, credential });
}

export function updateAppDataConfigDocument(
  credential: string,
  input: DataDocumentUpdateInput,
): Promise<DataRepositoryWriteResult> {
  return appDataRepository.write("config", { ...input, credential });
}
