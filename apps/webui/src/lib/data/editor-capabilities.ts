import type { PluginManifest } from "@nami/plugin-api";

interface DataRepositoryEditorCapabilities {
  usesManualSave: boolean;
  supportsJsonEditor: boolean;
  supportsSourceOverride: boolean;
}

export function resolveDataRepositoryEditorCapabilities(
  manifest: Pick<PluginManifest, "capabilities">,
): DataRepositoryEditorCapabilities {
  return {
    usesManualSave: manifest.capabilities.includes(
      "ui:redirects-manual-save",
    ),
    supportsJsonEditor: manifest.capabilities.includes(
      "ui:redirects-json-editor",
    ),
    supportsSourceOverride: manifest.capabilities.includes(
      "ui:redirects-source-override",
    ),
  };
}
