import type { PluginManifest } from "@i0c/plugin-api";

interface DataRepositoryEditorCapabilities {
  supportsJsonEditor: boolean;
  supportsSourceOverride: boolean;
}

export function resolveDataRepositoryEditorCapabilities(
  manifest: Pick<PluginManifest, "capabilities">,
): DataRepositoryEditorCapabilities {
  return {
    supportsJsonEditor: manifest.capabilities.includes(
      "ui:redirects-json-editor",
    ),
    supportsSourceOverride: manifest.capabilities.includes(
      "ui:redirects-source-override",
    ),
  };
}
