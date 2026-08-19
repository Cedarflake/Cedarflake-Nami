import type { PluginLogger } from "@nami/plugin-api";

export const runtimePluginLogger = {
  debug(message, metadata) {
    console.debug(`[Plugin] ${message}`, metadata ?? "");
  },
  info(message, metadata) {
    console.info(`[Plugin] ${message}`, metadata ?? "");
  },
  warn(message, metadata) {
    console.warn(`[Plugin] ${message}`, metadata ?? "");
  },
  error(message, metadata) {
    console.error(`[Plugin] ${message}`, metadata ?? "");
  }
} satisfies PluginLogger;
