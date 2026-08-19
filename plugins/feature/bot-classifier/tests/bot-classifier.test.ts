import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPluginManifest,
  assertRuntimeFeatureEventContract,
} from "@nami/plugin-testkit"

import { defaultBotClassifierConfig } from "../src/config"
import { botClassifierManifest } from "../src/manifest"
import {
  classifyAnalyticsRequest,
  createBotClassifierFeature,
} from "../src/runtime"

test("declares a valid bot classifier manifest", () => {
  assertPluginManifest(botClassifierManifest)
})

test("classifies a declared search bot through the feature hook", async () => {
  const request = new Request("https://i0c.cc/not-a-rule", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
  })

  await assertRuntimeFeatureEventContract({
    registration: createBotClassifierFeature(defaultBotClassifierConfig),
    event: {
      request,
      pathname: "/not-a-rule",
      classification: {
        botCategory: "none" as const,
        botConfidence: "none" as const,
        deviceType: "unknown" as const,
        probeCategory: "none" as const,
        resourceClass: "unknown" as const,
        trafficClass: "unknown" as const,
      },
    },
    expectedEvent: {
      request,
      pathname: "/not-a-rule",
      classification: {
        botCategory: "search" as const,
        botConfidence: "high" as const,
        deviceType: "bot" as const,
        probeCategory: "none" as const,
        resourceClass: "unknown" as const,
        trafficClass: "declared_bot" as const,
      },
    },
  })
})

test("keeps probe classifications bounded and privacy-safe", () => {
  const classification = classifyAnalyticsRequest(
    new Request("https://i0c.cc/.env.production", {
      headers: { "User-Agent": "custom-client" },
    }),
    "/.env.production",
  )

  assert.deepEqual(classification, {
    botCategory: "security_probe",
    botConfidence: "medium",
    deviceType: "bot",
    probeCategory: "env_file",
    resourceClass: "unknown",
    trafficClass: "suspected_automation",
  })
})
