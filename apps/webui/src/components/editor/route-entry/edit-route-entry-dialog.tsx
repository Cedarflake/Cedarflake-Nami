"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { WebUiPluginSlot } from "@/components/plugins/plugin-slot";
import { Button } from "@/components/ui/controls/button";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";
import { AppDialog } from "@/components/ui/feedback/app-dialog";
import {
  getRouteDescription,
  normalizeRouteDescriptionInput,
  setRouteDescription,
  stripRetiredProxyPolicy,
} from "@/composables/editor/route-utils";
import type {
  RedirectEntry,
  RedirectEntryDraft,
  RedirectGroup,
} from "@/composables/redirects-groups/model";
import type { RedirectsMutationResult } from "@/composables/redirects-groups";

import { RouteEntryEditor } from "./route-entry-editor";

interface EditRouteEntryDialogProps {
  entry: RedirectEntry;
  group: RedirectGroup;
  isReadOnly: boolean;
  savesImmediately: boolean;
  onApply: (draft: RedirectEntryDraft) => Promise<RedirectsMutationResult>;
  onClose: () => void;
}

export function EditRouteEntryDialog({
  entry,
  group,
  isReadOnly,
  savesImmediately,
  onApply,
  onClose,
}: EditRouteEntryDialogProps) {
  const t = useTranslations("entries");
  const routeT = useTranslations("routeEntry");
  const [pathKey, setPathKey] = useState(entry.key);
  const [description, setDescription] = useState(
    getRouteDescription(entry.value),
  );
  const [value, setValue] = useState(entry.value);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isProxyOptionsOpen, setIsProxyOptionsOpen] = useState(false);
  const normalizedPathKey = pathKey.trim();
  const canApply = normalizedPathKey.length > 0;
  const draftEntry: RedirectEntry = {
    ...entry,
    key: pathKey,
    value,
  };

  function closeDialog() {
    setIsProxyOptionsOpen(false);
    onClose();
  }

  async function applyEntry() {
    if (!canApply || isReadOnly || isSaving) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await onApply({
        key: normalizedPathKey,
        value: setRouteDescription(
          stripRetiredProxyPolicy(value),
          description,
        ),
      });
      setIsSaving(false);
      if (result.isSuccess) {
        closeDialog();
        return;
      }
      setSaveError(result.errorMessage ?? t("saveRuleFail"));
    } catch (error) {
      setIsSaving(false);
      setSaveError(
        error instanceof Error ? error.message : t("saveRuleFail"),
      );
    }
  }

  return (
    <AppDialog
      ariaLabelledBy="edit-route-entry-title"
      isOpen
      onClose={closeDialog}
      preventClose={isSaving}
      scrollResetKey={isProxyOptionsOpen}
      widthClassName="max-w-4xl"
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (isReadOnly) {
            closeDialog();
            return;
          }
          void applyEntry();
        }}
        className="p-0"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-6">
          <div className={`flex min-w-0 gap-2 ${isProxyOptionsOpen ? "items-center" : "items-start"}`}>
            {isProxyOptionsOpen ? (
              <Button
                aria-label={routeT("proxyAdvancedBack")}
                onClick={() => setIsProxyOptionsOpen(false)}
                size="icon"
                variant="ghost"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            ) : null}
            <div className="min-w-0">
              <h2
                id="edit-route-entry-title"
                className="text-lg font-semibold text-ink"
              >
                {isProxyOptionsOpen
                  ? routeT("proxyAdvancedTitle")
                  : t(isReadOnly ? "viewRuleTitle" : "editRuleTitle")}
              </h2>
              {!isProxyOptionsOpen ? (
                <p className="mt-1 text-sm leading-6 text-muted">
                  {t("editRuleDescription", {
                    path: entry.key.trim() || t("rulePathMissing"),
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            onClick={closeDialog}
            disabled={isSaving}
            size="icon"
            variant="ghost"
            title={t("closeRule")}
            aria-label={t("closeRule")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </Button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {!isProxyOptionsOpen ? <div>
            <label className={fieldLabelRowClassName}>
              <span className={fieldLabelClassName}>{t("pathKey")}</span>
            </label>
            <input
              value={pathKey}
              onChange={(event) => setPathKey(event.target.value)}
              placeholder={t("pathKeyPlaceholder")}
              readOnly={isReadOnly}
              className={formControlClassName({ className: "w-full" })}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div> : null}

          {!isProxyOptionsOpen ? <div className="mt-5">
            <label className={fieldLabelRowClassName}>
              <span className={fieldLabelClassName}>
                {t("ruleDescription")}
              </span>
            </label>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(normalizeRouteDescriptionInput(event.target.value));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                }
              }}
              placeholder={t("ruleDescriptionPlaceholder")}
              maxLength={500}
              readOnly={isReadOnly}
              rows={3}
              wrap="soft"
              className={formControlClassName({
                className: "w-full resize-none leading-6",
                size: "textarea",
              })}
            />
            <p className="mt-1.5 text-xs leading-5 text-muted">
              {t("ruleDescriptionHint")}
            </p>
          </div> : null}

          <div className={isProxyOptionsOpen ? "" : "mt-5"}>
            <RouteEntryEditor
              pathKey={normalizedPathKey}
              value={value}
              onChange={setValue}
              isReadOnly={isReadOnly}
              isProxyOptionsOpen={isProxyOptionsOpen}
              onProxyOptionsOpenChange={setIsProxyOptionsOpen}
            />
            {!isProxyOptionsOpen ? (
              <WebUiPluginSlot
                name="rule-editor.fields"
                context={{ entry: draftEntry, group, isReadOnly }}
              />
            ) : null}
          </div>

          {saveError ? (
            <p
              role="alert"
              className="mt-5 border-l-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {saveError}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-line bg-panel px-5 py-4 sm:px-6">
          {isReadOnly ? (
            <Button type="submit" variant="primary">
              {t("closeRule")}
            </Button>
          ) : (
            <>
              <Button
                onClick={closeDialog}
                disabled={isSaving}
                variant="secondary"
              >
                {t("editRuleCancel")}
              </Button>
              <Button
                type="submit"
                disabled={!canApply || isSaving}
                isPending={isSaving}
                pendingLabel={t("savingRule")}
                variant="primary"
              >
                {t(savesImmediately ? "saveRuleChanges" : "editRuleApply")}
              </Button>
            </>
          )}
        </div>
      </form>
    </AppDialog>
  );
}
