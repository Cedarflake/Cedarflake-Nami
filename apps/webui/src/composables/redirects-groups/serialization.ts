'use client';

import {
  type RedirectEntry,
  type RedirectGroup,
  createEmptyEntry,
  isRedirectGroupEntry,
  isRecord,
  uniqueId
} from "./model";
import { ensureAnalyticsId } from "../editor/route-utils";

export type ParsedRedirectConfig = {
  slotsKey: string;
  baseConfig: Record<string, unknown>;
  rootGroup: RedirectGroup;
};

export class DuplicateRedirectKeyError extends Error {
  constructor(
    readonly key: string,
    readonly groupName: string,
  ) {
    super(`Duplicate key "${key}" in group "${groupName}".`);
    this.name = "DuplicateRedirectKeyError";
  }
}

export class InvalidRedirectConfigError extends Error {
  constructor(readonly reason: "json" | "root") {
    super(
      reason === "json"
        ? "Redirect config must contain valid JSON."
        : "Redirect config root must be a JSON object.",
    );
    this.name = "InvalidRedirectConfigError";
  }
}

function createAnalyticsIdentitySeed(
  groupPath: readonly string[],
  key: string,
  arrayIndex?: number,
): string {
  return JSON.stringify([
    "nami-analytics-id-v2",
    groupPath,
    key,
    arrayIndex ?? null,
  ]);
}

async function parseEntries(
  source: Record<string, unknown>,
  groupPath: readonly string[],
): Promise<RedirectEntry[]> {
  const entries: RedirectEntry[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (isRedirectGroupEntry(key, value)) {
      continue;
    }

    let hydratedValue: unknown = value;
    if (Array.isArray(value)) {
      const hydratedItems: unknown[] = [];
      for (const [index, item] of value.entries()) {
        hydratedItems.push(
          isRecord(item)
            ? await ensureAnalyticsId(
                item,
                createAnalyticsIdentitySeed(groupPath, key, index),
              )
            : item,
        );
      }
      hydratedValue = hydratedItems;
    } else if (isRecord(value)) {
      hydratedValue = await ensureAnalyticsId(
        value,
        createAnalyticsIdentitySeed(groupPath, key),
      );
    }

    entries.push({ id: uniqueId(), key, value: hydratedValue });
  }

  return entries;
}

async function parseGroup(
  name: string,
  source: Record<string, unknown>,
  parentPath: readonly string[],
): Promise<RedirectGroup> {
  const groupPath = [...parentPath, name];
  const entries = await parseEntries(source, groupPath);
  const children: RedirectGroup[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (isRedirectGroupEntry(key, value)) {
      children.push(await parseGroup(key, value, groupPath));
    }
  }

  if (entries.length === 0 && children.length === 0) {
    entries.push(createEmptyEntry());
  }

  return { id: uniqueId(), name, entries, children };
}

export async function parseInitialContent(source: string): Promise<ParsedRedirectConfig> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new InvalidRedirectConfigError("json");
  }

  if (!isRecord(parsed)) {
    throw new InvalidRedirectConfigError("root");
  }

  const config = parsed;
  const slotKeys = ["Slots", "slots", "SLOT"] as const;
  const detectedKey = slotKeys.find((key) => key in config && isRecord(config[key]));
  const slotsKey = detectedKey ?? "slots";
  const rawSlots = isRecord(config[slotsKey]) ? (config[slotsKey] as Record<string, unknown>) : {};

  const baseConfig = Object.fromEntries(Object.entries(config).filter(([key]) => key !== slotsKey));

  return {
    slotsKey,
    baseConfig,
    rootGroup: await parseGroup(slotsKey, rawSlots, []),
  };
}

function buildGroupObject(group: RedirectGroup): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const usedKeys = new Set<string>();

  function assign(key: string, value: unknown) {
    if (usedKeys.has(key)) {
      throw new DuplicateRedirectKeyError(key, group.name);
    }
    usedKeys.add(key);
    result[key] = value;
  }

  group.entries.forEach((entry) => {
    const key = entry.key.trim();
    if (!key) {
      return;
    }
    assign(key, entry.value);
  });

  group.children.forEach((child) => {
    const name = child.name.trim();
    if (!name) {
      return;
    }
    assign(name, buildGroupObject(child));
  });

  return result;
}

export function buildConfig(rootGroup: RedirectGroup, baseConfig: Record<string, unknown>, slotsKey: string) {
  return { ...baseConfig, [slotsKey]: buildGroupObject(rootGroup) };
}
