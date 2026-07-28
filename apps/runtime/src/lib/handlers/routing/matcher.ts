/**
 * @file matcher.ts
 * @description
 * [EN] Routing Engine & Matcher.
 * The core engine responsible for compiling routing rules into regex, flattening configuration slots,
 * and performing the actual pattern matching against request paths.
 *
 * [CN] 路由引擎与匹配器。
 * 核心引擎，负责将路由规则编译为正则、展平配置插槽（Slots），
 * 并针对请求路径执行实际的模式匹配。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { DEFAULT_STATUS } from "../core/constants";
import type { AnalyticsLinkMatchKind, CompiledEntry, NormalizedRule, RedirectsConfig, RouteConfig, RouteType, RouteValue, RouteValueEntry, SlotBranch } from "../core/types";
import { coerceRouteValues, isRecord, toRouteArray } from "../core/utils";

interface ResolvedRuleTarget {
  matchKind: AnalyticsLinkMatchKind;
  targetUrl: string;
}

const compiledListCache = new WeakMap<SlotBranch, CompiledEntry[]>();

function getRouteSegmentRank(segment: string): number {
  if (segment === "*") {
    return 0;
  }
  if (segment.startsWith(":")) {
    return 1;
  }
  return 2;
}

function compareRouteSpecificity(left: string, right: string): number {
  const leftSegments = left.split("/").filter(Boolean);
  const rightSegments = right.split("/").filter(Boolean);
  const sharedLength = Math.min(leftSegments.length, rightSegments.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const leftRank = getRouteSegmentRank(leftSegments[index]);
    const rightRank = getRouteSegmentRank(rightSegments[index]);
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }
  }

  return rightSegments.length - leftSegments.length;
}

export function getSlotSource(config: RedirectsConfig | null): SlotBranch | null {
  if (!config) {
    return null;
  }
  const slotCandidate = config.Slots ?? config.slots ?? config.SLOT;
  return isRecord(slotCandidate) ? slotCandidate : null;
}

export function flattenSlots(source: SlotBranch, out: Record<string, RouteValueEntry>): void {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("/")) {
      const additions = coerceRouteValues(value);
      if (!additions.length) {
        continue;
      }

      const existing = out[key];
      if (!existing) {
        out[key] = additions.length === 1 ? additions[0] : additions;
      } else {
        const existingList = Array.isArray(existing) ? existing : [existing];
        const combined = existingList.concat(additions);
        out[key] = combined.length === 1 ? combined[0] : combined;
      }
    } else if (isRecord(value)) {
      flattenSlots(value, out);
    }
  }
}

export function buildCompiledList(rulesIn: Record<string, RouteValueEntry>): CompiledEntry[] {
  const list: CompiledEntry[] = [];
  let sequence = 0;

  for (const [rawKey, rawValue] of Object.entries(rulesIn)) {
    let base = rawKey.startsWith("/") ? rawKey : `/${rawKey}`;
    if (base.length > 1 && base.endsWith("/")) {
      base = base.slice(0, -1);
    }

    const values = toRouteArray(rawValue);
    let fallbackPriority = 0;

    for (const entry of values) {
      fallbackPriority += 1;
      const rule = normaliseRule(entry, fallbackPriority);
      if (!rule) {
        continue;
      }

      const compiled = compilePattern(base);
      list.push({ base, rule, ...compiled, order: sequence });
      sequence += 1;
    }
  }

  list.sort((a, b) => {
    const specificity = compareRouteSpecificity(a.base, b.base);
    if (specificity !== 0) {
      return specificity;
    }
    if (a.rule.priority !== b.rule.priority) {
      return a.rule.priority - b.rule.priority;
    }
    return a.order - b.order;
  });
  return list;
}

export function getCompiledList(source: SlotBranch): CompiledEntry[] {
  const cached = compiledListCache.get(source);
  if (cached) {
    return cached;
  }

  const rules: Record<string, RouteValueEntry> = {};
  flattenSlots(source, rules);
  const compiled = buildCompiledList(rules);
  compiledListCache.set(source, compiled);
  return compiled;
}

function normaliseRule(value: RouteValue, fallbackPriority: number): NormalizedRule | null {
  if (typeof value === "string") {
    return value
      ? { type: "prefix", target: value, appendPath: true, status: DEFAULT_STATUS, priority: fallbackPriority }
      : null;
  }

  if (value && typeof value === "object") {
    const type: RouteType = value.type === "exact" ? "exact" : value.type === "proxy" ? "proxy" : "prefix";
    const targetValue = value.target ?? value.to ?? value.url;
    if (typeof targetValue !== "string" || !targetValue) {
      return null;
    }

    const appendPath = typeof value.appendPath === "boolean" ? value.appendPath : true;
    const parsedStatus = Number(value.status);
    const status = Number.isInteger(parsedStatus) && parsedStatus >= 200 && parsedStatus <= 599
      ? parsedStatus
      : DEFAULT_STATUS;
    const parsedPriority = Number((value as RouteConfig).priority);
    const priority = Number.isSafeInteger(parsedPriority) ? parsedPriority : fallbackPriority;
    const analyticsId = typeof value.analyticsId === "string" && value.analyticsId.trim()
      ? value.analyticsId.trim()
      : undefined;

    return { analyticsId, type, target: targetValue, appendPath, status, priority };
  }

  return null;
}

export function compilePattern(pattern: string): Pick<CompiledEntry, "regex" | "names" | "isParam"> {
  if (pattern === "/") {
    return { regex: /^\/$/, names: [], isParam: false };
  }

  const parts = pattern.split("/").slice(1);
  const names: string[] = [];
  let regexStr = "^";
  let isParam = false;

  for (const part of parts) {
    regexStr += "/";
    if (part === "*") {
      regexStr += "(.*)";
      isParam = true;
    } else if (part.startsWith(":")) {
      const name = part.slice(1);
      names.push(name);
      regexStr += "([^/]+)";
      isParam = true;
    } else {
      regexStr += part.replace(/([.*+?^=!:${}()|[\]\\])/g, "\\$1");
    }
  }

  regexStr += "$";
  return { regex: new RegExp(regexStr), names, isParam };
}

export function applyTemplate(target: string, match: RegExpMatchArray, names: string[]): string {
  const groups = match.slice(1);
  let output = String(target);

  output = output.replace(/\$(\d+)/g, (_, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    return groups[index] === undefined ? "" : groups[index];
  });

  output = output.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const index = names.indexOf(name);
    return index >= 0 && groups[index] !== undefined ? groups[index] : "";
  });

  return output;
}

export function resolvePrefixTarget(pathname: string, search: string, rule: NormalizedRule, base: string): string | null {
  const targetBase = String(rule.target);

  if (base === "/") {
    const rest = pathname === "/" ? "" : pathname;
    const resolved = rule.appendPath ? appendTargetPath(targetBase, rest) : targetBase;
    return appendOriginalQuery(resolved, search);
  }

  if (pathname === base || pathname.startsWith(`${base}/`)) {
    let rest = pathname.slice(base.length);
    rest = rest.startsWith("/") ? rest : rest ? `/${rest}` : "";
    const resolved = rule.appendPath ? appendTargetPath(targetBase, rest) : targetBase;
    return appendOriginalQuery(resolved, search);
  }

  return null;
}

export function appendOriginalQuery(target: string, search: string): string {
  if (!search) {
    return target;
  }

  const fragmentIndex = target.indexOf("#");
  const targetWithoutFragment = fragmentIndex >= 0 ? target.slice(0, fragmentIndex) : target;
  if (targetWithoutFragment.includes("?")) {
    return target;
  }

  const fragment = fragmentIndex >= 0 ? target.slice(fragmentIndex) : "";
  return `${targetWithoutFragment}${search}${fragment}`;
}

function appendTargetPath(target: string, path: string): string {
  if (!path) {
    return target;
  }

  const queryIndex = target.indexOf("?");
  const fragmentIndex = target.indexOf("#");
  const suffixIndex = [queryIndex, fragmentIndex]
    .filter((index) => index >= 0)
    .reduce((first, index) => Math.min(first, index), target.length);
  const targetPath = target.slice(0, suffixIndex).replace(/\/$/, "");
  return `${targetPath}${path}${target.slice(suffixIndex)}`;
}

export function resolveCompiledTarget(
  entry: CompiledEntry,
  pathname: string,
  search: string
): ResolvedRuleTarget | null {
  const match = pathname.match(entry.regex);
  let targetUrl: string | null = null;

  if (match) {
    const resolved = applyTemplate(entry.rule.target, match, entry.names);
    targetUrl = appendOriginalQuery(resolved, search);
  } else if ((entry.rule.type === "prefix" || entry.rule.type === "proxy") && !entry.isParam) {
    targetUrl = resolvePrefixTarget(pathname, search, entry.rule, entry.base);
  }

  if (!targetUrl) {
    return null;
  }

  return {
    targetUrl,
    matchKind: resolveMatchKind(entry)
  };
}

export function collectProxyRaceCandidates(
  compiledList: CompiledEntry[],
  startIndex: number,
  pathname: string,
  search: string
): { candidates: Array<{ base: string; matchKind: AnalyticsLinkMatchKind; rule: NormalizedRule; targetUrl: string }>; scanEnd: number } | null {
  const start = compiledList[startIndex];
  if (!start) {
    return null;
  }

  const { base } = start;
  const candidates: Array<{ base: string; matchKind: AnalyticsLinkMatchKind; rule: NormalizedRule; targetUrl: string }> = [];

  const maybeAdd = (entry: CompiledEntry): void => {
    if (!entry.rule.target) {
      return;
    }

    const resolved = resolveCompiledTarget(entry, pathname, search);
    if (resolved && entry.rule.type === "proxy") {
      candidates.push({
        base: entry.base,
        matchKind: resolved.matchKind,
        rule: entry.rule,
        targetUrl: resolved.targetUrl
      });
    }
  };

  maybeAdd(start);

  let scan = startIndex + 1;
  while (scan < compiledList.length) {
    const next = compiledList[scan];
    if (!next || next.base !== base) {
      break;
    }

    maybeAdd(next);
    scan += 1;
  }

  return { candidates, scanEnd: scan };
}

function resolveMatchKind(entry: CompiledEntry): AnalyticsLinkMatchKind {
  if (
    entry.base.split("/").includes("*") ||
    (entry.base === "/" && (entry.rule.type === "prefix" || entry.rule.type === "proxy"))
  ) {
    return "catch_all";
  }
  if (entry.isParam) {
    return "parameterized";
  }
  return entry.rule.type === "exact" ? "exact" : "prefix";
}
