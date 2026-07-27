import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { defaultDataConfig } from "@i0c/config";

import {
  createRuntimeSnapshotResponse,
} from "../src/app/api/runtime/snapshot/route";
import {
  createRuntimeDataSnapshot,
  createRuntimeSnapshotEtag,
  matchesRuntimeSnapshotEtag,
} from "../src/lib/data/runtime-snapshot";

test("builds a validated Runtime snapshot from one repository revision", () => {
  const snapshot = createRuntimeDataSnapshot({
    revision: "repository-revision",
    config: {
      content: JSON.stringify(defaultDataConfig),
      revision: "config-revision",
    },
    redirects: {
      content: JSON.stringify({ Slots: { Main: {} } }),
      revision: "redirects-revision",
    },
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.revision, "repository-revision");
  assert.deepEqual(snapshot.config, defaultDataConfig);
  assert.deepEqual(snapshot.redirects, { Slots: { Main: {} } });
});

test("rejects invalid redirect data before publishing a snapshot", () => {
  assert.throws(
    () => createRuntimeDataSnapshot({
      revision: "repository-revision",
      config: {
        content: JSON.stringify(defaultDataConfig),
        revision: "config-revision",
      },
      redirects: {
        content: "[]",
        revision: "redirects-revision",
      },
    }),
    /Redirect data failed validation/,
  );
});

test("matches strong, weak, and comma-separated snapshot ETags", () => {
  const etag = createRuntimeSnapshotEtag("repository-revision");

  assert.match(etag, /^"[A-Za-z0-9_-]{43}"$/);
  assert.equal(matchesRuntimeSnapshotEtag(etag, etag), true);
  assert.equal(matchesRuntimeSnapshotEtag(`"old", W/${etag}`, etag), true);
  assert.equal(matchesRuntimeSnapshotEtag("*", etag), true);
  assert.equal(matchesRuntimeSnapshotEtag("\"other\"", etag), false);
});

test("publishes snapshots with conditional ETag responses", async (context) => {
  const readSnapshot = context.mock.fn(async () => ({
    schemaVersion: 1 as const,
    revision: "commit-1",
    config: defaultDataConfig,
    redirects: { Slots: { Main: {} } },
  }));

  const response = await createRuntimeSnapshotResponse(
    new NextRequest("https://u.i0c.cc/api/runtime/snapshot"),
    readSnapshot,
  );
  const etag = response.headers.get("etag");

  assert.equal(response.status, 200);
  assert.ok(etag);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=30/);
  assert.equal((await response.json()).revision, "commit-1");

  const notModified = await createRuntimeSnapshotResponse(
    new NextRequest("https://u.i0c.cc/api/runtime/snapshot", {
      headers: { "If-None-Match": etag },
    }),
    readSnapshot,
  );
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("etag"), etag);
});

test("does not expose repository failures from the public snapshot endpoint", async (context) => {
  const readSnapshot = async () => {
    throw new Error("postgres://user:secret@example.invalid/database");
  };
  context.mock.method(console, "error", () => {});

  const response = await createRuntimeSnapshotResponse(
    new NextRequest("https://u.i0c.cc/api/runtime/snapshot"),
    readSnapshot,
  );
  const body = JSON.stringify(await response.json());

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.includes("secret"), false);
});
