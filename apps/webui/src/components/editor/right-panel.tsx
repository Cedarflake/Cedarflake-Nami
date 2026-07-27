"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { JsonEditor } from "@/components/editor/json-editor";
import { RedirectSourceDialog } from "@/components/editor/redirect-source-dialog";
import { Button } from "@/components/ui/controls/button";

export type EditorMode = "rules" | "json" | "settings";

export type RightPanelProps = {
  editorMode: EditorMode;
  canRedo: boolean;
  canUndo: boolean;
  isPending: boolean;
  onRedo: () => void;
  onSave: () => void;
  onEnterRulesMode: () => void;
  onEnterJsonMode: () => void;
  jsonDraft: string;
  onJsonDraftChange: (value: string) => void;
  jsonError: string | null;
  isReadOnly: boolean;
  showSaveAction: boolean;
  supportsJsonEditor: boolean;
  supportsSourceOverride: boolean;
  onLoadSourceUrl: (url: string) => Promise<void>;
  onUndo: () => void;
  rulesContent: ReactNode;
  settingsContent: ReactNode;
  sourceUrl?: string | null;
};

export function RightPanel({
  editorMode,
  canRedo,
  canUndo,
  isPending,
  onRedo,
  onSave,
  onEnterRulesMode,
  onEnterJsonMode,
  jsonDraft,
  onJsonDraftChange,
  jsonError,
  isReadOnly,
  showSaveAction,
  supportsJsonEditor,
  supportsSourceOverride,
  onLoadSourceUrl,
  onUndo,
  rulesContent,
  settingsContent,
  sourceUrl,
}: RightPanelProps) {
  const t = useTranslations("editor");
  const tConfig = useTranslations("instanceConfig");
  const tGroups = useTranslations("groups");
  const showRuleActions = editorMode !== "settings";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between lg:pb-4">
        {editorMode === "settings" ? (
          <h1 className="text-xl font-semibold text-ink">{tConfig("title")}</h1>
        ) : supportsJsonEditor ? (
          <div className="grid w-fit grid-cols-2 gap-1 rounded-xl bg-panel-muted p-1">
            <Button
              onClick={onEnterRulesMode}
              size="sm"
              variant={editorMode === "rules" ? "primary" : "ghost"}
            >
              {t("rules")}
            </Button>
            <Button
              onClick={onEnterJsonMode}
              size="sm"
              variant={editorMode === "json" ? "primary" : "ghost"}
            >
              {t("json")}
            </Button>
          </div>
        ) : (
          <h1 className="text-xl font-semibold text-ink">{t("rules")}</h1>
        )}

        {isReadOnly ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {showRuleActions ? (
              <>
                {supportsSourceOverride ? (
                  <RedirectSourceDialog
                    disabled={isPending}
                    sourceUrl={sourceUrl}
                    onLoad={onLoadSourceUrl}
                  />
                ) : null}
                <Button
                  onClick={onUndo}
                  disabled={!canUndo || isPending}
                  size="icon"
                  variant="secondary"
                  title={tGroups("undo")}
                  aria-label={tGroups("undo")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M9 14l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 20a8 8 0 0 0-8-8H5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
                <Button
                  onClick={onRedo}
                  disabled={!canRedo || isPending}
                  size="icon"
                  variant="secondary"
                  title={tGroups("redo")}
                  aria-label={tGroups("redo")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M15 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 20a8 8 0 0 1 8-8h7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              </>
            ) : null}
            {showSaveAction ? (
              <Button
                onClick={onSave}
                disabled={isPending}
                size="sm"
                variant="primary"
              >
                {isPending ? tGroups("saving") : tGroups("save")}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {editorMode === "settings" ? (
        settingsContent
      ) : editorMode === "json" ? (
        <JsonEditor
          jsonDraft={jsonDraft}
          onJsonDraftChange={onJsonDraftChange}
          jsonError={jsonError}
          isReadOnly={isReadOnly}
        />
      ) : (
        rulesContent
      )}
    </div>
  );
}
