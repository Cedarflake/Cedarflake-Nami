/**
 * @file response-security.test.ts
 * @description
 * [EN] Proxy response security regression tests.
 * Verifies proxy host validation and bounded, failure-safe upstream redirect handling.
 *
 * [CN] 代理响应安全回归测试。
 * 验证代理主机校验以及有界且可安全失败的上游重定向处理。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeOptions } from "../../src/lib/handlers/configuration/loader";
import { respondUsingRule } from "../../src/lib/handlers/routing/response";
import type { NormalizedRule, ResolvedRuntime } from "../../src/lib/handlers/core/types";

const proxyRule: NormalizedRule = {
  match: { type: "prefix" },
  action: {
    type: "proxy",
    target: "https://example.com",
    appendPath: true
  },
  priority: 0,
  sourceType: "proxy"
};

function createRuntime(fetchImpl: typeof fetch): ResolvedRuntime {
  return resolveRuntimeOptions({
    configUrl: "https://config.example/redirects.json",
    dataConfigUrl: null,
    fetchImpl,
    provider: "cloudflare",
    now: () => Date.now(),
    random: () => 0
  });
}

test("blocks non-public literal IP proxy targets", async (context) => {
  context.mock.method(console, "error", () => undefined);
  let fetchCalls = 0;
  const runtime = createRuntime(async () => {
    fetchCalls += 1;
    return new Response(null, { status: 204 });
  });

  for (const target of [
    "http://2130706433/",
    "http://localhost./",
    "http://10.0.0.1/",
    "http://100.64.0.1/",
    "http://169.254.169.254/",
    "http://172.16.0.1/",
    "http://192.0.2.1/",
    "http://192.88.99.1/",
    "http://192.168.0.1/",
    "http://198.18.0.1/",
    "http://198.51.100.1/",
    "http://203.0.113.1/",
    "http://224.0.0.1/",
    "http://[::]/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fc00::1]/",
    "http://[fd12::1]/",
    "http://[fe80::1]/",
    "http://[2001:db8::1]/",
    "http://[ff02::1]/"
  ]) {
    const response = await respondUsingRule(
      new Request("https://i0c.cc/proxy"),
      proxyRule,
      target,
      runtime,
      "/proxy"
    );

    assert.equal(response.status, 400, target);
  }

  assert.equal(fetchCalls, 0);
});

test("keeps public IPv6 and ordinary hostnames available", async () => {
  const forwardedUrls: string[] = [];
  const runtime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    forwardedUrls.push(request.url);
    return new Response(null, { status: 204 });
  });

  for (const target of [
    "https://1.1.1.1/health",
    "https://[2606:4700:4700::1111]/health",
    "https://feedback.example/health"
  ]) {
    const response = await respondUsingRule(
      new Request("https://i0c.cc/proxy"),
      proxyRule,
      target,
      runtime,
      "/proxy"
    );

    assert.equal(response.status, 204, target);
  }

  assert.deepEqual(forwardedUrls, [
    "https://1.1.1.1/health",
    "https://[2606:4700:4700::1111]/health",
    "https://feedback.example/health"
  ]);
});

test("strips credentials and platform client metadata before proxying", async () => {
  let forwarded: Request | undefined;
  const runtime = createRuntime(async (input) => {
    forwarded = input instanceof Request ? input : new Request(input);
    return new Response(null, { status: 204 });
  });
  const request = new Request("https://i0c.cc/proxy", {
    headers: {
      Authorization: "Bearer secret",
      "CF-Connecting-IP": "203.0.113.10",
      "CF-IPCountry": "US",
      Connection: "keep-alive, X-Remove-Me",
      Cookie: "session=secret",
      Forwarded: "for=203.0.113.10",
      Host: "attacker.example",
      "Keep-Alive": "timeout=5",
      "Proxy-Authorization": "Basic secret",
      "True-Client-IP": "203.0.113.10",
      "X-Nf-Client-Connection-IP": "203.0.113.10",
      "X-Real-IP": "203.0.113.10",
      "X-Vercel-IP-Country": "US",
      "X-Forwarded-For": "203.0.113.10",
      "X-Forwarded-Host": "attacker.example",
      "X-Forwarded-Proto": "http",
      "X-Remove-Me": "connection-specific",
      "X-Request-ID": "request-1"
    }
  });

  const response = await respondUsingRule(
    request,
    proxyRule,
    "https://example.com/upstream",
    runtime,
    "/proxy"
  );

  assert.equal(response.status, 204);
  assert.ok(forwarded);
  for (const name of [
    "authorization",
    "cf-connecting-ip",
    "cf-ipcountry",
    "connection",
    "cookie",
    "forwarded",
    "keep-alive",
    "proxy-authorization",
    "true-client-ip",
    "x-nf-client-connection-ip",
    "x-real-ip",
    "x-vercel-ip-country",
    "x-forwarded-for",
    "x-remove-me"
  ]) {
    assert.equal(forwarded.headers.get(name), null, name);
  }
  assert.equal(forwarded.headers.get("x-forwarded-host"), "i0c.cc");
  assert.equal(forwarded.headers.get("x-forwarded-proto"), "https");
  assert.equal(forwarded.headers.get("x-request-id"), "request-1");
});

test("applies Fetch method semantics when following upstream redirects", async () => {
  const postRequests: Array<{ body: string; contentType: string | null; method: string }> = [];
  let discardedRedirectResponses = 0;
  const postRuntime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    postRequests.push({
      body: await request.text(),
      contentType: request.headers.get("content-type"),
      method: request.method
    });
    return postRequests.length === 1
      ? new Response(new ReadableStream({
        cancel() {
          discardedRedirectResponses += 1;
        }
      }), { status: 302, headers: { Location: "/next" } })
      : new Response(null, { status: 204 });
  });

  const postResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "payload"
    }),
    proxyRule,
    "https://example.com/start",
    postRuntime,
    "/proxy"
  );

  assert.equal(postResponse.status, 204);
  assert.deepEqual(postRequests, [
    { body: "payload", contentType: "text/plain", method: "POST" },
    { body: "", contentType: null, method: "GET" }
  ]);
  assert.equal(discardedRedirectResponses, 1);

  const putRequests: Array<{ body: string; method: string }> = [];
  const putRuntime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    putRequests.push({ body: await request.text(), method: request.method });
    return putRequests.length === 1
      ? new Response(null, { status: 302, headers: { Location: "/next" } })
      : new Response(null, { status: 204 });
  });

  const putResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy", { method: "PUT", body: "payload" }),
    proxyRule,
    "https://example.com/start",
    putRuntime,
    "/proxy"
  );

  assert.equal(putResponse.status, 204);
  assert.deepEqual(putRequests, [
    { body: "payload", method: "PUT" },
    { body: "payload", method: "PUT" }
  ]);

  const patchRequests: Array<{ body: string; method: string }> = [];
  const patchRuntime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    patchRequests.push({ body: await request.text(), method: request.method });
    return patchRequests.length === 1
      ? new Response(null, { status: 303, headers: { Location: "/next" } })
      : new Response(null, { status: 204 });
  });

  const patchResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy", { method: "PATCH", body: "payload" }),
    proxyRule,
    "https://example.com/start",
    patchRuntime,
    "/proxy"
  );

  assert.equal(patchResponse.status, 204);
  assert.deepEqual(patchRequests, [
    { body: "payload", method: "PATCH" },
    { body: "", method: "GET" }
  ]);
});

test("preserves the public protocol and proxy base path in rewritten locations", async () => {
  let forwarded: Request | undefined;
  const runtime = createRuntime(async (input) => {
    forwarded = input instanceof Request ? input : new Request(input);
    return new Response(null, {
      status: 201,
      headers: { Location: "/done?value=1#result" }
    });
  });

  const response = await respondUsingRule(
    new Request("http://localhost:3000/proxy/start"),
    proxyRule,
    "https://example.com/start",
    runtime,
    "/proxy"
  );

  assert.ok(forwarded);
  assert.equal(forwarded.headers.get("x-forwarded-proto"), "http");
  assert.equal(response.headers.get("location"), "http://localhost:3000/proxy/done?value=1#result");
});

test("returns a gateway error for malformed upstream redirects", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const runtime = createRuntime(async () => new Response(null, {
    status: 302,
    headers: { Location: "http://[" }
  }));

  const response = await respondUsingRule(
    new Request("https://i0c.cc/proxy"),
    proxyRule,
    "https://example.com/start",
    runtime,
    "/proxy"
  );

  assert.equal(response.status, 502);
  assert.equal(await response.text(), "Bad Gateway: Unsafe upstream redirect.");
});

test("reports only upstream redirects that were followed", async () => {
  let fetchCalls = 0;
  const runtime = createRuntime(async () => {
    fetchCalls += 1;
    return new Response(null, {
      status: 302,
      headers: { Location: `https://example.com/${fetchCalls}` }
    });
  });

  const response = await respondUsingRule(
    new Request("https://i0c.cc/proxy"),
    proxyRule,
    "https://example.com/start",
    runtime,
    "/proxy"
  );

  assert.equal(fetchCalls, 6);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("x-proxy-redirects-followed"), "5");
});
