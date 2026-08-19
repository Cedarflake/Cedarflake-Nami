/**
 * @file analytics-attribution.test.ts
 * @description
 * [EN] Contract tests for signed campaign and upstream analytics attribution.
 * Covers the WebUI-compatible token format, audience bounds, cleanup, and internal handoffs.
 *
 * [CN] 签名渠道与上游统计归因的契约测试。
 * 覆盖与 WebUI 兼容的 token 格式、受众边界、参数清理与内部交接。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_ATTRIBUTION_QUERY_PARAM,
  attachUpstreamAttribution,
  createAttributionToken,
  deriveAttributionHmacKey,
  extractAttributionQuery,
  verifyAttributionToken
} from "../../src/lib/handlers/analytics/attribution";

const attributionContext = "nami/analytics-attribution/v1";
const sourceId = "i0c.cc";
const writeKey = "analytics-test-write-key-0123456789";
const nowMilliseconds = Date.UTC(2026, 6, 20, 0, 0, 0);
const nowSeconds = Math.floor(nowMilliseconds / 1000);

function createWebuiCampaignToken(payload: Record<string, unknown>): string {
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const attributionKey = createHmac("sha256", writeKey)
    .update(attributionContext)
    .digest();
  const signature = createHmac("sha256", attributionKey)
    .update(payloadSegment)
    .digest("base64url");
  return `${payloadSegment}.${signature}`;
}

test("verifies the WebUI campaign token contract", async () => {
  const key = await deriveAttributionHmacKey(writeKey);
  const token = createWebuiCampaignToken({
    v: 1,
    kind: "campaign",
    campaignId: "docs-launch",
    sourceId,
    analyticsId: "route_1",
    audHost: "vc.i0c.cc",
    audPath: "/docs",
    iat: nowSeconds,
    exp: nowSeconds + 3600
  });

  const verified = await verifyAttributionToken(
    token,
    key,
    sourceId,
    new URL("https://vc.i0c.cc/docs?utm_source=test"),
    nowMilliseconds
  );

  assert.equal(verified?.kind, "campaign");
  assert.equal(verified?.campaignId, "docs-launch");
  assert.equal(verified?.analyticsId, "route_1");
});

test("rejects campaign tokens outside their audience and lifetime bounds", async () => {
  const key = await deriveAttributionHmacKey(writeKey);
  const token = createWebuiCampaignToken({
    v: 1,
    kind: "campaign",
    campaignId: "docs-launch",
    sourceId,
    analyticsId: "route_1",
    audHost: "i0c.cc",
    audPath: "/docs",
    iat: nowSeconds,
    exp: nowSeconds + 366 * 24 * 60 * 60
  });

  assert.equal(await verifyAttributionToken(
    token,
    key,
    sourceId,
    new URL("https://i0c.cc/docs"),
    nowMilliseconds
  ), null);
  assert.equal(await verifyAttributionToken(
    token,
    key,
    sourceId,
    new URL("https://nf.i0c.cc/docs"),
    nowMilliseconds
  ), null);
});

test("removes every reserved attribution parameter without changing other query values", () => {
  const extracted = extractAttributionQuery(new URL(
    `https://i0c.cc/r?keep=1&${ANALYTICS_ATTRIBUTION_QUERY_PARAM}=first&${ANALYTICS_ATTRIBUTION_QUERY_PARAM}=second#section`
  ));

  assert.equal(extracted.hasAttributionParameter, true);
  assert.equal(extracted.rawToken, undefined);
  assert.equal(extracted.sanitizedUrl.toString(), "https://i0c.cc/r?keep=1#section");
});

test("attaches a short-lived upstream token only to internal HTTPS redirects", async () => {
  const key = await deriveAttributionHmacKey(writeKey);
  const input = {
    upstreamEventId: "f5a4d47d-cd9d-4e3d-9bee-4f98b4e7e356",
    sourceId,
    upstreamAnalyticsId: "route_1",
    upstreamEntryDomain: "i0c.cc",
    upstreamProvider: "cloudflare" as const
  };
  const internal = await attachUpstreamAttribution(
    Response.redirect("https://nf.i0c.cc/next?keep=1", 302),
    new URL("https://i0c.cc/r"),
    sourceId,
    key,
    input,
    nowMilliseconds
  );
  const location = new URL(internal.headers.get("location") ?? "");
  const token = location.searchParams.get(ANALYTICS_ATTRIBUTION_QUERY_PARAM);
  location.searchParams.delete(ANALYTICS_ATTRIBUTION_QUERY_PARAM);

  assert.ok(token);
  assert.equal(location.searchParams.get("keep"), "1");
  assert.equal(internal.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await verifyAttributionToken(
    token,
    key,
    sourceId,
    location,
    nowMilliseconds
  ), {
    v: 1,
    kind: "upstream",
    upstreamEventId: input.upstreamEventId,
    sourceId,
    upstreamAnalyticsId: input.upstreamAnalyticsId,
    upstreamEntryDomain: input.upstreamEntryDomain,
    upstreamProvider: input.upstreamProvider,
    audHost: "nf.i0c.cc",
    audPath: "/next",
    iat: nowSeconds,
    exp: nowSeconds + 120
  });

  const external = await attachUpstreamAttribution(
    Response.redirect("https://example.com/next", 302),
    new URL("https://i0c.cc/r"),
    sourceId,
    key,
    input,
    nowMilliseconds
  );
  assert.equal(external.headers.get("location"), "https://example.com/next");
});
