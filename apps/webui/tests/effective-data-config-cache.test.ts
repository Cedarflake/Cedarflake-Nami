import assert from "node:assert/strict";
import test from "node:test";

import { defaultDataConfig } from "@nami/config";
import type { DataConfig } from "@nami/config";

import { EffectiveDataConfigCache } from "../src/lib/configuration/effective-data-config-cache";

function createConfig(
  canonicalOrigin: DataConfig["runtime"]["canonicalOrigin"]
): DataConfig {
  return {
    ...defaultDataConfig,
    runtime: {
      ...defaultDataConfig.runtime,
      canonicalOrigin,
    },
  };
}

test("does not treat the compiled fallback as authoritative", async () => {
  const cache = new EffectiveDataConfigCache({
    defaultConfig: defaultDataConfig,
    failureRetrySeconds: 10,
    async loadRemote() {
      throw new Error("remote unavailable");
    },
  });

  const value = await cache.get();

  assert.equal(value.config, defaultDataConfig);
  assert.equal(value.isAuthoritative, false);
  await assert.rejects(
    cache.getAuthoritative(),
    /Authoritative remote instance config is unavailable/,
  );
});

test("keeps the last verified config authoritative during a refresh failure", async () => {
  let now = 0;
  let loadCount = 0;
  const verifiedConfig = createConfig("https://verified.example.com");
  const cache = new EffectiveDataConfigCache({
    defaultConfig: defaultDataConfig,
    failureRetrySeconds: 10,
    now: () => now,
    async loadRemote() {
      loadCount += 1;
      if (loadCount === 1) {
        return verifiedConfig;
      }
      throw new Error("remote unavailable");
    },
  });

  assert.equal(await cache.getAuthoritative(), verifiedConfig);
  now = 600_001;
  assert.equal(await cache.getAuthoritative(), verifiedConfig);
  assert.equal(loadCount, 2);
});

test("can delegate successful caching to a shared external cache", async () => {
  let loadCount = 0;
  const verifiedConfig = createConfig("https://verified.example.com");
  const cache = new EffectiveDataConfigCache({
    defaultConfig: defaultDataConfig,
    failureRetrySeconds: 10,
    async loadRemote() {
      loadCount += 1;
      return verifiedConfig;
    },
    successCacheSeconds: () => 0,
  });

  assert.equal(await cache.getAuthoritative(), verifiedConfig);
  assert.equal(await cache.getAuthoritative(), verifiedConfig);
  assert.equal(loadCount, 2);
});

test("keeps an adopted config for the immediate read-back window", async () => {
  let loadCount = 0;
  const adoptedConfig = createConfig("https://adopted.example.com");
  const cache = new EffectiveDataConfigCache({
    adoptCacheSeconds: 5,
    defaultConfig: defaultDataConfig,
    failureRetrySeconds: 10,
    async loadRemote() {
      loadCount += 1;
      return defaultDataConfig;
    },
    successCacheSeconds: () => 0,
  });

  cache.adopt(adoptedConfig);

  assert.equal(await cache.getAuthoritative(), adoptedConfig);
  assert.equal(loadCount, 0);
});

test("prevents an older in-flight read from replacing an adopted config", async () => {
  let resolveRemote: ((config: DataConfig) => void) | undefined;
  const remoteConfig = new Promise<DataConfig>((resolve) => {
    resolveRemote = resolve;
  });
  const oldConfig = createConfig("https://old.example.com");
  const newConfig = createConfig("https://new.example.com");
  const cache = new EffectiveDataConfigCache({
    defaultConfig: defaultDataConfig,
    failureRetrySeconds: 10,
    loadRemote: () => remoteConfig,
  });

  const oldRead = cache.get();
  cache.adopt(newConfig);
  if (!resolveRemote) {
    throw new Error("Remote resolver was not initialized");
  }
  resolveRemote(oldConfig);

  assert.equal((await oldRead).config, newConfig);
  assert.equal(await cache.getAuthoritative(), newConfig);
});
