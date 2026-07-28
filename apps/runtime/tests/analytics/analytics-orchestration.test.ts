/**
 * @file analytics-orchestration.test.ts
 * @description
 * [EN] End-to-end regression tests for Runtime analytics orchestration.
 * Verifies configuration resolution and the delivered link and runtime event contracts.
 *
 * [CN] Runtime 统计编排的端到端回归测试。
 * 验证配置解析以及实际投递的链接与运行时事件契约。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { defaultDataConfig } from "@i0c/config";
import { HTTP_ANALYTICS_SINK_PLUGIN_ID } from "@i0c/plugin-analytics-sink-http/manifest";

import {
  finalizeMatchedAnalytics,
  finalizeRuntimeAnalytics,
  prepareAnalyticsRequest
} from "../../src/lib/handlers/analytics";
import type { AnalyticsRequestContext } from "../../src/lib/handlers/analytics";
import { resolveRuntimeOptions } from "../../src/lib/handlers/configuration/loader";
import type { NormalizedRule, ResolvedRuntime } from "../../src/lib/handlers/core/types";

const analyticsEndpoint = "https://u.i0c.cc/api/analytics/events";
const analyticsWriteKey = "0123456789abcdef0123456789abcdef";
const completedAt = 1_700_000_000_500;

const rule: NormalizedRule = {
  analyticsId: "7ca38115-22d0-4de6-be48-4e7c98010b0d",
  type: "exact",
  target: "https://example.com/",
  appendPath: false,
  status: 302,
  priority: 0
};

interface CapturedDelivery {
  endpoint: string;
  headers: Headers;
  event: Record<string, unknown>;
  redirect: RequestRedirect | undefined;
}

function createRequest(path = "/r"): Request {
  return new Request(`https://i0c.cc${path}`, {
    headers: {
      Accept: "text/html",
      Referer: "https://docs.example.com/start",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "CF-IPCountry": "us"
    }
  });
}

function createRuntime(overrides: Partial<ResolvedRuntime> = {}): ResolvedRuntime {
  return {
    ...resolveRuntimeOptions({
      configUrl: "https://example.com/redirects.json",
      dataConfigUrl: null,
      provider: "cloudflare",
      now: () => completedAt,
      random: () => 0
    }),
    ...overrides
  };
}

function createAnalyticsContext(writeKey = analyticsWriteKey): AnalyticsRequestContext {
  return {
    sanitizedUrl: new URL("https://i0c.cc/r"),
    entryDomain: "i0c.cc",
    hasAttributionCookie: false,
    settings: {
      delivery: {
        endpoint: analyticsEndpoint,
        pluginId: HTTP_ANALYTICS_SINK_PLUGIN_ID,
        sourceId: "i0c.cc",
        writeKey
      },
      runtimeSampleRate: 0.1,
      sourceId: "i0c.cc",
      sourceHostname: "i0c.cc"
    }
  };
}

function createDeliveryRuntime(): {
  runtime: ResolvedRuntime;
  getDelivery: () => CapturedDelivery | undefined;
  getDeliveryPromise: () => Promise<unknown> | undefined;
} {
  let delivery: CapturedDelivery | undefined;
  let deliveryPromise: Promise<unknown> | undefined;
  const runtime = createRuntime({
    fetchImpl: async (input, init) => {
      delivery = {
        endpoint: String(input),
        headers: new Headers(init?.headers),
        event: JSON.parse(String(init?.body)) as Record<string, unknown>,
        redirect: init?.redirect
      };
      return new Response(null, { status: 202 });
    },
    waitUntil: (promise) => {
      deliveryPromise = promise;
    }
  });

  return {
    runtime,
    getDelivery: () => delivery,
    getDeliveryPromise: () => deliveryPromise
  };
}

test("uses versioned analytics settings and reads only the Runtime write key binding", async () => {
  const request = createRequest();
  const runtime = createRuntime({
    envBindings: {
      ANALYTICS_ENDPOINT: "https://ignored.example/events",
      ANALYTICS_SOURCE_ID: "ignored.example",
      I0C_SECRET: analyticsWriteKey
    }
  });

  const analytics = await prepareAnalyticsRequest(request, runtime);

  assert.deepEqual(analytics.settings.delivery, {
    endpoint: analyticsEndpoint,
    pluginConfig: {
      maximumDeliveryAttempts: 2,
      requestTimeoutMs: 5_000
    },
    pluginId: HTTP_ANALYTICS_SINK_PLUGIN_ID,
    sourceId: "i0c.cc",
    writeKey: analyticsWriteKey
  });
  assert.equal(analytics.settings.sourceId, "i0c.cc");
  assert.equal(analytics.settings.sourceHostname, "i0c.cc");
  assert.equal(analytics.settings.runtimeSampleRate, 0.1);
  assert.ok(analytics.settings.attributionKey instanceof ArrayBuffer);
});

test("uses the HTTP sink plugin declaration for enablement, config, and secret mapping", async () => {
  const request = createRequest();
  const runtime = createRuntime({
    dataConfig: {
      ...defaultDataConfig,
      plugins: {
        [HTTP_ANALYTICS_SINK_PLUGIN_ID]: {
          enabled: true,
          config: {
            maximumDeliveryAttempts: 1
          },
          secrets: {
            writeKey: "CUSTOM_I0C_SECRET"
          }
        }
      }
    },
    envBindings: {
      CUSTOM_I0C_SECRET: analyticsWriteKey
    }
  });

  const analytics = await prepareAnalyticsRequest(request, runtime);

  assert.deepEqual(analytics.settings.delivery?.pluginConfig, {
    maximumDeliveryAttempts: 1
  });
  assert.equal(
    analytics.settings.delivery?.pluginId,
    HTTP_ANALYTICS_SINK_PLUGIN_ID
  );
  assert.equal(analytics.settings.delivery?.writeKey, analyticsWriteKey);

  runtime.dataConfig = {
    ...runtime.dataConfig,
    plugins: {
      [HTTP_ANALYTICS_SINK_PLUGIN_ID]: {
        enabled: false
      }
    }
  };

  const disabledAnalytics = await prepareAnalyticsRequest(request, runtime);
  assert.equal(disabledAnalytics.settings.delivery, null);
});

test("delivers events through an injected analytics sink without the default write key", async () => {
  let capturedEventKind: string | undefined;
  let capturedEndpoint: string | undefined;
  let capturedPluginSecret: string | undefined;
  let capturedWriteKey: string | undefined;
  let deliveryPromise: Promise<unknown> | undefined;
  const runtime = createRuntime({
    analyticsSink: {
      async emit(event, context) {
        capturedEventKind = event.eventKind;
        capturedEndpoint = context.endpoint;
        capturedPluginSecret = context.readSecret("PLUGIN_TOKEN");
        capturedWriteKey = context.writeKey;
      }
    },
    envBindings: {
      PLUGIN_TOKEN: "plugin-secret"
    },
    waitUntil: (promise) => {
      deliveryPromise = promise;
    }
  });

  const analytics = createAnalyticsContext();
  analytics.settings.delivery = null;

  await finalizeRuntimeAnalytics({
    request: createRequest("/missing"),
    response: new Response("missing", { status: 404 }),
    outcome: "not_found",
    effectivePath: "/missing",
    startedAt: completedAt - 10,
    runtime,
    analytics
  });

  assert.ok(deliveryPromise);
  await deliveryPromise;
  assert.equal(capturedEventKind, "runtime");
  assert.equal(capturedEndpoint, analyticsEndpoint);
  assert.equal(capturedPluginSecret, "plugin-secret");
  assert.equal(capturedWriteKey, undefined);
});

test("delivers the Analytics V2 link event contract", async () => {
  const request = createRequest();
  const response = Response.redirect("https://example.com/", 302);
  const { runtime, getDelivery, getDeliveryPromise } = createDeliveryRuntime();

  const result = await finalizeMatchedAnalytics({
    request,
    response,
    rule,
    routePath: "/r",
    matchKind: "exact",
    effectivePath: "/r",
    startedAt: completedAt - 500,
    runtime,
    analytics: createAnalyticsContext()
  });

  assert.strictEqual(result, response);
  const deliveryPromise = getDeliveryPromise();
  assert.ok(deliveryPromise);
  await deliveryPromise;
  const delivery = getDelivery();
  assert.ok(delivery);
  const { eventId, ...event } = delivery.event;
  assert.match(String(eventId), /^[0-9a-f-]{36}$/i);
  assert.deepEqual(event, {
    schemaVersion: 2,
    eventKind: "link",
    occurredAt: new Date(completedAt).toISOString(),
    sourceId: "i0c.cc",
    entryDomain: "i0c.cc",
    provider: "cloudflare",
    statusCode: 302,
    trafficClass: "browser_like",
    botCategory: "none",
    botConfidence: "none",
    classifierVersion: 1,
    resourceClass: "document",
    deviceType: "desktop",
    countryCode: "US",
    sampleRate: 1,
    latencyMs: 500,
    probeCategory: "none",
    analyticsId: rule.analyticsId,
    routePath: "/r",
    linkType: "redirect",
    matchKind: "exact",
    matchOutcome: "matched",
    referrerDomain: "docs.example.com"
  });
  assert.equal(delivery.endpoint, analyticsEndpoint);
  assert.equal(delivery.redirect, "manual");
  assert.equal(delivery.headers.get("x-analytics-timestamp"), "1700000000");
  assert.match(delivery.headers.get("x-analytics-signature") ?? "", /^sha256=[0-9a-f]{64}$/);
});

test("delivers the sampled Analytics V2 runtime event contract", async () => {
  const request = createRequest("/.env");
  const response = new Response("Not Found", { status: 404 });
  const { runtime, getDelivery, getDeliveryPromise } = createDeliveryRuntime();

  const result = await finalizeRuntimeAnalytics({
    request,
    response,
    outcome: "not_found",
    effectivePath: "/.env",
    startedAt: completedAt - 250,
    runtime,
    analytics: createAnalyticsContext()
  });

  assert.strictEqual(result, response);
  const deliveryPromise = getDeliveryPromise();
  assert.ok(deliveryPromise);
  await deliveryPromise;
  const delivery = getDelivery();
  assert.ok(delivery);
  assert.equal(delivery.event.eventKind, "runtime");
  assert.equal(delivery.event.matchKind, "unmatched");
  assert.equal(delivery.event.matchOutcome, "not_found");
  assert.equal(delivery.event.sampleRate, 0.1);
  assert.equal(delivery.event.latencyMs, 250);
  assert.equal(delivery.event.probeCategory, "env_file");
  assert.equal(delivery.event.analyticsId, undefined);
});

test("retries one transient collector failure", async () => {
  let deliveryAttempts = 0;
  let discardedResponses = 0;
  let deliveryPromise: Promise<unknown> | undefined;
  const runtime = createRuntime({
    fetchImpl: async () => {
      deliveryAttempts += 1;
      return new Response(new ReadableStream({
        cancel() {
          discardedResponses += 1;
        }
      }), { status: deliveryAttempts === 1 ? 503 : 202 });
    },
    waitUntil: (promise) => {
      deliveryPromise = promise;
    }
  });

  await finalizeMatchedAnalytics({
    request: createRequest(),
    response: Response.redirect("https://example.com/", 302),
    rule,
    routePath: "/r",
    matchKind: "exact",
    effectivePath: "/r",
    startedAt: completedAt - 500,
    runtime,
    analytics: createAnalyticsContext()
  });

  assert.ok(deliveryPromise);
  await deliveryPromise;
  assert.equal(deliveryAttempts, 2);
  assert.equal(discardedResponses, 2);
});

test("does not retry a rejected collector request", async (context) => {
  context.mock.method(console, "error", () => undefined);
  let deliveryAttempts = 0;
  let deliveryPromise: Promise<unknown> | undefined;
  const runtime = createRuntime({
    fetchImpl: async () => {
      deliveryAttempts += 1;
      return new Response(null, { status: 401 });
    },
    waitUntil: (promise) => {
      deliveryPromise = promise;
    }
  });

  await finalizeMatchedAnalytics({
    request: createRequest(),
    response: Response.redirect("https://example.com/", 302),
    rule,
    routePath: "/r",
    matchKind: "exact",
    effectivePath: "/r",
    startedAt: completedAt - 500,
    runtime,
    analytics: createAnalyticsContext()
  });

  assert.ok(deliveryPromise);
  await deliveryPromise;
  assert.equal(deliveryAttempts, 1);
});

test("reuses the imported delivery signing key", async () => {
  const subtle = globalThis.crypto.subtle;
  const originalImportKey = subtle.importKey;
  const writeKey = "abcdef0123456789abcdef0123456789";
  let importCount = 0;

  Object.defineProperty(subtle, "importKey", {
    configurable: true,
    value: (...args: unknown[]): Promise<CryptoKey> => {
      importCount += 1;
      return Reflect.apply(originalImportKey, subtle, args) as Promise<CryptoKey>;
    }
  });

  try {
    for (let index = 0; index < 2; index += 1) {
      const { runtime, getDeliveryPromise } = createDeliveryRuntime();
      await finalizeMatchedAnalytics({
        request: createRequest(),
        response: Response.redirect("https://example.com/", 302),
        rule,
        routePath: "/r",
        matchKind: "exact",
        effectivePath: "/r",
        startedAt: completedAt - 500,
        runtime,
        analytics: createAnalyticsContext(writeKey)
      });

      const deliveryPromise = getDeliveryPromise();
      assert.ok(deliveryPromise);
      await deliveryPromise;
    }
  } finally {
    Object.defineProperty(subtle, "importKey", {
      configurable: true,
      value: originalImportKey
    });
  }

  assert.equal(importCount, 1);
});
