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
  const [pathKey, setPathKey] = useState(entry.key);
  const [description, setDescription] = useState(
    getRouteDescription(entry.value),
  );
  const [value, setValue] = useState(entry.value);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const normalizedPathKey = pathKey.trim();
  const canApply = normalizedPathKey.length > 0;
  const draftEntry: RedirectEntry = {
    ...entry,
    key: pathKey,
    value,
  };

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
        onClose();
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
      onClose={onClose}
      preventClose={isSaving}
      widthClassName="max-w-4xl"
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (isReadOnly) {
            onClose();
            return;
          }
          void applyEntry();
        }}
        className="p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="edit-route-entry-title"
              className="text-lg font-semibold text-ink"
            >
              {t(isReadOnly ? "viewRuleTitle" : "editRuleTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {t("editRuleDescription", {
                path: entry.key.trim() || t("rulePathMissing"),
              })}
            </p>
          </div>
          <Button
            onClick={onClose}
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

        <div className="mt-5">
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
        </div>

        <div className="mt-5">
          <label className={fieldLabelRowClassName}>
            <span className={fieldLabelClassName}>
              {t("ruleDescription")}
            </span>
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("ruleDescriptionPlaceholder")}
            maxLength={500}
            readOnly={isReadOnly}
            className={formControlClassName({
              className: "w-full resize-y",
              size: "textarea",
            })}
          />
          <p className="mt-1.5 text-xs leading-5 text-muted">
            {t("ruleDescriptionHint")}
          </p>
        </div>

        <div className="mt-5">
          <RouteEntryEditor
            pathKey={normalizedPathKey}
            value={value}
            onChange={setValue}
            isReadOnly={isReadOnly}
          />
          <WebUiPluginSlot
            name="rule-editor.fields"
            context={{ entry: draftEntry, group, isReadOnly }}
          />
        </div>

        {saveError ? (
          <p
            role="alert"
            className="mt-5 border-l-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {saveError}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          {isReadOnly ? (
            <Button type="submit" variant="primary">
              {t("closeRule")}
            </Button>
          ) : (
            <>
              <Button
                onClick={onClose}
                disabled={isSaving}
                variant="secondary"
              >
                {t("editRuleCancel")}
              </Button>
              <Button
                type="submit"
                disabled={!canApply || isSaving}
                variant="primary"
              >
                {isSaving
                  ? t("savingRule")
                  : t(savesImmediately ? "saveRuleChanges" : "editRuleApply")}
              </Button>
            </>
          )}
        </div>
      </form>
    </AppDialog>
  );
}
