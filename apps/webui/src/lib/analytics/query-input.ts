import { normalizeAnalyticsTimeZone } from "@nami/analytics-domain/range";

import {
  analyticsRanges,
  type AnalyticsQueryScope,
} from "./types";

export function parseAnalyticsQueryScope(
  searchParams: URLSearchParams,
  fallbackTimeZone?: string,
): AnalyticsQueryScope | null {
  const rangeValue = searchParams.get("range") ?? "30d";
  const range = analyticsRanges.find((candidate) => candidate === rangeValue);
  if (!range) {
    return null;
  }

  return {
    range,
    entryDomain: searchParams.get("entryDomain") ?? "all",
    timeZone: normalizeAnalyticsTimeZone(
      searchParams.get("timeZone") ?? fallbackTimeZone,
    ),
  };
}
