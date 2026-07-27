/**
 * @file loader.test.ts
 * @description
 * [EN] Runtime configuration loader cache tests.
 * Verifies concurrent fetch deduplication and parsed configuration reuse within the memory TTL.
 *
 * [CN] Runtime 配置加载缓存测试。
 * 验证并发下载去重以及内存 TTL 内复用已解析配置。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { defaultDataConfig } from "@i0c/config";
import {
  resolveHttpSnapshotSourceBootstrapConfig
} from "@i0c/plugin-http-snapshot-source/config";
import {
  httpSnapshotSourceManifest
} from "@i0c/plugin-http-snapshot-source/manifest";
import {
  httpSnapshotSourcePlugin
} from "@i0c/plugin-http-snapshot-source/runtime";
import {
  runtimePlatformManifests,
  runtimePluginInstallations
} from "@i0c/runtime-config";
import type { RuntimePluginInstallations } from "@i0c/runtime-host/installations";

import {
  loadDataConfig,
  loadConfig,
  resolveRuntimeOptions
} from "../../src/lib/handlers/configuration/loader";

test("uses the versioned redirect source instead of legacy environment bindings", () => {
  const runtime = resolveRuntimeOptions({
    envBindings: {
      REDIRECTS_CONFIG_URL: "https://ignored.example/redirects.json",
      CONFIG_URL: "https://also-ignored.example/redirects.json"
    }
  });

  assert.equal(
    runtime.configUrl,
    "https://raw.githubusercontent.com/Revaea/i0c.cc/data/redirects.json"
  );
  assert.equal(
    runtime.dataConfigUrl,
    "https://raw.githubusercontent.com/Revaea/i0c.cc/data/config.json"
  );
});

test("loads and validates the remote instance configuration", async () => {
  const runtime = resolveRuntimeOptions({
    dataConfigUrl: "https://config.example/data-config.json",
    redirectsConfigUrl: "https://config.example/redirects.json",
    now: () => 0,
    fetchImpl: async (input) => {
      assert.equal(String(input), "https://config.example/data-config.json");
      return Response.json({
        schemaVersion: 1,
        runtime: {
          canonicalOrigin: "https://links.example.com",
          robotsPolicy: "disallow",
          configCacheTtlSeconds: 300,
          redirectsCacheTtlSeconds: 30
        },
        analytics: {
          ingestEndpoint: "https://console.example.com/api/analytics/events",
          sourceId: "links.example.com"
        },
        webui: {
          access: {
            mode: "allowlist",
            managerGitHubUserIds: ["123"]
          }
        },
        plugins: {}
      });
    }
  });

  const config = await loadDataConfig(runtime);

  assert.equal(config.runtime.canonicalOrigin, "https://links.example.com");
  assert.equal(config.runtime.robotsPolicy, "disallow");
  assert.equal(config.analytics.sourceId, "links.example.com");
});

test("keeps the safe default when remote instance configuration is invalid", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const runtime = resolveRuntimeOptions({
    dataConfigUrl: "https://config.example/invalid-data-config.json",
    now: () => 0,
    fetchImpl: async () => Response.json({ schemaVersion: 2 })
  });

  const config = await loadDataConfig(runtime);

  assert.equal(config.runtime.canonicalOrigin, "https://i0c.cc");
  assert.equal(config.analytics.sourceId, "i0c.cc");
});

test("keeps the safe default when remote configuration disables the required data source", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const runtime = resolveRuntimeOptions({
    dataConfigUrl: "https://config.example/disabled-source.json",
    now: () => 0,
    fetchImpl: async () => Response.json({
      ...defaultDataConfig,
      plugins: {
        "@i0c/github-raw-source": { enabled: false }
      }
    })
  });

  const config = await loadDataConfig(runtime);

  assert.equal(config, defaultDataConfig);
});

test("keeps the safe default when remote configuration disables the active platform", async (context) => {
  context.mock.method(console, "error", () => undefined);
  const runtime = resolveRuntimeOptions({
    dataConfigUrl: "https://config.example/disabled-platform.json",
    provider: "cloudflare",
    platformPluginId: "@i0c/runtime-cloudflare",
    runtimePlatformManifests,
    now: () => 0,
    fetchImpl: async () => Response.json({
      ...defaultDataConfig,
      plugins: {
        "@i0c/runtime-cloudflare": { enabled: false }
      }
    })
  });

  const config = await loadDataConfig(runtime);

  assert.equal(config, defaultDataConfig);
});

test("keeps the last valid configuration when a plugin-invalid update is published", async (context) => {
  context.mock.method(console, "error", () => undefined);
  let now = 0;
  let fetchCalls = 0;
  const runtime = resolveRuntimeOptions({
    dataConfigUrl: "https://config.example/plugin-invalid-update.json",
    provider: "cloudflare",
    platformPluginId: "@i0c/runtime-cloudflare",
    runtimePlatformManifests,
    now: () => now,
    fetchImpl: async () => {
      fetchCalls += 1;
      return Response.json(fetchCalls === 1
        ? defaultDataConfig
        : {
            ...defaultDataConfig,
            plugins: {
              ...defaultDataConfig.plugins,
              "@i0c/runtime-cloudflare": { enabled: false }
            }
          });
    }
  });

  const first = await loadDataConfig(runtime);
  now = 600_001;
  const second = await loadDataConfig(runtime);

  assert.equal(second, first);
  assert.equal(fetchCalls, 2);
});

test("accepts a replaceable data source without using the remote fetch adapter", async () => {
  let configLoads = 0;
  let ruleLoads = 0;
  const rules = { Slots: { Main: { "/docs": "https://example.com/docs" } } };
  const runtime = resolveRuntimeOptions({
    dataSource: {
      async loadConfig() {
        configLoads += 1;
        return defaultDataConfig;
      },
      async loadRules() {
        ruleLoads += 1;
        return rules;
      }
    },
    fetchImpl: async () => {
      throw new Error("The remote adapter must not run for an injected data source");
    }
  });

  assert.equal(await loadDataConfig(runtime), defaultDataConfig);
  assert.equal(await loadConfig(runtime), rules);
  assert.equal(configLoads, 1);
  assert.equal(ruleLoads, 1);
});

test("loads one atomic snapshot through an installed HTTP data source", async () => {
  const plugins = { ...defaultDataConfig.plugins };
  delete plugins["@i0c/github-raw-source"];
  plugins["@i0c/http-snapshot-source"] = {
    enabled: true,
    version: 1
  };
  const snapshotConfig = {
    ...defaultDataConfig,
    plugins
  };
  const snapshotRules = {
    Slots: {
      Main: {
        "/snapshot": "https://example.com/snapshot"
      }
    }
  };
  let fetchCalls = 0;
  const httpPluginInstallations = {
    ...runtimePluginInstallations,
    dataSource: {
      bootstrapConfig: {
        snapshotUrl: "https://config.example/runtime-snapshot.json",
        requestTimeoutMs: 1_000,
        maximumFetchAttempts: 1,
        failureBackoffSeconds: 30
      },
      enabledByDefault: true,
      endpoints: {
        config: "https://config.example/runtime-snapshot.json",
        rules: "https://config.example/runtime-snapshot.json"
      },
      manifest: httpSnapshotSourceManifest,
      create: (config, services) => httpSnapshotSourcePlugin.create(
        resolveHttpSnapshotSourceBootstrapConfig(config),
        services
      )
    }
  } satisfies RuntimePluginInstallations;
  const runtime = resolveRuntimeOptions({
    pluginInstallations: httpPluginInstallations,
    now: () => 0,
    fetchImpl: async () => {
      fetchCalls += 1;
      return Response.json({
        schemaVersion: 1,
        revision: "snapshot-revision",
        config: snapshotConfig,
        redirects: snapshotRules
      });
    }
  });

  const [config, rules] = await Promise.all([
    loadDataConfig(runtime),
    loadConfig(runtime)
  ]);

  assert.deepEqual(config, snapshotConfig);
  assert.deepEqual(rules, snapshotRules);
  assert.equal(fetchCalls, 1);
});

test("revalidates expired instance configuration with an ETag", async () => {
  let now = 0;
  let fetchCalls = 0;
  const runtime = resolveRuntimeOptions({
    dataConfigUrl: "https://config.example/etag-data-config.json",
    now: () => now,
    fetchImpl: async (input, init) => {
      fetchCalls += 1;
      const request = new Request(input, init);
      if (fetchCalls === 1) {
        assert.equal(request.headers.get("if-none-match"), null);
        return Response.json(defaultDataConfig, {
          headers: { ETag: '"config-v1"' }
        });
      }
      assert.equal(request.headers.get("if-none-match"), '"config-v1"');
      return new Response(null, { status: 304 });
    }
  });

  const first = await loadDataConfig(runtime);
  now = 600_001;
  const second = await loadDataConfig(runtime);

  assert.equal(second, first);
  assert.equal(fetchCalls, 2);
});

test("deduplicates concurrent config loads and reuses parsed data", async () => {
  let releaseFetch: (() => void) | undefined;
  const fetchGate = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  let fetchCalls = 0;
  const runtime = resolveRuntimeOptions({
    configUrl: "https://config.example/loader-cache.json",
    cacheTtlSeconds: 60,
    now: () => 0,
    fetchImpl: async () => {
      fetchCalls += 1;
      await fetchGate;
      return Response.json({
        Slots: {
          Main: {
            "/docs": "https://example.com/docs"
          }
        }
      });
    }
  });

  const firstLoad = loadConfig(runtime);
  const secondLoad = loadConfig(runtime);
  assert.equal(fetchCalls, 1);

  assert.ok(releaseFetch);
  releaseFetch();
  const [first, second] = await Promise.all([firstLoad, secondLoad]);
  const third = await loadConfig(runtime);

  assert.ok(first);
  assert.equal(second, first);
  assert.equal(third, first);
  assert.equal(fetchCalls, 1);
});

test("releases unsuccessful configuration responses", async (context) => {
  context.mock.method(console, "error", () => undefined);
  let didCancelResponse = false;
  const runtime = resolveRuntimeOptions({
    configUrl: "https://config.example/unavailable.json",
    cacheTtlSeconds: 60,
    now: () => 0,
    fetchImpl: async () => new Response(new ReadableStream({
      cancel() {
        didCancelResponse = true;
      }
    }), { status: 503 })
  });

  const config = await loadConfig(runtime);

  assert.equal(config, null);
  assert.equal(didCancelResponse, true);
});

test("backs off repeated remote loads after a transient failure", async (context) => {
  context.mock.method(console, "error", () => undefined);
  let now = 0;
  let fetchCalls = 0;
  const runtime = resolveRuntimeOptions({
    configUrl: "https://config.example/backoff.json",
    now: () => now,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(null, { status: 503 });
    }
  });

  assert.equal(await loadConfig(runtime), null);
  assert.equal(await loadConfig(runtime), null);
  assert.equal(fetchCalls, 1);

  now = 10_001;
  assert.equal(await loadConfig(runtime), null);
  assert.equal(fetchCalls, 2);
});
