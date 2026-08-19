import "server-only";

import type { DataConfig } from "@nami/config";

import { getEffectiveDataConfig } from "@/lib/configuration/data-config";
import { readInstanceSecret } from "@/lib/configuration/instance-secret";

const hostnameLabelPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function normalizeAnalyticsSourceId(value: string): string | null {
  const sourceId = value.trim().toLowerCase().replace(/\.+$/, "");
  if (sourceId.length === 0 || sourceId.length > 253) {
    return null;
  }

  const labels = sourceId.split(".");
  return labels.every((label) => label.length <= 63 && hostnameLabelPattern.test(label))
    ? sourceId
    : null;
}

export function resolveAnalyticsSourceId(config: DataConfig): string | null {
  return normalizeAnalyticsSourceId(config.analytics.sourceId);
}

export async function readAnalyticsSourceId(): Promise<string | null> {
  const config = await getEffectiveDataConfig();
  return resolveAnalyticsSourceId(config);
}

export function readAnalyticsIngestSecret(): string | null {
  return readInstanceSecret();
}
