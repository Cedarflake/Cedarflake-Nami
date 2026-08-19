/**
 * @file handler.test.ts
 * @description
 * [EN] Runtime controller response regression tests.
 * Verifies that unmatched routes and exhausted proxy routes produce distinct HTTP responses.
 *
 * [CN] Runtime 控制器响应回归测试。
 * 验证未匹配路由与代理耗尽路由会产生不同的 HTTP 响应。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { defaultDataConfig } from "@nami/config";

import { interLatinVariableFontPath } from "../../src/assets/inter-font";
import { handleRedirectRequest } from "../../src/lib/handler";

function createUpstreamFetch(
  upstreamStatus: number,
): typeof fetch {
  return async () =>
    new Response("upstream unavailable", { status: upstreamStatus });
}

function createDataSource(routePath: string = "/app") {
  return {
    async loadConfig() {
      return defaultDataConfig;
    },
    async loadRules() {
      return {
        Slots: {
          Main: {
            [routePath]: {
              type: "proxy",
              target: "https://upstream.example"
            }
          }
        }
      };
    }
  };
}

test("returns an uncacheable gateway error after every proxy candidate fails", async () => {
  const response = await handleRedirectRequest(
    new Request("https://i0c.cc/app/dashboard"),
    {
      dataSource: createDataSource(),
      fetchImpl: createUpstreamFetch(503)
    }
  );

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "Bad Gateway: All upstream proxies failed.");
});

test("returns the branded 404 when a catch-all proxy reports not found", async () => {
  const response = await handleRedirectRequest(
    new Request("https://i0c.cc/222"),
    {
      dataSource: createDataSource("/"),
      fetchImpl: createUpstreamFetch(404)
    }
  );

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  assert.match(await response.text(), /404/);
});

test("preserves the branded cacheable response for an unmatched route", async () => {
  const response = await handleRedirectRequest(
    new Request("https://i0c.cc/missing"),
    {
      dataSource: createDataSource(),
      fetchImpl: createUpstreamFetch(200)
    }
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  const html = await response.text();
  assert.match(html, /404/);
  assert.ok(html.includes(interLatinVariableFontPath));
});

test("serves the embedded Inter font without loading redirect config", async () => {
  const response = await handleRedirectRequest(
    new Request(`https://i0c.cc${interLatinVariableFontPath}`),
    {
      fetchImpl: async () => {
        throw new Error("Font requests must not load redirect config");
      }
    }
  );
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "font/woff2");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x77, 0x4f, 0x46, 0x32]);
  assert.ok(interLatinVariableFontPath.includes(
    createHash("sha256").update(bytes).digest("hex").slice(0, 12)
  ));
});

test("uses the versioned robots policy instead of a legacy environment binding", async () => {
  const response = await handleRedirectRequest(
    new Request("https://i0c.cc/robots.txt"),
    {
      dataSource: createDataSource(),
      envBindings: { ROBOTS_POLICY: "disallow" },
      fetchImpl: createUpstreamFetch(200)
    }
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /^User-agent: \*\nAllow: \/$/m);
});

test("settles concurrent data-source failures before returning an internal error", async () => {
  const response = await handleRedirectRequest(
    new Request("https://i0c.cc/source-failure"),
    {
      dataSource: {
        async loadConfig() {
          throw new Error("config failed");
        },
        async loadRules() {
          throw new Error("rules failed");
        }
      }
    }
  );

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Internal Server Error");
});
