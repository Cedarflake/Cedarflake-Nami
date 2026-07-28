import assert from "node:assert/strict";
import test from "node:test";

import { validateRedirectsConfig } from "@i0c/config";

import { validateRedirectConfig } from "../src/lib/redirects/config-validation";

test("accepts a schema-compatible redirect configuration", () => {
  assert.deepEqual(validateRedirectConfig({
    Slots: {
      Main: {
        "/docs": {
          type: "exact",
          target: "https://example.com/guide",
          status: "307",
        },
      },
    },
  }), { status: "valid" });
});

test("rejects response status strings outside the Response range", () => {
  const result = validateRedirectConfig({
    Slots: {
      Main: {
        "/docs": {
          type: "exact",
          target: "https://example.com/guide",
          status: "100",
        },
      },
    },
  });

  assert.equal(result.status, "invalid");
});

test("rejects route objects without a destination", () => {
  const result = validateRedirectConfig({
    Slots: {
      Main: {
        "/docs": {
          type: "prefix",
        },
      },
    },
  });

  assert.equal(result.status, "invalid");
});

test("rejects proxy targets that cannot be forwarded safely", () => {
  for (const target of [
    "/internal",
    "http:example.com",
    "https://user:secret@example.com/",
  ]) {
    const result = validateRedirectConfig({
      Slots: {
        Main: {
          "/proxy": {
            type: "proxy",
            target,
          },
        },
      },
    });

    assert.equal(result.status, "invalid");
  }
});

test("keeps Runtime proxy validation aligned with the explicit URL schema", () => {
  const result = validateRedirectsConfig({
    Slots: {
      Main: {
        "/proxy": {
          type: "proxy",
          target: "http:example.com",
        },
      },
    },
  });

  assert.equal(result.status, "invalid");
});

test("accepts a structured proxy policy", () => {
  const result = validateRedirectConfig({
    Slots: {
      Main: {
        "/api": {
          type: "proxy",
          target: "https://api.example.com",
          proxyPolicy: {
            profile: "trusted-api",
            request: {
              methods: ["GET", "POST"],
              cookies: {
                mode: "allowlist",
                names: ["session"],
              },
              authorization: "preserve",
              origin: "preserve",
            },
            response: {
              cookies: {
                mode: "allowlist",
                names: ["session"],
                domain: "remove",
                path: "proxy-base",
              },
              securityHeaders: "preserve",
            },
            cache: {
              mode: "bypass",
            },
            redirects: {
              mode: "follow",
              maxHops: 3,
              allowedOrigins: ["https://cdn.example"],
            },
            limits: {
              timeoutMs: 5_000,
              maxRequestBodyBytes: 1_048_576,
            },
          },
        },
      },
    },
  });

  assert.equal(result.status, "valid");
});

test("rejects proxy policies on redirects and unsafe nested overrides", () => {
  const redirectResult = validateRedirectConfig({
    Slots: {
      Main: {
        "/docs": {
          type: "exact",
          target: "https://example.com/docs",
          proxyPolicy: {
            profile: "isolated",
          },
        },
      },
    },
  });
  assert.equal(redirectResult.status, "invalid");

  const proxyResult = validateRedirectConfig({
    Slots: {
      Main: {
        "/proxy": {
          type: "proxy",
          target: "https://example.com",
          proxyPolicy: {
            profile: "trusted-api",
            request: {
              cookies: {
                mode: "allowlist",
              },
            },
            redirects: {
              mode: "follow",
              allowedOrigins: ["https://example.com/path"],
            },
          },
        },
      },
    },
  });
  assert.equal(proxyResult.status, "invalid");
});

test("rejects credential-bearing public caches and unsupported proxy methods", () => {
  const invalidPolicies = [
    {
      profile: "trusted-api",
      request: { authorization: "preserve" },
      cache: { mode: "public" },
    },
    {
      profile: "trusted-api",
      request: {
        cookies: { mode: "allowlist", names: ["session"] },
      },
      cache: { mode: "public" },
    },
    {
      profile: "trusted-api",
      request: { methods: ["CONNECT"] },
    },
    {
      profile: "trusted-api",
      response: {
        cookies: {
          mode: "strip",
          domain: "preserve",
        },
      },
    },
  ];

  for (const proxyPolicy of invalidPolicies) {
    const result = validateRedirectConfig({
      Slots: {
        Main: {
          "/proxy": {
            type: "proxy",
            target: "https://example.com",
            proxyPolicy,
          },
        },
      },
    });

    assert.equal(result.status, "invalid");
  }
});

test("rejects priorities outside the JavaScript safe integer range", () => {
  for (const priority of [Number.MAX_SAFE_INTEGER + 1, "9007199254740992"]) {
    const result = validateRedirectConfig({
      Slots: {
        Main: {
          "/docs": {
            priority,
            target: "https://example.com/docs",
          },
        },
      },
    });

    assert.equal(result.status, "invalid");
  }
});

test("rejects route entries whose keys do not start with a slash", () => {
  const result = validateRedirectConfig({
    Slots: {
      Main: "https://example.com/ignored",
    },
  });

  assert.equal(result.status, "invalid");
});

test("rejects multiple slot root aliases", () => {
  const result = validateRedirectConfig({
    Slots: { "/docs": "https://example.com/docs" },
    slots: { "/guide": "https://example.com/guide" },
  });

  assert.equal(result.status, "invalid");
});

test("rejects duplicate analytics IDs across routes", () => {
  const analyticsId = "eb5deba4-32b7-476f-b7f3-4b5c598a397c";
  const result = validateRedirectConfig({
    Slots: {
      Main: {
        "/docs": {
          analyticsId,
          target: "https://example.com/docs",
        },
        "/guide": {
          analyticsId: analyticsId.toUpperCase(),
          target: "https://example.com/guide",
        },
      },
    },
  });

  assert.equal(result.status, "invalid");
  assert.ok(
    result.status === "invalid"
    && result.issues.some((issue) => (
      issue.path === "/Slots/Main/~1guide/analyticsId"
      && issue.message.includes("/Slots/Main/~1docs/analyticsId")
    )),
  );
});

test("does not confuse a slot group named target with a route", () => {
  const analyticsId = "eb5deba4-32b7-476f-b7f3-4b5c598a397c";
  const result = validateRedirectConfig({
    Slots: {
      Main: {
        target: {
          "/docs": { analyticsId, target: "https://example.com/docs" },
          "/guide": { analyticsId, target: "https://example.com/guide" },
        },
      },
    },
  });

  assert.equal(result.status, "invalid");
  assert.ok(
    result.status === "invalid"
    && result.issues.some((issue) => issue.path === "/Slots/Main/target/~1guide/analyticsId"),
  );
});
