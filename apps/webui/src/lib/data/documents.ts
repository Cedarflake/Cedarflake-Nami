import type {
  DataDocument,
  DataRepositoryManagement,
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

let appDataRepositoryPromise: Promise<AppDataRepository> | null = null;
const appDataRepositoryBindings = new Map<string, unknown>();

export function configureAppDataRepositoryBinding(
  pluginId: string,
  binding: unknown,
): void {
  appDataRepositoryBindings.set(pluginId, binding);
  appDataRepositoryPromise = null;
}

export async function getAppDataSnapshot() {
  const repository = await getAppDataRepository();
  return repository.readSnapshot({
    cacheTags: [
      APP_DATA_CONFIG_CACHE_TAG,
      APP_DATA_SNAPSHOT_CACHE_TAG,
    ],
  });
}

export async function getRedirectsDocument(
  credential: string | undefined,
  options?: { sourceUrl?: string | null },
): Promise<DataDocument> {
  const repository = await getAppDataRepository();
  return repository.read("redirects", {
    credential,
    sourceUrl: options?.sourceUrl,
  });
}

export async function getAppDataConfigDocument(
  credential?: string,
): Promise<DataDocument> {
  const repository = await getAppDataRepository();
  return repository.read("config", {
    credential,
    cacheTags: [APP_DATA_CONFIG_CACHE_TAG],
  });
}

export async function updateRedirectsDocument(
  credential: string,
  input: DataDocumentUpdateInput,
): Promise<DataRepositoryWriteResult> {
  const repository = await getAppDataRepository();
  return repository.write("redirects", { ...input, credential });
}

export async function updateAppDataConfigDocument(
  credential: string,
  input: DataDocumentUpdateInput,
): Promise<DataRepositoryWriteResult> {
  const repository = await getAppDataRepository();
  return repository.write("config", { ...input, credential });
}

export async function getAppDataRepositoryManagement(): Promise<
  DataRepositoryManagement | null
> {
  const repository = await getAppDataRepository();
  return repository.management ?? null;
}

function getAppDataRepository(): Promise<AppDataRepository> {
  appDataRepositoryPromise ??= Promise.resolve(
    webUiPluginInstallations.dataRepository.create({
      bindings: appDataRepositoryBindings,
      readEnvironment: (name) => process.env[name],
    }),
  ).catch((error: unknown) => {
    appDataRepositoryPromise = null;
    throw error;
  });
  return appDataRepositoryPromise;
}
