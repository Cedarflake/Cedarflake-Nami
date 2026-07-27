import assert from "node:assert/strict";
import test from "node:test";

import { defaultDataConfig } from "@i0c/config";
import {
  webUiPluginDescriptors,
} from "@i0c/webui-manifests";

import { resolveWebUiPlugins } from "../src/lib/plugins/registry";

test("requires the bootstrap data repository plugin to remain enabled", () => {
  const dataRepositoryPluginId =
    webUiPluginDescriptors.dataRepository.manifest.id;
  assert.throws(
    () => resolveWebUiPlugins({
      ...defaultDataConfig,
      plugins: {
        [dataRepositoryPluginId]: { enabled: false }
      }
    }),
    /data-repository plugin must be enabled/
  );
});

test("allows analytics storage to be disabled independently", () => {
  const plugins = resolveWebUiPlugins({
    ...defaultDataConfig,
    plugins: {
      "@i0c/analytics-store-postgres": { enabled: false }
    }
  });

  assert.equal(
    plugins.some((plugin) => plugin.manifest.slot === "analytics-store"),
    false
  );
  assert.equal(
    plugins.some(
      (plugin) =>
        plugin.manifest.id
        === webUiPluginDescriptors.dataRepository.manifest.id
    ),
    true
  );
});
