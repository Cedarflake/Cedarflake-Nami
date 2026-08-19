import assert from "node:assert/strict";
import test from "node:test";

import {
  getRouteDescription,
  getTargetFaviconUrl,
  isRecord,
  setRouteDescription,
  stripRetiredProxyPolicy,
} from "../src/composables/editor/route-utils";

test("resolves a favicon service URL from the target hostname", () => {
  assert.equal(
    getTargetFaviconUrl("https://docs.example.com/guide?from=nami"),
    "https://unavatar.webp.se/docs.example.com?fallback=false",
  );
  assert.equal(getTargetFaviconUrl("/relative-target"), null);
});

test("promotes a quick rule when a description is added", () => {
  const result = setRouteDescription(
    "https://example.com/docs",
    "Documentation entry point",
  );

  assert.equal(isRecord(result), true);
  if (!isRecord(result)) {
    return;
  }
  assert.equal(result.target, "https://example.com/docs");
  assert.equal(result.description, "Documentation entry point");
  assert.equal(getRouteDescription(result), "Documentation entry point");
});

test("stores one path description on the first candidate rule", () => {
  const result = setRouteDescription(
    [
      { target: "https://a.example.com" },
      { target: "https://b.example.com" },
    ],
    "Weighted destinations",
  );

  assert.equal(Array.isArray(result), true);
  if (!Array.isArray(result) || !isRecord(result[0])) {
    return;
  }
  assert.equal(result[0].description, "Weighted destinations");
  assert.deepEqual(result[1], { target: "https://b.example.com" });
  assert.equal(getRouteDescription(result), "Weighted destinations");
});

test("removes an empty description without changing the rule shape", () => {
  const value = {
    analyticsId: "eb5deba4-32b7-476f-b7f3-4b5c598a397c",
    description: "Old description",
    target: "https://example.com",
  };
  const result = setRouteDescription(value, "  ");

  assert.deepEqual(result, {
    analyticsId: "eb5deba4-32b7-476f-b7f3-4b5c598a397c",
    target: "https://example.com",
  });
});

test("removes retired proxy policies from every rule when saving", () => {
  assert.deepEqual(
    stripRetiredProxyPolicy([
      {
        proxyPolicy: { profile: "isolated" },
        proxyOptions: {
          requestHeaders: { Referer: "https://www.example.com/" },
        },
        target: "https://a.example.com",
      },
      {
        proxyPolicy: { profile: "asset" },
        target: "https://b.example.com",
      },
    ]),
    [
      {
        proxyOptions: {
          requestHeaders: { Referer: "https://www.example.com/" },
        },
        target: "https://a.example.com",
      },
      { target: "https://b.example.com" },
    ],
  );
});
