import type { AnalyticsClassificationHookContext } from "@nami/analytics-domain/classification"
import type { RuntimeFeatureRegistration } from "@nami/plugin-api"
import { defineRuntimeFeatureManifest } from "@nami/plugin-sdk"
import { defineRuntimeFeaturePlugin } from "@nami/plugin-sdk/runtime"

export const externalRuntimeFeatureManifest = defineRuntimeFeatureManifest({
  id: "@example/runtime-feature-external",
  name: "External Runtime feature fixture",
  version: "1.0.0",
  slot: "feature:external-fixture",
  capabilities: ["hook:on-analytics-event"],
  description: {
    summary: {
      en: "Passes analytics events through an external Runtime feature.",
      "zh-CN": "通过外部 Runtime Feature 原样传递统计事件。",
    },
  },
  config: { version: 1 },
  secrets: {},
})

export const externalRuntimeFeaturePlugin = defineRuntimeFeaturePlugin({
  manifest: externalRuntimeFeatureManifest,
  create: (): RuntimeFeatureRegistration<AnalyticsClassificationHookContext> => ({
    id: externalRuntimeFeatureManifest.id,
    order: 1_000,
    timeoutMs: 10,
    failurePolicy: "continue",
    hooks: {
      onAnalyticsEvent: (context) => context,
    },
  }),
})
