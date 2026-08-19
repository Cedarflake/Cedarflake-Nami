/**
 * @file analytics-contract.test.ts
 * @description
 * [EN] Cross-project tests for the Runtime event and WebUI Collector contract.
 * Verifies V2 normalization, bounded domains and classifications, and V1 compatibility.
 *
 * [CN] Runtime 事件与 WebUI Collector 契约的跨项目测试。
 * 验证 V2 归一化、受控域名与分类字段，以及 V1 兼容性。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAnalyticsEvent } from "../../../webui/src/lib/analytics/event-normalization";
import { analyticsEventSchema } from "../../../webui/src/lib/analytics/event-schema";

const baseEvent = {
  schemaVersion: 2,
  eventId: "f5a4d47d-cd9d-4e3d-9bee-4f98b4e7e356",
  occurredAt: "2026-07-20T00:00:00.000Z",
  sourceId: "i0c.cc",
  entryDomain: "VC.I0C.CC.",
  provider: "vercel",
  statusCode: 302,
  trafficClass: "browser_like",
  botCategory: "none",
  botConfidence: "none",
  classifierVersion: 1,
  resourceClass: "document",
  deviceType: "desktop",
  countryCode: "CN",
  sampleRate: 1,
  latencyMs: 12,
  probeCategory: "none"
} as const;

test("accepts and normalizes a Runtime V2 link event", () => {
  const parsed = analyticsEventSchema.parse({
    ...baseEvent,
    eventKind: "link",
    analyticsId: "route_1",
    routePath: "/r",
    linkType: "redirect",
    matchKind: "prefix",
    matchOutcome: "matched",
    referrerDomain: "example.com",
    campaignId: "docs-launch"
  });
  const normalized = normalizeAnalyticsEvent(parsed, "i0c.cc");

  assert.equal(normalized.eventKind, "link");
  assert.equal(normalized.entryDomain, "vc.i0c.cc");
  assert.equal(normalized.campaignId, "docs-launch");
  assert.equal(normalized.sampleRate, 1);
});

test("accepts a bounded third-party Runtime provider", () => {
  const parsed = analyticsEventSchema.parse({
    ...baseEvent,
    provider: "external-edge",
    eventKind: "runtime",
    matchKind: "unmatched",
    matchOutcome: "not_found",
    statusCode: 404,
    sampleRate: 0.1
  });

  assert.equal(parsed.provider, "external-edge");
});

test("bounds untrusted entry and upstream domains to the source namespace", () => {
  const parsed = analyticsEventSchema.parse({
    ...baseEvent,
    eventKind: "link",
    entryDomain: "outside.example",
    analyticsId: "route_2",
    routePath: "/next",
    linkType: "redirect",
    matchKind: "exact",
    matchOutcome: "matched",
    upstreamEventId: "9ce71ed6-8e8d-4f4e-969f-c1099f0f5df9",
    upstreamAnalyticsId: "route_1",
    upstreamEntryDomain: "outside.example",
    upstreamProvider: "cloudflare"
  });
  const normalized = normalizeAnalyticsEvent(parsed, "i0c.cc");

  assert.equal(normalized.eventKind, "link");
  assert.equal(normalized.entryDomain, "unknown");
  assert.equal(normalized.upstreamEntryDomain, "unknown");
});

test("rejects mixed campaign and upstream attribution", () => {
  const parsed = analyticsEventSchema.safeParse({
    ...baseEvent,
    eventKind: "link",
    analyticsId: "route_2",
    routePath: "/next",
    linkType: "redirect",
    matchKind: "exact",
    matchOutcome: "matched",
    campaignId: "docs-launch",
    upstreamEventId: "9ce71ed6-8e8d-4f4e-969f-c1099f0f5df9",
    upstreamAnalyticsId: "route_1",
    upstreamEntryDomain: "api.i0c.cc",
    upstreamProvider: "cloudflare"
  });

  assert.equal(parsed.success, false);
});

test("rejects inconsistent V2 bot classifications", () => {
  const parsed = analyticsEventSchema.safeParse({
    ...baseEvent,
    eventKind: "runtime",
    matchKind: "unmatched",
    matchOutcome: "not_found",
    statusCode: 404,
    trafficClass: "suspected_automation",
    botCategory: "none",
    botConfidence: "none",
    deviceType: "desktop",
    sampleRate: 0.1
  });

  assert.equal(parsed.success, false);
});

test("rejects inconsistent Runtime match classifications", () => {
  const unmatchedAsSystem = analyticsEventSchema.safeParse({
    ...baseEvent,
    eventKind: "runtime",
    matchKind: "system",
    matchOutcome: "not_found",
    statusCode: 404,
    sampleRate: 0.1
  });
  const systemAsUnmatched = analyticsEventSchema.safeParse({
    ...baseEvent,
    eventKind: "runtime",
    matchKind: "unmatched",
    matchOutcome: "internal_error",
    statusCode: 500,
    sampleRate: 0.1
  });

  assert.equal(unmatchedAsSystem.success, false);
  assert.equal(systemAsUnmatched.success, false);
});

test("rejects Runtime status codes that contradict their outcomes", () => {
  const parsed = analyticsEventSchema.safeParse({
    ...baseEvent,
    eventKind: "runtime",
    matchKind: "unmatched",
    matchOutcome: "proxy_exhausted",
    statusCode: 404,
    sampleRate: 0.1
  });

  assert.equal(parsed.success, false);
});

test("continues to normalize legacy V1 link events", () => {
  const parsed = analyticsEventSchema.parse({
    eventId: "f5a4d47d-cd9d-4e3d-9bee-4f98b4e7e356",
    occurredAt: "2026-07-20T00:00:00.000Z",
    sourceId: "i0c.cc",
    analyticsId: "route_1",
    path: "/r",
    linkType: "redirect",
    statusCode: 302,
    outcome: "matched",
    requestClass: "human",
    isBot: false,
    isPreview: false,
    deviceType: "desktop",
    countryCode: "CN",
    provider: "cloudflare",
    latencyMs: 8
  });
  const normalized = normalizeAnalyticsEvent(parsed, "i0c.cc");

  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.eventKind, "link");
  assert.equal(normalized.entryDomain, "unknown");
  assert.equal(normalized.trafficClass, "browser_like");
});
