import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { bootstrapConfig } from "@nami/config";
import {
  createGitHubContentsRepository,
} from "@nami/plugin-github-data/webui";

const repositoryConfig = {
  ...bootstrapConfig.data.github,
  publicRevalidateSeconds: 60,
};

test("loads instance configuration from the data branch config path", async () => {
  const repository = createGitHubContentsRepository(repositoryConfig, {
    async fetchImpl(input) {
      assert.equal(
        String(input),
        "https://api.github.com/repos/Revaea/i0c.cc/contents/config.json?ref=data",
      );
      return Response.json({
        content: Buffer.from('{"schemaVersion":1}', "utf8").toString("base64"),
        sha: "config-sha",
        path: "config.json",
      });
    },
  });

  const document = await repository.read("config", {});

  assert.equal(document.sourcePath, "config.json");
  assert.equal(document.revision, "config-sha");
  assert.equal(document.content, '{"schemaVersion":1}');
});

test("includes GitHub error details when loading config fails", async () => {
  const repository = createGitHubContentsRepository(repositoryConfig, {
    async fetchImpl() {
      return new Response(JSON.stringify({
        message: "Resource not accessible by integration",
      }), {
        status: 403,
        statusText: "Forbidden",
        headers: { "content-type": "application/json" },
      });
    },
  });

  await assert.rejects(
    repository.read("redirects", {
      sourceUrl: "https://github.com/Revaea/i0c.cc/blob/data/redirects.json",
    }),
    /403 Forbidden - Resource not accessible by integration/,
  );
});
