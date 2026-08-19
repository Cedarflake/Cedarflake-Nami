import assert from "node:assert/strict";
import test from "node:test";

import { defaultDataConfig } from "@nami/config";
import {
  webUiPluginDescriptors,
} from "@nami/webui-manifests";

import { validateInstanceDataConfig } from "../src/lib/configuration/validation";
import {
  runtimePluginDescriptors,
} from "../../../nami.runtime.manifests";

test("rejects a config that disables the Runtime data source", () => {
  const dataSourcePluginId =
    runtimePluginDescriptors.dataSource.manifest.id;
  const result = validateInstanceDataConfig({
    ...defaultDataConfig,
    plugins: {
      ...defaultDataConfig.plugins,
      [dataSourcePluginId]: { enabled: false },
    },
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path
          === `/plugins/${dataSourcePluginId.replace("/", "~1")}/enabled`,
      ),
    );
  }
});

test("allows a config that disables an installed Runtime platform", () => {
  const result = validateInstanceDataConfig({
    ...defaultDataConfig,
    plugins: {
      ...defaultDataConfig.plugins,
      "@nami/runtime-cloudflare": { enabled: false },
    },
  });

  assert.equal(result.status, "valid");
});

test("rejects an incompatible Runtime plugin config version", () => {
  const dataSourcePluginId =
    runtimePluginDescriptors.dataSource.manifest.id;
  const result = validateInstanceDataConfig({
    ...defaultDataConfig,
    plugins: {
      ...defaultDataConfig.plugins,
      [dataSourcePluginId]: {
        enabled: true,
        version: 999,
      },
    },
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path
          === `/plugins/${dataSourcePluginId.replace("/", "~1")}/version`,
      ),
    );
  }
});

test("rejects a config that disables the WebUI data repository", () => {
  const dataRepositoryPluginId =
    webUiPluginDescriptors.dataRepository.manifest.id;
  const result = validateInstanceDataConfig({
    ...defaultDataConfig,
    plugins: {
      ...defaultDataConfig.plugins,
      [dataRepositoryPluginId]: { enabled: false },
    },
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path
          === `/plugins/${dataRepositoryPluginId.replace("/", "~1")}/enabled`,
      ),
    );
  }
});

test("rejects blocked GitHub user IDs that overlap manager IDs", () => {
  const result = validateInstanceDataConfig({
    ...defaultDataConfig,
    webui: {
      access: {
        ...defaultDataConfig.webui.access,
        blockedGitHubUserIds: [
          defaultDataConfig.webui.access.managerGitHubUserIds[0],
        ],
      },
    },
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(
      result.issues.some(
        (issue) => issue.path === "/webui/access/blockedGitHubUserIds",
      ),
    );
  }
});

test("allows blocked GitHub user IDs in manager-only mode", () => {
  const result = validateInstanceDataConfig({
    ...defaultDataConfig,
    webui: {
      access: {
        mode: "allowlist",
        managerGitHubUserIds: ["10000001"],
        blockedGitHubUserIds: ["10000001"],
      },
    },
  });

  assert.equal(result.status, "valid");
});
