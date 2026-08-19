/**
 * @file utils.test.ts
 * @description
 * [EN] Request path inference regression tests.
 * Verifies that framework asset paths use only same-origin proxy referrers.
 *
 * [CN] 请求路径推断回归测试。
 * 验证框架资源路径只接受同源代理来源页的影响。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildCompiledList } from "../../src/lib/handlers/routing/matcher";
import { inferEffectivePath } from "../../src/lib/handlers/core/utils";

const compiledList = buildCompiledList({
  "/docs": {
    type: "proxy",
    target: "https://docs.example",
    appendPath: true
  }
});

test("infers framework asset paths from same-origin proxy referrers", () => {
  const headers = new Headers({ Referer: "https://i0c.cc/docs/guide" });

  assert.equal(
    inferEffectivePath("/_next/app.js", headers, "https://i0c.cc", compiledList),
    "/docs/_next/app.js"
  );
});

test("ignores cross-origin proxy referrers", () => {
  const headers = new Headers({ Referer: "https://external.example/docs/guide" });

  assert.equal(
    inferEffectivePath("/_next/app.js", headers, "https://i0c.cc", compiledList),
    "/_next/app.js"
  );
});
