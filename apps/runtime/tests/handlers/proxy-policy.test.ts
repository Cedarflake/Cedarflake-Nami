/**
 * @file proxy-policy.test.ts
 * @description
 * [EN] Explicit proxy-policy regression tests.
 * Verifies profile defaults, request and response controls, redirect boundaries, resource limits,
 * cache behavior, and shared configuration validation.
 *
 * [CN] 显式反向代理策略回归测试。
 * 验证预设默认值、请求与响应控制、跳转边界、资源限制、缓存行为和共享配置校验。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateRedirectsConfig,
  type ProxyPolicy
} from "@i0c/config";

import { resolveRuntimeOptions } from "../../src/lib/handlers/configuration/loader";
import type {
  NormalizedRule,
  ResolvedRuntime
} from "../../src/lib/handlers/core/types";
import { getSetCookieValues } from "../../src/lib/handlers/routing/proxy/headers";
import { resolveProxyPolicy } from "../../src/lib/handlers/routing/proxy/policy";
import { respondUsingRule } from "../../src/lib/handlers/routing/response";

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

function createProxyRule(policy?: ProxyPolicy): NormalizedRule {
  return {
    match: { type: "prefix" },
    action: {
      type: "proxy",
      target: "https://example.com",
      appendPath: true,
      policy
    },
    priority: 0,
    sourceType: "proxy"
  };
}

test("resolves safe profile defaults while keeping legacy rules compatible", () => {
  const legacy = resolveProxyPolicy(undefined);
  const isolated = resolveProxyPolicy({ profile: "isolated" });
  const asset = resolveProxyPolicy({ profile: "asset" });
  const trustedApi = resolveProxyPolicy({ profile: "trusted-api" });

  assert.equal(legacy.profile, "legacy");
  assert.equal(legacy.request.methods, null);
  assert.equal(legacy.request.origin, "target");
  assert.equal(legacy.response.securityHeaders, "strip");
  assert.equal(isolated.request.cookies.mode, "strip");
  assert.equal(isolated.cache.mode, "bypass");
  assert.deepEqual(isolated.redirects.allowedOrigins, []);
  assert.equal(asset.cache.mode, "public");
  assert.equal(asset.limits.maxRequestBodyBytes, 0);
  assert.ok(trustedApi.request.methods?.includes("POST"));
  assert.equal(trustedApi.request.origin, "preserve");
});

test("applies isolated request, response, and security defaults", async () => {
  let forwarded: Request | undefined;
  const upstreamHeaders = new Headers({
    Connection: "x-internal",
    "Content-Security-Policy": "default-src 'self'",
    "Keep-Alive": "timeout=5",
    "X-Internal": "secret",
    "X-Frame-Options": "DENY"
  });
  upstreamHeaders.append("Set-Cookie", "session=secret; Domain=example.com; Path=/");
  const runtime = createRuntime(async (input) => {
    forwarded = input instanceof Request ? input : new Request(input);
    return new Response("ok", { status: 200, headers: upstreamHeaders });
  });
  const request = new Request("https://i0c.cc/proxy", {
    headers: {
      Authorization: "Bearer secret",
      Cookie: "session=secret",
      Origin: "https://client.example",
      Referer: "https://client.example/page"
    }
  });

  const response = await respondUsingRule(
    request,
    createProxyRule({ profile: "isolated" }),
    "https://example.com/upstream",
    runtime,
    "/proxy"
  );

  assert.ok(forwarded);
  assert.equal(forwarded.headers.get("authorization"), null);
  assert.equal(forwarded.headers.get("cookie"), null);
  assert.equal(forwarded.headers.get("origin"), null);
  assert.equal(forwarded.headers.get("referer"), null);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'self'");
  assert.equal(response.headers.get("keep-alive"), null);
  assert.equal(response.headers.get("x-internal"), null);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.deepEqual(getSetCookieValues(response.headers), []);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-upstream-status"), null);
});

test("allowlists request and response cookies without folding Set-Cookie", async () => {
  let forwarded: Request | undefined;
  const upstreamHeaders = new Headers();
  upstreamHeaders.append(
    "Set-Cookie",
    "ri_visitor=visitor-1; Domain=example.com; Path=/; HttpOnly"
  );
  upstreamHeaders.append(
    "Set-Cookie",
    "internal=secret; Domain=example.com; Path=/"
  );
  const runtime = createRuntime(async (input) => {
    forwarded = input instanceof Request ? input : new Request(input);
    return new Response("ok", { status: 200, headers: upstreamHeaders });
  });
  const policy: ProxyPolicy = {
    profile: "trusted-api",
    request: {
      cookies: { mode: "allowlist", names: ["ri_visitor"] },
      authorization: "preserve",
      origin: "preserve",
      referer: "preserve"
    },
    response: {
      cookies: {
        mode: "allowlist",
        names: ["ri_visitor"],
        domain: "remove",
        path: "proxy-base"
      }
    }
  };
  const request = new Request("https://i0c.cc/proxy", {
    headers: {
      Authorization: "Bearer trusted",
      Cookie: "ri_visitor=visitor-1; internal=secret",
      Origin: "https://client.example",
      Referer: "https://client.example/page"
    }
  });

  const response = await respondUsingRule(
    request,
    createProxyRule(policy),
    "https://example.com/upstream",
    runtime,
    "/proxy; scoped"
  );

  assert.ok(forwarded);
  assert.equal(forwarded.headers.get("authorization"), "Bearer trusted");
  assert.equal(forwarded.headers.get("cookie"), "ri_visitor=visitor-1");
  assert.equal(forwarded.headers.get("origin"), "https://client.example");
  assert.equal(forwarded.headers.get("referer"), "https://client.example/page");
  const responseCookies = getSetCookieValues(response.headers);
  assert.equal(responseCookies.length, 1);
  assert.match(responseCookies[0] ?? "", /^ri_visitor=visitor-1;/);
  assert.doesNotMatch(responseCookies[0] ?? "", /Domain=/i);
  assert.match(responseCookies[0] ?? "", /Path=\/proxy%3B%20scoped/i);
});

test("blocks undeclared redirect origins and strips credentials on allowed hops", async () => {
  const blockedRuntime = createRuntime(async () => new Response(null, {
    status: 302,
    headers: { Location: "https://cdn.example/final" }
  }));
  const blockedResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy"),
    createProxyRule({ profile: "isolated" }),
    "https://example.com/start",
    blockedRuntime,
    "/proxy"
  );
  assert.equal(blockedResponse.status, 502);

  const forwarded: Request[] = [];
  const allowedRuntime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    forwarded.push(request);
    return forwarded.length === 1
      ? new Response(null, {
          status: 302,
          headers: { Location: "https://cdn.example/final" }
        })
      : new Response("ok", { status: 200 });
  });
  const policy: ProxyPolicy = {
    profile: "trusted-api",
    request: {
      authorization: "preserve",
      cookies: { mode: "allowlist", names: ["session"] }
    },
    redirects: {
      mode: "follow",
      allowedOrigins: ["https://cdn.example"]
    }
  };
  const allowedResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy", {
      headers: {
        Authorization: "Bearer trusted",
        Cookie: "session=secret"
      }
    }),
    createProxyRule(policy),
    "https://example.com/start",
    allowedRuntime,
    "/proxy"
  );

  assert.equal(allowedResponse.status, 200);
  assert.equal(forwarded.length, 2);
  assert.equal(forwarded[0]?.headers.get("authorization"), "Bearer trusted");
  assert.equal(forwarded[0]?.headers.get("cookie"), "session=secret");
  assert.equal(forwarded[1]?.headers.get("authorization"), null);
  assert.equal(forwarded[1]?.headers.get("cookie"), null);
});

test("enforces method, body-size, timeout, and public-cache policies", async () => {
  let fetchCalls = 0;
  const runtime = createRuntime(async () => {
    fetchCalls += 1;
    return new Response("asset", { status: 200 });
  });
  const methodResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy", { method: "POST", body: "payload" }),
    createProxyRule({ profile: "isolated" }),
    "https://example.com/upstream",
    runtime,
    "/proxy"
  );
  assert.equal(methodResponse.status, 405);
  assert.equal(fetchCalls, 0);

  const bodyResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy", { method: "POST", body: "payload" }),
    createProxyRule({
      profile: "trusted-api",
      limits: { maxRequestBodyBytes: 3 }
    }),
    "https://example.com/upstream",
    runtime,
    "/proxy"
  );
  assert.equal(bodyResponse.status, 413);
  assert.equal(fetchCalls, 0);

  const cacheResponse = await respondUsingRule(
    new Request("https://i0c.cc/assets/app.js"),
    createProxyRule({ profile: "asset" }),
    "https://example.com/app.js",
    runtime,
    "/assets"
  );
  assert.equal(cacheResponse.status, 200);
  assert.equal(
    cacheResponse.headers.get("cache-control"),
    "public, max-age=3600, s-maxage=86400"
  );

  const privateCacheRuntime = createRuntime(async () => new Response("asset", {
    status: 200,
    headers: { "Cache-Control": 'private="Set-Cookie"' }
  }));
  const privateCacheResponse = await respondUsingRule(
    new Request("https://i0c.cc/assets/private.js"),
    createProxyRule({ profile: "asset" }),
    "https://example.com/private.js",
    privateCacheRuntime,
    "/assets"
  );
  assert.equal(
    privateCacheResponse.headers.get("cache-control"),
    "private, no-store"
  );

  const credentialCacheResponse = await respondUsingRule(
    new Request("https://i0c.cc/api/me", {
      headers: { Authorization: "Bearer private" }
    }),
    createProxyRule({
      profile: "trusted-api",
      request: { authorization: "preserve" },
      cache: {
        mode: "public",
        browserTtlSeconds: 60,
        edgeTtlSeconds: 60
      }
    }),
    "https://example.com/me",
    runtime,
    "/api"
  );
  assert.equal(
    credentialCacheResponse.headers.get("cache-control"),
    "private, no-store"
  );

  const timeoutRuntime = createRuntime(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(
        () => resolve(new Response("late", { status: 200 })),
        1_000
      );
      const rejectOnAbort = () => {
        clearTimeout(timer);
        reject(request.signal.reason);
      };
      if (request.signal.aborted) {
        rejectOnAbort();
      } else {
        request.signal.addEventListener("abort", rejectOnAbort, { once: true });
      }
    });
  });
  const timeoutResponse = await respondUsingRule(
    new Request("https://i0c.cc/proxy"),
    createProxyRule({
      profile: "isolated",
      limits: { timeoutMs: 100 }
    }),
    "https://example.com/upstream",
    timeoutRuntime,
    "/proxy"
  );
  assert.equal(timeoutResponse.status, 504);
});

test("validates proxyPolicy only on proxy routes and rejects unsafe overrides", () => {
  const valid = validateRedirectsConfig({
    Slots: {
      Main: {
        "/api": {
          type: "proxy",
          target: "https://api.example.com",
          proxyPolicy: {
            profile: "trusted-api",
            request: {
              cookies: {
                mode: "allowlist",
                names: ["session"]
              }
            },
            redirects: {
              mode: "follow",
              allowedOrigins: ["https://cdn.example"]
            }
          }
        }
      }
    }
  });
  assert.equal(valid.status, "valid");

  const invalid = validateRedirectsConfig({
    Slots: {
      Main: {
        "/redirect": {
          type: "exact",
          target: "https://example.com",
          proxyPolicy: { profile: "isolated" }
        },
        "/proxy": {
          type: "proxy",
          target: "https://example.com",
          proxyPolicy: {
            profile: "trusted-api",
            request: {
              methods: ["CONNECT"],
              cookies: { mode: "allowlist" },
              authorization: "preserve"
            },
            response: {
              cookies: {
                mode: "strip",
                domain: "preserve"
              }
            },
            cache: {
              mode: "public"
            },
            redirects: {
              mode: "follow",
              allowedOrigins: ["https://example.com/path"]
            }
          }
        }
      }
    }
  });
  assert.equal(invalid.status, "invalid");
  if (invalid.status === "invalid") {
    const issuePaths = invalid.issues.map((issue) => issue.path);
    assert.ok(issuePaths.includes("/Slots/Main/~1redirect/proxyPolicy"));
    assert.ok(issuePaths.includes("/Slots/Main/~1proxy/proxyPolicy/request/cookies/names"));
    assert.ok(issuePaths.includes("/Slots/Main/~1proxy/proxyPolicy/request/methods/0"));
    assert.ok(issuePaths.includes("/Slots/Main/~1proxy/proxyPolicy/response/cookies"));
    assert.ok(issuePaths.includes("/Slots/Main/~1proxy/proxyPolicy/cache/mode"));
    assert.ok(issuePaths.includes("/Slots/Main/~1proxy/proxyPolicy/redirects/allowedOrigins/0"));
  }
});
