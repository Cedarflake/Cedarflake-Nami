import assert from "node:assert/strict";
import test from "node:test";

import { postgresDataRepositoryManifest } from "@i0c/plugin-data-repository-postgres/manifest";
import { githubContentsRepositoryManifest } from "@i0c/plugin-github-data/manifest";

import { resolveDataRepositoryEditorCapabilities } from "../src/lib/data/editor-capabilities";

test("keeps raw rule editing exclusive to the GitHub repository", () => {
  assert.deepEqual(
    resolveDataRepositoryEditorCapabilities(githubContentsRepositoryManifest),
    {
      supportsJsonEditor: true,
      supportsSourceOverride: true,
    },
  );
  assert.deepEqual(
    resolveDataRepositoryEditorCapabilities(postgresDataRepositoryManifest),
    {
      supportsJsonEditor: false,
      supportsSourceOverride: false,
    },
  );
});
