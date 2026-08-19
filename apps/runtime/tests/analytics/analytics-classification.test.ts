/**
 * @file analytics-classification.test.ts
 * @description
 * [EN] Privacy-safe request classification tests for matched and unmatched Runtime traffic.
 * Verifies bounded bot, probe, resource, and device categories without retaining raw request data.
 *
 * [CN] 匹配与未匹配 Runtime 流量的隐私安全分类测试。
 * 验证受控的机器人、探测、资源与设备类别，且不保留原始请求数据。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAnalyticsDevice,
  classifyAnalyticsProbe,
  classifyAnalyticsResource,
  classifyAnalyticsTraffic
} from "../../src/lib/handlers/analytics/classification";

test("classifies declared bots even when they request an unmatched path", () => {
  const request = new Request("https://i0c.cc/not-a-rule", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }
  });
  const traffic = classifyAnalyticsTraffic(request, "none");

  assert.deepEqual(traffic, {
    trafficClass: "declared_bot",
    botCategory: "search",
    botConfidence: "high"
  });
  assert.equal(classifyAnalyticsDevice(request, traffic), "bot");
});

test("uses bounded probe categories to flag suspicious unmatched requests", () => {
  const probeCategory = classifyAnalyticsProbe("/.env.production");
  const request = new Request("https://i0c.cc/.env.production", {
    headers: { "User-Agent": "custom-client" }
  });

  assert.equal(probeCategory, "env_file");
  assert.deepEqual(classifyAnalyticsTraffic(request, probeCategory), {
    trafficClass: "suspected_automation",
    botCategory: "security_probe",
    botConfidence: "medium"
  });
});

test("keeps ordinary browser navigation separate from API and asset resources", () => {
  const navigation = new Request("https://i0c.cc/docs", {
    headers: {
      Accept: "text/html",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  const traffic = classifyAnalyticsTraffic(navigation, "none");

  assert.equal(traffic.trafficClass, "browser_like");
  assert.equal(classifyAnalyticsDevice(navigation, traffic), "desktop");
  assert.equal(classifyAnalyticsResource(navigation, "/docs"), "document");

  const apiRequest = new Request("https://i0c.cc/api/status", {
    headers: { Accept: "application/json" }
  });
  assert.equal(classifyAnalyticsResource(apiRequest, "/api/status"), "api");

  const assetRequest = new Request("https://i0c.cc/assets/app.css", {
    headers: { "Sec-Fetch-Dest": "style" }
  });
  assert.equal(classifyAnalyticsResource(assetRequest, "/assets/app.css"), "asset");
});
