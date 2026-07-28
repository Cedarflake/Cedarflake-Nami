/**
 * @file response-security.test.ts
 * @description
 * [EN] Proxy response security regression tests.
 * Verifies transparent header forwarding, proxy host validation, and bounded upstream redirects.
 *
 * [CN] 代理响应安全回归测试。
 * 验证透明请求头转发、代理主机校验以及有界的上游重定向处理。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeOptions } from "../../src/lib/handlers/configuration/loader";
import { respondUsingRule } from "../../src/lib/handlers/routing/response";
import type { NormalizedRule, ResolvedRuntime } from "../../src/lib/handlers/core/types";

const proxyRule: NormalizedRule = {
  type: "proxy",
  target: "https://example.com",
  appendPath: true,
  status: 302,
  priority: 0
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

test("preserves application headers while removing hop-by-hop headers", async () => {
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
      Origin: "https://app.example",
      "Proxy-Authorization": "Basic secret",
      Referer: "https://app.example/page",
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
    "connection",
    "host",
    "keep-alive",
    "proxy-authorization",
    "x-remove-me"
  ]) {
    assert.equal(forwarded.headers.get(name), null, name);
  }
  assert.equal(forwarded.headers.get("authorization"), "Bearer secret");
  assert.equal(forwarded.headers.get("cf-connecting-ip"), "203.0.113.10");
  assert.equal(forwarded.headers.get("cf-ipcountry"), "US");
  assert.equal(forwarded.headers.get("cookie"), "session=secret");
  assert.equal(forwarded.headers.get("forwarded"), "for=203.0.113.10");
  assert.equal(forwarded.headers.get("origin"), "https://app.example");
  assert.equal(forwarded.headers.get("referer"), "https://app.example/page");
  assert.equal(forwarded.headers.get("true-client-ip"), "203.0.113.10");
  assert.equal(forwarded.headers.get("x-nf-client-connection-ip"), "203.0.113.10");
  assert.equal(forwarded.headers.get("x-real-ip"), "203.0.113.10");
  assert.equal(forwarded.headers.get("x-vercel-ip-country"), "US");
  assert.equal(forwarded.headers.get("x-forwarded-for"), "203.0.113.10");
  assert.equal(forwarded.headers.get("x-forwarded-host"), "i0c.cc");
  assert.equal(forwarded.headers.get("x-forwarded-proto"), "https");
  assert.equal(forwarded.headers.get("x-request-id"), "request-1");
});

test("drops credentials when an upstream redirect changes origin", async () => {
  const forwarded: Request[] = [];
  const runtime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    forwarded.push(request);
    return forwarded.length === 1
      ? new Response(null, {
        status: 302,
        headers: { Location: "https://redirected.example/final" }
      })
      : new Response(null, { status: 204 });
  });

  const response = await respondUsingRule(
    new Request("https://i0c.cc/proxy", {
      headers: {
        Authorization: "Bearer secret",
        Cookie: "session=secret",
        Origin: "https://app.example",
        Referer: "https://app.example/page"
      }
    }),
    proxyRule,
    "https://example.com/start",
    runtime,
    "/proxy"
  );

  assert.equal(response.status, 204);
  assert.equal(forwarded.length, 2);
  assert.equal(forwarded[0].headers.get("authorization"), "Bearer secret");
  assert.equal(forwarded[0].headers.get("cookie"), "session=secret");
  assert.equal(forwarded[1].headers.get("authorization"), null);
  assert.equal(forwarded[1].headers.get("cookie"), null);
  assert.equal(forwarded[1].headers.get("origin"), "https://app.example");
  assert.equal(forwarded[1].headers.get("referer"), "https://app.example/page");
});

test("preserves response security headers and separate cookies", async () => {
  const upstreamHeaders = new Headers({
    Connection: "keep-alive, X-Upstream-Hop",
    "Content-Security-Policy": "default-src 'self'",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Upstream-Hop": "remove-me"
  });
  upstreamHeaders.append(
    "Set-Cookie",
    "ri_visitor=0123456789abcdef0123456789abcdef; Domain=api.revaea.com; Path=/; HttpOnly"
  );
  upstreamHeaders.append("Set-Cookie", "theme=dark; Path=/");
  const runtime = createRuntime(async () => new Response(null, {
    status: 204,
    headers: upstreamHeaders
  }));

  const response = await respondUsingRule(
    new Request("https://i0c.cc/proxy"),
    proxyRule,
    "https://example.com/start",
    runtime,
    "/proxy"
  );
  const responseHeaders = response.headers as unknown as {
    getSetCookie(): string[];
  };

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("connection"), null);
  assert.equal(response.headers.get("x-upstream-hop"), null);
  assert.equal(
    response.headers.get("content-security-policy"),
    "default-src 'self'"
  );
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.deepEqual(responseHeaders.getSetCookie(), [
    "ri_visitor=0123456789abcdef0123456789abcdef; Path=/; HttpOnly",
    "theme=dark; Path=/"
  ]);
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
