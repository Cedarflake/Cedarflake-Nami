import { StaticPluginRegistry } from "@nami/plugin-api"

import { runtimePluginManifests } from "./runtime"
import { webUiPluginManifests } from "./webui"

export const installedPluginManifests = [
  ...runtimePluginManifests,
  ...webUiPluginManifests,
] as const

export const installedPluginRegistry = new StaticPluginRegistry(
  installedPluginManifests,
)
