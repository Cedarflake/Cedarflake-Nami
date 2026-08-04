import assert from "node:assert/strict";
import test from "node:test";

import {
  assertBootstrapConfigCompatibility,
  bootstrapConfig,
} from "@i0c/config";

test("accepts native D1 bindings without REST identifiers", () => {
  const config = structuredClone(bootstrapConfig);
  config.data.repository = { provider: "d1" };
  config.webui.analyticsStore.provider = "d1";

  assert.doesNotThrow(() => assertBootstrapConfigCompatibility(config));
});

test("rejects a partial D1 REST target", () => {
  const config = structuredClone(bootstrapConfig);
  config.data.repository = { provider: "d1" };
  config.webui.d1.accountId = "cloudflare-account";

  assert.throws(
    () => assertBootstrapConfigCompatibility(config),
    /REST fallback requires both a Cloudflare account ID and database ID/,
  );
});
