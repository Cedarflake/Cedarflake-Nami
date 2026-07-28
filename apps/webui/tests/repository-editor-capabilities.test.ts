import assert from "node:assert/strict";
import test from "node:test";

import { d1DataRepositoryManifest } from "@i0c/plugin-data-repository-d1/manifest";
import { postgresDataRepositoryManifest } from "@i0c/plugin-data-repository-postgres/manifest";
import { githubContentsRepositoryManifest } from "@i0c/plugin-github-data/manifest";

import { resolveDataRepositoryEditorCapabilities } from "../src/lib/data/editor-capabilities";

test("keeps raw rule editing exclusive to the GitHub repository", () => {
  assert.deepEqual(
    resolveDataRepositoryEditorCapabilities(githubContentsRepositoryManifest),
    {
      usesManualSave: true,
      supportsJsonEditor: true,
      supportsSourceOverride: true,
    },
  );
  assert.deepEqual(
    resolveDataRepositoryEditorCapabilities(postgresDataRepositoryManifest),
    {
      usesManualSave: false,
      supportsJsonEditor: false,
      supportsSourceOverride: false,
    },
  );
  assert.deepEqual(
    resolveDataRepositoryEditorCapabilities(d1DataRepositoryManifest),
    {
      usesManualSave: false,
      supportsJsonEditor: false,
      supportsSourceOverride: false,
    },
  );
});
