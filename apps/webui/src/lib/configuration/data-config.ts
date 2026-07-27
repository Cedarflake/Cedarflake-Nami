import "server-only";

import { defaultDataConfig } from "@i0c/config";
import type { DataConfig, DataDocument } from "@i0c/config";

import {
  getAppDataConfigDocument,
} from "@/lib/data/documents";

import { EffectiveDataConfigCache } from "./effective-data-config-cache";
import { parseDataConfig } from "./parse-data-config";

export { parseDataConfig } from "./parse-data-config";

interface DataConfigDocument {
  config: DataConfig;
  document: DataDocument;
}

interface DataConfigGlobalState {
  effectiveDataConfigCache?: EffectiveDataConfigCache;
}

const dataConfigGlobal = globalThis as typeof globalThis & DataConfigGlobalState;
const effectiveDataConfigCache = dataConfigGlobal.effectiveDataConfigCache
  ?? new EffectiveDataConfigCache({
    adoptCacheSeconds: 60,
    defaultConfig: defaultDataConfig,
    failureRetrySeconds: 10,
    loadRemote: readRemoteDataConfig,
    onLoadError: (error) => {
      console.error("Failed to load remote instance config", error);
    },
    successCacheSeconds: (config) =>
      Math.min(config.runtime.configCacheTtlSeconds, 60),
  });
dataConfigGlobal.effectiveDataConfigCache = effectiveDataConfigCache;

export async function readDataConfigDocument(
  accessToken?: string,
): Promise<DataConfigDocument> {
  const document = await readRawDataConfigDocument(accessToken);
  return {
    config: parseDataConfig(document.content),
    document,
  };
}

export function readRawDataConfigDocument(
  accessToken?: string,
): Promise<DataDocument> {
  return getAppDataConfigDocument(accessToken);
}

export async function getEffectiveDataConfig(): Promise<DataConfig> {
  return (await effectiveDataConfigCache.get()).config;
}

export function getAuthoritativeDataConfig(): Promise<DataConfig> {
  return effectiveDataConfigCache.getAuthoritative();
}

export function adoptDataConfigCache(config: DataConfig): void {
  effectiveDataConfigCache.adopt(config);
}

async function readRemoteDataConfig(): Promise<DataConfig> {
  return (await readDataConfigDocument()).config;
}
