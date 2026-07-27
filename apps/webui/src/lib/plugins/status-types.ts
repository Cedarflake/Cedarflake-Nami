import type {
  PluginDescriptionManifest,
  PluginHost,
  PluginKind,
} from "@i0c/plugin-api";

export type PluginConfigurationState = "compatibility" | "configured" | "disabled";
export type PluginStatusHealth =
  | "degraded"
  | "disabled"
  | "healthy"
  | "not-supported"
  | "unavailable"
  | "unhealthy";

export interface WebUiPluginStatus {
  apiVersion: number;
  bindingsObservable: boolean;
  capabilities: readonly string[];
  configurationState: PluginConfigurationState;
  description?: PluginDescriptionManifest;
  health: PluginStatusHealth;
  hosts: readonly PluginHost[];
  id: string;
  kind: PluginKind;
  missingSecretBindings: readonly string[];
  name: string;
  version: string;
}

export interface WebUiPluginStatusSnapshot {
  plugins: readonly WebUiPluginStatus[];
}
