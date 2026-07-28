import { webUiPluginInstallations } from "@i0c/webui-config";

import { RedirectsGroupsManager } from "@/components/redirects-groups";
import { resolveDataRepositoryEditorCapabilities } from "@/lib/data/editor-capabilities";

interface RedirectsGroupsPageProps {
  initialView?: "rules" | "settings";
  isReadOnly?: boolean;
}

export function RedirectsGroupsPage({
  initialView = "rules",
  isReadOnly = false,
}: RedirectsGroupsPageProps) {
  const editorCapabilities = resolveDataRepositoryEditorCapabilities(
    webUiPluginInstallations.dataRepository.manifest,
  );

  return (
    <RedirectsGroupsManager
      initialView={initialView}
      isReadOnly={isReadOnly}
      usesManualSave={editorCapabilities.usesManualSave}
      supportsJsonEditor={editorCapabilities.supportsJsonEditor}
      supportsSourceOverride={editorCapabilities.supportsSourceOverride}
    />
  );
}
