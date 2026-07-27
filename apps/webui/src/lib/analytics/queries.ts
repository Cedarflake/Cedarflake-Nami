import "server-only";

import { unstable_cache } from "next/cache";

import { normalizeAnalyticsTimeZone } from "@i0c/analytics-domain/range";

import { getEffectiveDataConfig } from "@/lib/configuration/data-config";

import { analyticsCacheTag } from "./cache";
import { resolveAnalyticsSourceId } from "./configuration";
import {
  getAnalyticsStoreForSelection,
  getRequiredAnalyticsStoreForSelection,
  resolveAnalyticsStoreSelection,
  type AnalyticsStoreSelection,
  type WebUiAnalyticsStore
} from "./store";
import type {
  AnalyticsAutomationOverview,
  AnalyticsDetail,
  AnalyticsOverview,
  AnalyticsQueryScope,
  AnalyticsScope
} from "./types";

export type {
  AnalyticsAutomationOverview,
  AnalyticsDetail,
  AnalyticsOverview,
  AnalyticsQueryScope,
  AnalyticsRange
} from "./types";

const analyticsCacheSeconds = 15;

export async function isAnalyticsConfigured(): Promise<boolean> {
  const config = await getEffectiveDataConfig();
  if (resolveAnalyticsSourceId(config) === null) {
    return false;
  }
  const store = await getAnalyticsStoreForSelection(
    resolveAnalyticsStoreSelection(config)
  );
  return store?.configured === true;
}

export async function getAnalyticsScope(input: AnalyticsQueryScope): Promise<AnalyticsScope> {
  const { sourceId, store } = await resolveAnalyticsQueryContext();
  const availableEntryDomains = await store.getEntryDomains({ sourceId, query: input });
  const entryDomain = resolveEntryDomain(input.entryDomain, availableEntryDomains);
  return { entryDomain, availableEntryDomains: [...availableEntryDomains] };
}

async function queryAnalyticsOverview(
  storeSelection: AnalyticsStoreSelection,
  sourceId: string,
  input: AnalyticsQueryScope
): Promise<AnalyticsOverview> {
  const store = await getRequiredAnalyticsStoreForSelection(storeSelection);
  return store.getOverview({ sourceId, query: input });
}

const getCachedAnalyticsOverview = unstable_cache(
  queryAnalyticsOverview,
  ["analytics-overview-v8"],
  { revalidate: analyticsCacheSeconds, tags: [analyticsCacheTag] }
);

export async function getAnalyticsOverview(
  input: AnalyticsQueryScope
): Promise<AnalyticsOverview> {
  const context = await resolveAnalyticsQueryContext();
  const normalizedInput = await normalizeQueryScope(
    context.store,
    context.sourceId,
    input
  );
  return getCachedAnalyticsOverview(
    context.storeSelection,
    context.sourceId,
    normalizedInput
  );
}

async function queryAnalyticsDetail(
  storeSelection: AnalyticsStoreSelection,
  sourceId: string,
  analyticsId: string,
  input: AnalyticsQueryScope
): Promise<AnalyticsDetail | null> {
  const store = await getRequiredAnalyticsStoreForSelection(storeSelection);
  return store.getDetail({ sourceId, analyticsId, query: input });
}

const getCachedAnalyticsDetail = unstable_cache(
  queryAnalyticsDetail,
  ["analytics-detail-v7"],
  { revalidate: analyticsCacheSeconds, tags: [analyticsCacheTag] }
);

export async function getAnalyticsDetail(
  analyticsId: string,
  input: AnalyticsQueryScope
): Promise<AnalyticsDetail | null> {
  const context = await resolveAnalyticsQueryContext();
  const normalizedInput = await normalizeQueryScope(
    context.store,
    context.sourceId,
    input
  );
  return getCachedAnalyticsDetail(
    context.storeSelection,
    context.sourceId,
    analyticsId,
    normalizedInput
  );
}

async function queryAnalyticsAutomationOverview(
  storeSelection: AnalyticsStoreSelection,
  sourceId: string,
  input: AnalyticsQueryScope
): Promise<AnalyticsAutomationOverview> {
  const store = await getRequiredAnalyticsStoreForSelection(storeSelection);
  return store.getAutomation({ sourceId, query: input });
}

const getCachedAnalyticsAutomationOverview = unstable_cache(
  queryAnalyticsAutomationOverview,
  ["analytics-automation-overview-v7"],
  { revalidate: analyticsCacheSeconds, tags: [analyticsCacheTag] }
);

export async function getAnalyticsAutomationOverview(
  input: AnalyticsQueryScope
): Promise<AnalyticsAutomationOverview> {
  const context = await resolveAnalyticsQueryContext();
  const normalizedInput = await normalizeQueryScope(
    context.store,
    context.sourceId,
    input
  );
  return getCachedAnalyticsAutomationOverview(
    context.storeSelection,
    context.sourceId,
    normalizedInput
  );
}

async function normalizeQueryScope(
  store: WebUiAnalyticsStore,
  sourceId: string,
  input: AnalyticsQueryScope
): Promise<AnalyticsQueryScope> {
  const availableEntryDomains = await store.getEntryDomains({ sourceId, query: input });
  return {
    range: input.range,
    entryDomain: resolveEntryDomain(input.entryDomain, availableEntryDomains),
    timeZone: normalizeAnalyticsTimeZone(input.timeZone),
  };
}

function resolveEntryDomain(
  requestedValue: string,
  availableEntryDomains: readonly { value: string }[]
): string {
  const requested = requestedValue.trim().toLowerCase() || "all";
  return requested === "all"
    || availableEntryDomains.some((option) => option.value === requested)
    ? requested
    : "all";
}

async function resolveAnalyticsQueryContext(): Promise<{
  sourceId: string;
  store: WebUiAnalyticsStore;
  storeSelection: AnalyticsStoreSelection;
}> {
  const config = await getEffectiveDataConfig();
  const sourceId = resolveAnalyticsSourceId(config);
  if (!sourceId) {
    throw new Error("Analytics source ID in data/config.json is invalid");
  }
  const storeSelection = resolveAnalyticsStoreSelection(config);
  if (!storeSelection) {
    throw new Error("The selected analytics store is unavailable");
  }
  const store = await getRequiredAnalyticsStoreForSelection(storeSelection);
  return { sourceId, store, storeSelection };
}
