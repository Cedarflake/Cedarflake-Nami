import assert from "node:assert/strict";
import test from "node:test";

import { createInitialDocuments } from "../src/lib/setup/initial-documents";

test("creates valid database-backed documents for selected Runtime providers", () => {
  const result = createInitialDocuments({
    analyticsEnabled: true,
    analyticsSourceId: "Example.Source",
    managerGitHubUserId: "59095086",
    runtimeOrigin: "https://go.example.com",
    runtimeProviders: ["cloudflare", "vercel"],
    webUiOrigin: "https://admin.example.com",
  });

  assert.equal(result.config.runtime.canonicalOrigin, "https://go.example.com");
  assert.equal(
    result.config.analytics.ingestEndpoint,
    "https://admin.example.com/api/analytics/events",
  );
  assert.equal(result.config.analytics.sourceId, "example.source");
  assert.deepEqual(
    result.config.webui.access.managerGitHubUserIds,
    ["59095086"],
  );
  assert.equal(
    result.config.plugins["@nami/runtime-cloudflare"]?.enabled,
    true,
  );
  assert.equal(
    result.config.plugins["@nami/runtime-netlify"]?.enabled,
    false,
  );
  assert.equal(
    result.config.plugins["@nami/runtime-vercel"]?.enabled,
    true,
  );
  assert.equal(
    result.config.plugins["@nami/data-repository-postgres"]?.enabled,
    true,
  );
  assert.equal(
    result.config.plugins["@nami/analytics-store-postgres"]?.enabled,
    true,
  );
  assert.equal(
    result.config.plugins["@nami/analytics-store-d1"]?.enabled,
    false,
  );
  assert.equal(
    result.config.plugins["@nami/github-contents-repository"],
    undefined,
  );
  assert.equal(
    result.config.plugins["@nami/github-raw-source"],
    undefined,
  );
  assert.deepEqual(JSON.parse(result.redirectsContent), {
    $schema:
      "https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/redirects.schema.json",
    Slots: {},
  });
});

test("disables the analytics pipeline when analytics is not selected", () => {
  const result = createInitialDocuments({
    analyticsEnabled: false,
    analyticsSourceId: "",
    managerGitHubUserId: "59095086",
    runtimeOrigin: "https://i0c.cc",
    runtimeProviders: ["netlify"],
    webUiOrigin: "https://u.i0c.cc",
  });

  assert.equal(
    result.config.plugins["@nami/analytics-sink-http"]?.enabled,
    false,
  );
  assert.equal(
    result.config.plugins["@nami/analytics-store-postgres"]?.enabled,
    false,
  );
  assert.equal(
    result.config.plugins["@nami/analytics-store-d1"]?.enabled,
    false,
  );
  assert.equal(
    result.config.plugins["@nami/feature-bot-classifier"]?.enabled,
    false,
  );
  assert.equal(result.config.analytics.sourceId, "i0c.cc");
});

test("rejects setup origins that include paths", () => {
  assert.throws(
    () => createInitialDocuments({
      analyticsEnabled: false,
      analyticsSourceId: "i0c.cc",
      managerGitHubUserId: "59095086",
      runtimeOrigin: "https://i0c.cc/path",
      runtimeProviders: ["cloudflare"],
      webUiOrigin: "https://u.i0c.cc",
    }),
    /must be an HTTPS origin without a path/,
  );
});
