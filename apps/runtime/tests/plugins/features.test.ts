/**
 * @file features.test.ts
 * @description
 * [EN] Runtime feature-host configuration tests.
 * Verifies that remote plugin enablement changes the assembled feature pipeline.
 *
 * [CN] Runtime Feature 宿主配置测试。
 * 验证远程插件启停会改变实际装配的 Feature 管线。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyticsClassificationHookContext } from "@nami/analytics-domain/classification";
import { defaultDataConfig } from "@nami/config";
import { BOT_CLASSIFIER_PLUGIN_ID } from "@nami/plugin-feature-bot-classifier/manifest";
import { runtimePluginInstallations } from "@nami/runtime-config";

import { createRuntimeFeaturePipeline } from "../../src/plugins/features";

test("removes the bot classifier from the pipeline when disabled", async () => {
  const event: AnalyticsClassificationHookContext = {
    request: new Request("https://i0c.cc/not-a-rule", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }
    }),
    pathname: "/not-a-rule",
    classification: {
      botCategory: "none",
      botConfidence: "none",
      deviceType: "unknown",
      probeCategory: "none",
      resourceClass: "unknown",
      trafficClass: "unknown"
    }
  };
  const pipeline = createRuntimeFeaturePipeline({
    ...defaultDataConfig,
    plugins: {
      ...defaultDataConfig.plugins,
      [BOT_CLASSIFIER_PLUGIN_ID]: { enabled: false }
    }
  }, {
    pluginInstallations: runtimePluginInstallations,
    runtimePlatformManifests: []
  });

  assert.equal(await pipeline.onAnalyticsEvent(event), event);
});
