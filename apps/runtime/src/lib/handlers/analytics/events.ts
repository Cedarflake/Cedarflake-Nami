/**
 * @file events.ts
 * @description
 * [EN] Owns Analytics V2 event contracts, request classification, and deterministic event construction.
 * Keeps link and runtime payload shaping separate from delivery and request orchestration.
 *
 * [CN] 管理 Analytics V2 事件契约、请求分类以及确定性的事件构建。
 * 将链接与运行时载荷塑形从投递和请求编排中分离。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import {
  normalizeAnalyticsHostname
} from "./attribution";
import type { VerifiedAttributionToken } from "./attribution";
import type {
  AnalyticsBotCategory,
  AnalyticsBotConfidence,
  AnalyticsDeviceType,
  AnalyticsLinkMatchKind,
  AnalyticsProbeCategory,
  AnalyticsProvider,
  AnalyticsResourceClass,
  AnalyticsRuntimeOutcome,
  AnalyticsTrafficClass,
  AnalyticsUpstreamAttribution,
  NormalizedRule,
  ResolvedRuntime
} from "../core/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERRER_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

interface AnalyticsEventBaseV2 {
  schemaVersion: 2;
  eventKind: "link" | "runtime";
  eventId: string;
  occurredAt: string;
  sourceId: string;
  entryDomain: string;
  provider: AnalyticsProvider;
  statusCode: number;
  trafficClass: AnalyticsTrafficClass;
  botCategory: AnalyticsBotCategory;
  botConfidence: AnalyticsBotConfidence;
  classifierVersion: 1;
  resourceClass: AnalyticsResourceClass;
  deviceType: AnalyticsDeviceType;
  countryCode?: string;
  sampleRate: number;
  latencyMs: number;
  probeCategory: AnalyticsProbeCategory;
}

interface LinkAnalyticsEventFields {
  eventKind: "link";
  analyticsId: string;
  routePath: string;
  linkType: "redirect" | "proxy";
  matchKind: AnalyticsLinkMatchKind;
  matchOutcome: "matched";
  referrerDomain?: string;
}

type LinkAttributionFields =
  | {
    campaignId: string;
    upstreamEventId?: never;
    upstreamAnalyticsId?: never;
    upstreamEntryDomain?: never;
    upstreamProvider?: never;
  }
  | ({ campaignId?: never } & AnalyticsUpstreamAttribution)
  | {
    campaignId?: never;
    upstreamEventId?: never;
    upstreamAnalyticsId?: never;
    upstreamEntryDomain?: never;
    upstreamProvider?: never;
  };

export type LinkAnalyticsEventV2 = AnalyticsEventBaseV2
  & LinkAnalyticsEventFields
  & LinkAttributionFields;

export interface RuntimeAnalyticsEventV2 extends AnalyticsEventBaseV2 {
  eventKind: "runtime";
  matchKind: "unmatched" | "system";
  matchOutcome: AnalyticsRuntimeOutcome;
}

export type AnalyticsEventV2 = LinkAnalyticsEventV2 | RuntimeAnalyticsEventV2;

interface MatchedEventInput {
  request: Request;
  response: Response;
  rule: NormalizedRule;
  routePath: string;
  matchKind: AnalyticsLinkMatchKind;
  effectivePath: string;
  startedAt: number;
  completedAt: number;
  runtime: ResolvedRuntime;
  entryDomain: string;
  sourceId: string;
  attribution?: VerifiedAttributionToken;
}

interface RuntimeEventInput {
  request: Request;
  response: Response;
  outcome: AnalyticsRuntimeOutcome;
  effectivePath: string;
  startedAt: number;
  completedAt: number;
  runtime: ResolvedRuntime;
  entryDomain: string;
  sourceId: string;
  sampleRate: number;
}

export async function createMatchedAnalyticsEvent(
  input: MatchedEventInput
): Promise<LinkAnalyticsEventV2> {
  const analyticsId = await resolveAnalyticsId(input.routePath, input.rule);
  const attribution = resolveAttributionForRule(input.attribution, analyticsId);
  const classification = await classifyRequest(
    input.runtime,
    input.request,
    input.effectivePath
  );
  const eventId = globalThis.crypto.randomUUID();
  return {
    ...createEventBase({
      eventKind: "link",
      eventId,
      request: input.request,
      effectivePath: input.effectivePath,
      response: input.response,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      runtime: input.runtime,
      entryDomain: input.entryDomain,
      sourceId: input.sourceId,
      sampleRate: 1,
      classification
    }),
    eventKind: "link",
    analyticsId,
    routePath: input.routePath,
    linkType: input.rule.type === "proxy" ? "proxy" : "redirect",
    matchKind: input.matchKind,
    matchOutcome: "matched",
    ...resolveReferrerField(input.request),
    ...resolveAttributionFields(attribution)
  };
}

export async function createRuntimeAnalyticsEvent(
  input: RuntimeEventInput
): Promise<RuntimeAnalyticsEventV2> {
  const classification = await classifyRequest(
    input.runtime,
    input.request,
    input.effectivePath
  );
  return {
    ...createEventBase({
      eventKind: "runtime",
      eventId: globalThis.crypto.randomUUID(),
      request: input.request,
      effectivePath: input.effectivePath,
      response: input.response,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      runtime: input.runtime,
      entryDomain: input.entryDomain,
      sourceId: input.sourceId,
      sampleRate: input.sampleRate,
      classification
    }),
    eventKind: "runtime",
    matchKind: input.outcome === "not_found" || input.outcome === "proxy_exhausted" ? "unmatched" : "system",
    matchOutcome: input.outcome
  };
}

async function classifyRequest(
  runtime: ResolvedRuntime,
  request: Request,
  effectivePath: string
): Promise<{
  botCategory: AnalyticsBotCategory;
  botConfidence: AnalyticsBotConfidence;
  deviceType: AnalyticsDeviceType;
  probeCategory: AnalyticsProbeCategory;
  resourceClass: AnalyticsResourceClass;
  trafficClass: AnalyticsTrafficClass;
}> {
  const result = await runtime.featurePipeline.onAnalyticsEvent({
    request,
    pathname: effectivePath,
    classification: {
      botCategory: "none",
      botConfidence: "none",
      deviceType: "unknown",
      probeCategory: "none",
      resourceClass: "unknown",
      trafficClass: "unknown"
    }
  });
  return result.classification;
}

function createEventBase(input: {
  eventKind: "link" | "runtime";
  eventId: string;
  request: Request;
  effectivePath: string;
  response: Response;
  startedAt: number;
  completedAt: number;
  runtime: ResolvedRuntime;
  entryDomain: string;
  sourceId: string;
  sampleRate: number;
  classification: Awaited<ReturnType<typeof classifyRequest>>;
}): AnalyticsEventBaseV2 {
  const countryCode = resolveCountryCode(input.request, input.runtime.country);
  return {
    schemaVersion: 2,
    eventKind: input.eventKind,
    eventId: input.eventId,
    occurredAt: new Date(input.completedAt).toISOString(),
    sourceId: input.sourceId,
    entryDomain: input.entryDomain,
    provider: input.runtime.provider,
    statusCode: input.response.status,
    trafficClass: input.classification.trafficClass,
    botCategory: input.classification.botCategory,
    botConfidence: input.classification.botConfidence,
    classifierVersion: 1,
    resourceClass: input.classification.resourceClass,
    deviceType: input.classification.deviceType,
    ...(countryCode ? { countryCode } : {}),
    sampleRate: input.sampleRate,
    latencyMs: Math.min(3_600_000, Math.max(0, Math.round(input.completedAt - input.startedAt))),
    probeCategory: input.classification.probeCategory
  };
}

function resolveAttributionForRule(
  attribution: VerifiedAttributionToken | undefined,
  analyticsId: string
): VerifiedAttributionToken | undefined {
  if (!attribution) {
    return undefined;
  }
  if (attribution.kind === "campaign" && attribution.analyticsId !== analyticsId) {
    return undefined;
  }
  return attribution;
}

function resolveAttributionFields(
  attribution: VerifiedAttributionToken | undefined
): LinkAttributionFields {
  if (!attribution) {
    return {};
  }
  if (attribution.kind === "campaign") {
    return { campaignId: attribution.campaignId };
  }
  const upstream: AnalyticsUpstreamAttribution = {
    upstreamEventId: attribution.upstreamEventId,
    upstreamAnalyticsId: attribution.upstreamAnalyticsId,
    upstreamEntryDomain: attribution.upstreamEntryDomain,
    upstreamProvider: attribution.upstreamProvider
  };
  return upstream;
}

async function resolveAnalyticsId(path: string, rule: NormalizedRule): Promise<string> {
  if (rule.analyticsId && UUID_PATTERN.test(rule.analyticsId)) {
    return rule.analyticsId.toLowerCase();
  }
  const legacyIdentity = JSON.stringify([
    "legacy-v1",
    path,
    rule.type,
    rule.target,
    rule.appendPath,
    rule.status
  ]);
  return `legacy_${await createSha256(legacyIdentity)}`;
}

function resolveCountryCode(
  request: Request,
  configuredCountry: string | undefined
): string | undefined {
  const raw = configuredCountry
    ?? request.headers.get("cf-ipcountry")
    ?? request.headers.get("x-vercel-ip-country")
    ?? undefined;
  const normalized = raw?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function resolveReferrerField(request: Request): { referrerDomain?: string } {
  const raw = request.headers.get("referer") ?? request.headers.get("referrer");
  if (!raw) {
    return {};
  }
  try {
    const referrer = new URL(raw);
    if (referrer.protocol !== "https:" && referrer.protocol !== "http:") {
      return {};
    }
    const hostname = normalizeAnalyticsHostname(referrer.hostname);
    return hostname && REFERRER_DOMAIN_PATTERN.test(hostname)
      ? { referrerDomain: hostname }
      : {};
  } catch {
    return {};
  }
}

async function createSha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

function toHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
