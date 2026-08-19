/**
 * @file data-config.test.ts
 * @description
 * [EN] Shared instance configuration contract tests.
 * Verifies the remote data shape before Runtime and WebUI consumers rely on it.
 *
 * [CN] 共享实例配置契约测试。
 * 在 Runtime 与 WebUI 消费远程数据前验证其配置结构。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultDataConfig,
  validateDataConfig
} from "@nami/config";

test("accepts the checked-in default data configuration", () => {
  const result = validateDataConfig(defaultDataConfig);

  assert.equal(result.status, "valid");
});

test("rejects unsafe runtime origins and malformed manager IDs", () => {
  const result = validateDataConfig({
    ...defaultDataConfig,
    runtime: {
      ...defaultDataConfig.runtime,
      canonicalOrigin: "https://i0c.cc/path"
    },
    webui: {
      access: {
        mode: "allowlist",
        managerGitHubUserIds: ["not-a-user-id"]
      }
    }
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.deepEqual(
      result.issues.map((item) => item.path),
      [
        "/runtime/canonicalOrigin",
        "/webui/access/managerGitHubUserIds"
      ]
    );
  }
});

test("accepts namespaced plugin configuration and secret binding names", () => {
  const result = validateDataConfig({
    ...defaultDataConfig,
    plugins: {
      "@nami/analytics-http": {
        enabled: true,
        config: {
          retryAttempts: 2
        },
        secrets: {
          writeKey: "PLUGIN_WRITE_KEY"
        }
      }
    }
  });

  assert.equal(result.status, "valid");
});

test("rejects invalid plugin secret binding names", () => {
  const result = validateDataConfig({
    ...defaultDataConfig,
    plugins: {
      "@nami/analytics-http": {
        enabled: true,
        secrets: {
          writeKey: "plain-text-secret"
        }
      }
    }
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.equal(
      result.issues[0]?.path,
      "/plugins/@nami~1analytics-http/secrets/writeKey"
    );
  }
});

test("rejects unknown fields and invalid plugin names", () => {
  const result = validateDataConfig({
    ...defaultDataConfig,
    unexpected: true,
    plugins: {
      "Invalid Plugin": {
        enabled: true
      }
    }
  });

  assert.equal(result.status, "invalid");
  if (result.status === "invalid") {
    assert.ok(result.issues.some((item) => item.path === "/unexpected"));
    assert.ok(result.issues.some((item) => item.path === "/plugins/Invalid Plugin"));
  }
});
