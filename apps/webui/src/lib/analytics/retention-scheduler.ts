import "server-only";

import { after } from "next/server";

import type { WebUiAnalyticsStore } from "@/lib/plugins/installations";

const retentionIntervalMs = 24 * 60 * 60 * 1000;
const retentionRetryIntervalMs = 15 * 60 * 1000;

let isRetentionPending = false;
let nextRetentionAt = 0;

export function scheduleAnalyticsRetention(store: WebUiAnalyticsStore): void {
  const now = Date.now();
  if (isRetentionPending || now < nextRetentionAt) {
    return;
  }

  isRetentionPending = true;
  nextRetentionAt = now + retentionIntervalMs;
  after(async () => {
    try {
      await store.runRetention({});
    } catch (error) {
      nextRetentionAt = Date.now() + retentionRetryIntervalMs;
      console.error("Failed to run analytics retention", error);
    } finally {
      isRetentionPending = false;
    }
  });
}
