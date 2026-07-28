import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeterministicAnalyticsId,
  ensureAnalyticsId,
} from "../src/composables/editor/route-utils";
import {
  buildConfig,
  DuplicateRedirectKeyError,
  InvalidRedirectConfigError,
  parseInitialContent,
} from "../src/composables/redirects-groups/serialization";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("generates the same analytics ID for the same rule identity", async () => {
  const first = await createDeterministicAnalyticsId("Slots/Main:/docs");
  const second = await createDeterministicAnalyticsId("Slots/Main:/docs");

  assert.equal(first, second);
  assert.match(first, uuidPattern);
});

test("generates different analytics IDs for different rule identities", async () => {
  const first = await createDeterministicAnalyticsId("Slots/Main:/docs");
  const second = await createDeterministicAnalyticsId("Slots/Main:/api");

  assert.notEqual(first, second);
});

test("preserves an existing analytics ID", async () => {
  const config = {
    analyticsId: "eb5deba4-32b7-476f-b7f3-4b5c598a397c",
    target: "https://example.com",
  };

  assert.equal(await ensureAnalyticsId(config, "unused-seed"), config);
});

test("persists hydrated analytics IDs through config serialization", async () => {
  const source = JSON.stringify({
    Slots: {
      Main: {
        "/": {
          type: "proxy",
          target: "https://example.com",
        },
        "/fallback": [
          {
            type: "redirect",
            target: "https://example.net",
          },
          "https://example.org",
        ],
      },
    },
  });
  const parsed = await parseInitialContent(source);
  const saved = buildConfig(parsed.rootGroup, parsed.baseConfig, parsed.slotsKey);
  const reloaded = await parseInitialContent(JSON.stringify(saved));

  assert.deepEqual(
    buildConfig(reloaded.rootGroup, reloaded.baseConfig, reloaded.slotsKey),
    saved,
  );
});

test("keeps a missing analytics ID stable across destination edits", async () => {
  async function readGeneratedId(target: string) {
    const parsed = await parseInitialContent(JSON.stringify({
      Slots: {
        Main: {
          "/docs": { type: "prefix", target },
        },
      },
    }));
    const saved = buildConfig(parsed.rootGroup, parsed.baseConfig, parsed.slotsKey);
    const slots = saved.Slots as Record<string, unknown>;
    const main = slots.Main as Record<string, unknown>;
    const route = main["/docs"] as Record<string, unknown>;
    return route.analyticsId;
  }

  assert.equal(
    await readGeneratedId("https://example.com/docs"),
    await readGeneratedId("https://example.net/guide"),
  );
});

test("preserves intermediate groups without direct routes", async () => {
  const source = JSON.stringify({
    Slots: {
      Main: {
        Nested: {
          "/docs": {
            analyticsId: "eb5deba4-32b7-476f-b7f3-4b5c598a397c",
            target: "https://example.com/docs",
          },
        },
      },
    },
  });
  const parsed = await parseInitialContent(source);

  assert.deepEqual(
    buildConfig(parsed.rootGroup, parsed.baseConfig, parsed.slotsKey),
    JSON.parse(source),
  );
});

test("rejects duplicate keys before config serialization can overwrite them", () => {
  assert.throws(
    () => buildConfig({
      id: "root",
      name: "Slots",
      entries: [
        { id: "first", key: "/docs", value: "https://example.com/docs" },
        { id: "second", key: "/docs", value: "https://example.com/guide" },
      ],
      children: [],
    }, {}, "Slots"),
    (error) => (
      error instanceof DuplicateRedirectKeyError
      && error.key === "/docs"
      && error.groupName === "Slots"
    ),
  );
});

test("rejects invalid JSON instead of replacing it with an empty config", async () => {
  await assert.rejects(
    () => parseInitialContent("{"),
    (error: unknown) => (
      error instanceof InvalidRedirectConfigError
      && error.reason === "json"
    ),
  );
});

test("rejects non-object config roots", async () => {
  await assert.rejects(
    () => parseInitialContent("[]"),
    (error: unknown) => (
      error instanceof InvalidRedirectConfigError
      && error.reason === "root"
    ),
  );
});
