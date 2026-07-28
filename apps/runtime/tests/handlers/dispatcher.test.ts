/**
 * @file dispatcher.test.ts
 * @description
 * [EN] Route dispatcher regression tests.
 * Verifies direct redirects, sequential proxy fallback, and static asset proxy races.
 *
 * [CN] 路由分发器回归测试。
 * 验证直接重定向、顺序代理回退和静态资源代理竞速行为。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeOptions } from "../../src/lib/handlers/configuration/loader";
import { dispatchRouteRequest } from "../../src/lib/handlers/routing/dispatcher";
import { buildCompiledList } from "../../src/lib/handlers/routing/matcher";
import type { ResolvedRuntime } from "../../src/lib/handlers/core/types";

function createRuntime(fetchImpl: typeof fetch = fetch): ResolvedRuntime {
  return resolveRuntimeOptions({
    configUrl: "https://config.example/redirects.json",
    dataConfigUrl: null,
    fetchImpl,
    provider: "cloudflare",
    now: () => Date.now(),
    random: () => 0
  });
}

test("dispatches an exact redirect with match metadata", async () => {
  const compiledList = buildCompiledList({
    "/docs": {
      type: "exact",
      target: "https://example.com/guide",
      appendPath: false,
      status: 307
    }
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/docs"),
    runtime: createRuntime(),
    compiledList,
    effectivePath: "/docs",
    search: "",
    isStaticAssetPath: false
  });

  assert.ok(result.match);
  assert.equal(result.match.response.status, 307);
  assert.equal(result.match.response.headers.get("location"), "https://example.com/guide");
  assert.equal(result.match.routePath, "/docs");
  assert.equal(result.match.matchKind, "exact");
  assert.equal(result.proxyFailureReason, null);
});

test("prefers literal and parameter routes over broader patterns", async () => {
  const compiledList = buildCompiledList({
    "/users/:identifier": {
      type: "exact",
      target: "https://parameter.example/:identifier",
      appendPath: false
    },
    "/users/me": {
      type: "exact",
      target: "https://literal.example/profile",
      appendPath: false
    },
    "/users/*": {
      type: "exact",
      target: "https://wildcard.example/$1",
      appendPath: false
    }
  });

  const literal = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/users/me"),
    runtime: createRuntime(),
    compiledList,
    effectivePath: "/users/me",
    search: "",
    isStaticAssetPath: false
  });
  const parameter = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/users/someone"),
    runtime: createRuntime(),
    compiledList,
    effectivePath: "/users/someone",
    search: "",
    isStaticAssetPath: false
  });

  assert.equal(literal.match?.response.headers.get("location"), "https://literal.example/profile");
  assert.equal(literal.match?.matchKind, "exact");
  assert.equal(parameter.match?.response.headers.get("location"), "https://parameter.example/someone");
  assert.equal(parameter.match?.matchKind, "parameterized");
});

test("falls through failed proxies in priority order", async () => {
  const requests: string[] = [];
  let discardedResponses = 0;
  const runtime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request.url);

    return request.url.startsWith("https://first.example/")
      ? new Response(new ReadableStream({
          cancel() {
            discardedResponses += 1;
          }
        }), { status: 404 })
      : new Response("fallback", { status: 200 });
  });
  const compiledList = buildCompiledList({
    "/assets": [
      { type: "proxy", target: "https://first.example", priority: 1 },
      { type: "proxy", target: "https://second.example", priority: 2 }
    ]
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/assets/app.js"),
    runtime,
    compiledList,
    effectivePath: "/assets/app.js",
    search: "",
    isStaticAssetPath: false
  });

  assert.deepEqual(requests, [
    "https://first.example/app.js",
    "https://second.example/app.js"
  ]);
  assert.ok(result.match);
  assert.equal(await result.match.response.text(), "fallback");
  assert.equal(result.match.rule.target, "https://second.example");
  assert.equal(result.proxyFailureReason, null);
  assert.equal(discardedResponses, 1);
});

test("classifies exhausted proxy not-found responses separately from outages", async () => {
  const runtime = createRuntime(async () => new Response("missing", { status: 404 }));
  const compiledList = buildCompiledList({
    "/assets": [
      { type: "proxy", target: "https://first.example", priority: 1 },
      { type: "proxy", target: "https://second.example", priority: 2 }
    ]
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/assets/app.js"),
    runtime,
    compiledList,
    effectivePath: "/assets/app.js",
    search: "",
    isStaticAssetPath: false
  });

  assert.equal(result.match, null);
  assert.equal(result.proxyFailureReason, "not_found");
});

test("lets an unavailable proxy dominate mixed exhausted responses", async () => {
  const runtime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    return request.url.startsWith("https://first.example/")
      ? new Response("missing", { status: 404 })
      : new Response("unavailable", { status: 503 });
  });
  const compiledList = buildCompiledList({
    "/assets": [
      { type: "proxy", target: "https://first.example", priority: 1 },
      { type: "proxy", target: "https://second.example", priority: 2 }
    ]
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/assets/app.js"),
    runtime,
    compiledList,
    effectivePath: "/assets/app.js",
    search: "",
    isStaticAssetPath: false
  });

  assert.equal(result.match, null);
  assert.equal(result.proxyFailureReason, "unavailable");
});

test("races static asset proxies and returns a successful candidate", async () => {
  const requests: string[] = [];
  const runtime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request.url);

    return request.url.startsWith("https://first.example/")
      ? new Response("unavailable", { status: 503 })
      : new Response("asset", { status: 200 });
  });
  const compiledList = buildCompiledList({
    "/assets": [
      { type: "proxy", target: "https://first.example", priority: 1 },
      { type: "proxy", target: "https://second.example", priority: 2 }
    ]
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/assets/app.js"),
    runtime,
    compiledList,
    effectivePath: "/assets/app.js",
    search: "",
    isStaticAssetPath: true
  });

  assert.deepEqual(requests.sort(), [
    "https://first.example/app.js",
    "https://second.example/app.js"
  ]);
  assert.ok(result.match);
  assert.equal(await result.match.response.text(), "asset");
  assert.equal(result.match.rule.target, "https://second.example");
  assert.equal(result.proxyFailureReason, null);
});

test("preserves not-found classification when every raced proxy returns 404", async () => {
  const runtime = createRuntime(async () => new Response("missing", { status: 404 }));
  const compiledList = buildCompiledList({
    "/assets": [
      { type: "proxy", target: "https://first.example", priority: 1 },
      { type: "proxy", target: "https://second.example", priority: 2 }
    ]
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/assets/app.js"),
    runtime,
    compiledList,
    effectivePath: "/assets/app.js",
    search: "",
    isStaticAssetPath: true
  });

  assert.equal(result.match, null);
  assert.equal(result.proxyFailureReason, "not_found");
});

test("aborts slower proxy candidates after the race has a winner", async () => {
  let didAbortSlowerCandidate = false;
  const runtime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    if (request.url.startsWith("https://first.example/")) {
      return new Response("asset", { status: 200 });
    }

    return new Promise<Response>((_resolve, reject) => {
      request.signal.addEventListener("abort", () => {
        didAbortSlowerCandidate = true;
        reject(request.signal.reason);
      }, { once: true });
    });
  });
  const compiledList = buildCompiledList({
    "/assets": [
      { type: "proxy", target: "https://first.example", priority: 1 },
      { type: "proxy", target: "https://second.example", priority: 2 }
    ]
  });

  const result = await dispatchRouteRequest({
    request: new Request("https://i0c.cc/assets/app.js"),
    runtime,
    compiledList,
    effectivePath: "/assets/app.js",
    search: "",
    isStaticAssetPath: true
  });

  assert.equal(result.match?.rule.target, "https://first.example");
  assert.equal(didAbortSlowerCandidate, true);
});
