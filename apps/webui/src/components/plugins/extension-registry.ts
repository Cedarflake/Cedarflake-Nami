import { StaticWebUiExtensionRegistry } from "@nami/plugin-api";
import type { WebUiExtensionRegistration } from "@nami/plugin-api";
import {
  webUiExtensionInstallations,
  type WebUiExtensionRenderer,
} from "@nami/webui-extensions";

export function createWebUiExtensionRegistry(
  installations: readonly WebUiExtensionRegistration<WebUiExtensionRenderer>[]
    = webUiExtensionInstallations,
): StaticWebUiExtensionRegistry<WebUiExtensionRenderer> {
  return new StaticWebUiExtensionRegistry(installations);
}

export const installedWebUiExtensions = createWebUiExtensionRegistry();
