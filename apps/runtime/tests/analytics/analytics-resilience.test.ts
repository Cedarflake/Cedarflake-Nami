/**
 * @file analytics-resilience.test.ts
 * @description
 * [EN] Regression tests for analytics failure isolation.
 * Verifies that local analytics preparation never replaces an already resolved Runtime response.
 *
 * [CN] 统计故障隔离的回归测试。
 * 验证本地统计处理异常不会替换 Runtime 已经生成的响应。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  finalizeMatchedAnalytics,
  finalizeRuntimeAnalytics
} from "../../src/lib/handlers/analytics";
import type { AnalyticsRequestContext } from "../../src/lib/handlers/analytics";
import { resolveRuntimeOptions } from "../../src/lib/handlers/configuration/loader";
import type { NormalizedRule, ResolvedRuntime } from "../../src/lib/handlers/core/types";

const request = new Request("https://i0c.cc/r", {
  headers: { Accept: "text/html" }
});

const rule: NormalizedRule = {
  analyticsId: "7ca38115-22d0-4de6-be48-4e7c98010b0d",
  type: "exact",
  target: "https://example.com/",
  appendPath: false,
  status: 302,
  priority: 0
};

function createRuntime(overrides: Partial<ResolvedRuntime> = {}): ResolvedRuntime {
  return {
    ...resolveRuntimeOptions({
      configUrl: "https://example.com/redirects.json",
      dataConfigUrl: null,
      provider: "cloudflare",
      now: () => Date.now(),
      random: () => 0
    }),
    ...overrides
  };
}

function createAnalyticsContext(hasDelivery: boolean): AnalyticsRequestContext {
  return {
    sanitizedUrl: new URL(request.url),
    entryDomain: "i0c.cc",
    hasAttributionCookie: false,
    settings: {
      delivery: hasDelivery
        ? {
          endpoint: "https://u.i0c.cc/api/analytics/events",
          pluginId: "@i0c/analytics-sink-http",
          sourceId: "i0c.cc",
          writeKey: "0123456789abcdef0123456789abcdef"
        }
        : null,
      runtimeSampleRate: 0.1,
      sourceId: "i0c.cc",
      sourceHostname: "i0c.cc"
    }
  };
}

test("preserves a matched response when analytics finalization fails", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const response = Response.redirect("https://example.com/", 302);
  const runtime = createRuntime({
    now: () => {
      throw new Error("clock unavailable");
    }
  });

  const result = await finalizeMatchedAnalytics({
    request,
    response,
    rule,
    routePath: "/r",
    matchKind: "exact",
    effectivePath: "/r",
    startedAt: 0,
    runtime,
    analytics: createAnalyticsContext(false)
  });

  assert.strictEqual(result, response);
});

test("keeps redirects available when a non-critical feature hook fails", async (context) => {
  context.mock.method(console, "warn", () => undefined);
  const response = Response.redirect("https://example.com/", 302);
  let deliveryPromise: Promise<unknown> | undefined;
  const runtime = resolveRuntimeOptions({
    configUrl: "https://example.com/redirects.json",
    dataConfigUrl: null,
    provider: "cloudflare",
    now: () => Date.now(),
    random: () => 0,
    analyticsSink: {
      async emit() {}
    },
    runtimeFeatures: [{
      id: "@i0c/test-failing-feature",
      order: 1,
      timeoutMs: 50,
      failurePolicy: "continue",
      hooks: {
        onAnalyticsEvent() {
          throw new Error("expected feature failure");
        }
      }
    }],
    waitUntil(promise) {
      deliveryPromise = promise;
    }
  });

  const result = await finalizeMatchedAnalytics({
    request,
    response,
    rule,
    routePath: "/r",
    matchKind: "exact",
    effectivePath: "/r",
    startedAt: 0,
    runtime,
    analytics: createAnalyticsContext(false)
  });

  assert.strictEqual(result, response);
  assert.ok(deliveryPromise);
  await deliveryPromise;
});

test("preserves a runtime response when analytics sampling fails", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const response = new Response("Not Found", { status: 404 });
  const runtime = createRuntime({
    random: () => {
      throw new Error("random source unavailable");
    }
  });

  const result = await finalizeRuntimeAnalytics({
    request,
    response,
    outcome: "not_found",
    effectivePath: "/missing",
    startedAt: 0,
    runtime,
    analytics: createAnalyticsContext(true)
  });

  assert.strictEqual(result, response);
});

test("uses edge-compatible manual redirects for collector delivery", async () => {
  let deliveryPromise: Promise<unknown> | undefined;
  let redirectMode: RequestRedirect | undefined;
  const runtime = createRuntime({
    fetchImpl: async (_input, init) => {
      redirectMode = init?.redirect;
      return new Response(null, { status: 202 });
    },
    waitUntil: (promise) => {
      deliveryPromise = promise;
    }
  });
  const response = Response.redirect("https://example.com/", 302);

  const result = await finalizeMatchedAnalytics({
    request,
    response,
    rule,
    routePath: "/r",
    matchKind: "exact",
    effectivePath: "/r",
    startedAt: 0,
    runtime,
    analytics: createAnalyticsContext(true)
  });

  assert.strictEqual(result, response);
  assert.ok(deliveryPromise);
  await deliveryPromise;
  assert.equal(redirectMode, "manual");
});
