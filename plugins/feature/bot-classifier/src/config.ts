import type { JsonObject } from "@nami/plugin-api"

export interface BotClassifierConfig {
  hookTimeoutMs: number
}

export const defaultBotClassifierConfig = {
  hookTimeoutMs: 20,
} as const satisfies BotClassifierConfig

export const botClassifierConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: ["hookTimeoutMs"],
  properties: {
    hookTimeoutMs: { type: "integer", minimum: 1, maximum: 100 },
  },
} satisfies JsonObject

export function resolveBotClassifierConfig(
  value: JsonObject | undefined,
): BotClassifierConfig {
  return {
    hookTimeoutMs: typeof value?.hookTimeoutMs === "number"
      ? value.hookTimeoutMs
      : defaultBotClassifierConfig.hookTimeoutMs,
  }
}
