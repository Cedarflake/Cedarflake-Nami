"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { AppDialog } from "@/components/ui/feedback/app-dialog";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";
import {
  normalizeRouteDescriptionInput,
  setRouteDescription,
  stripRetiredProxyPolicy,
} from "@/composables/editor/route-utils";
import type { RedirectsMutationResult } from "@/composables/redirects-groups";
import type { RedirectEntryDraft } from "@/composables/redirects-groups/model";

import { RouteEntryEditor } from "./route-entry/route-entry-editor";

interface NewRouteEntryDialogProps {
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (draft: RedirectEntryDraft) => Promise<RedirectsMutationResult>;
  savesImmediately: boolean;
}

export function NewRouteEntryDialog({
  groupName,
  isOpen,
  onClose,
  onCreate,
  savesImmediately,
}: NewRouteEntryDialogProps) {
  const t = useTranslations("entries");
  const [pathKey, setPathKey] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState<unknown>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const normalizedPathKey = pathKey.trim();
  const canCreate = normalizedPathKey.length > 0;

  async function createEntry() {
    if (!canCreate || isSaving) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await onCreate({
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
      ariaLabelledBy="new-route-entry-title"
      isOpen={isOpen}
      onClose={onClose}
      preventClose={isSaving}
      widthClassName="max-w-3xl"
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void createEntry();
        }}
        className="p-0"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-6">
          <div>
            <h2
              id="new-route-entry-title"
              className="text-lg font-semibold text-ink"
            >
              {t("newRuleTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {t("newRuleDescription", { group: groupName })}
            </p>
          </div>
          <Button
            onClick={onClose}
            disabled={isSaving}
            size="icon"
            variant="ghost"
            title={t("newRuleCancel")}
            aria-label={t("newRuleCancel")}
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
          <div>
            <label className={fieldLabelRowClassName}>
              <span className={fieldLabelClassName}>{t("pathKey")}</span>
            </label>
            <input
              value={pathKey}
              onChange={(event) => setPathKey(event.target.value)}
              placeholder={t("pathKeyPlaceholder")}
              className={formControlClassName({ className: "w-full" })}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
            <p className="mt-1.5 text-xs leading-5 text-muted">
              {t("newRulePathHint")}
            </p>
          </div>

          <div className="mt-5">
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
          </div>

          <div className="mt-5">
            <RouteEntryEditor
              pathKey={normalizedPathKey}
              value={value}
              onChange={setValue}
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
        </div>

        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-line bg-panel px-5 py-4 sm:px-6">
          <Button
            onClick={onClose}
            disabled={isSaving}
            variant="secondary"
          >
            {t("newRuleCancel")}
          </Button>
          <Button
            type="submit"
            disabled={!canCreate || isSaving}
            isPending={isSaving}
            pendingLabel={t("savingRule")}
            variant="primary"
          >
            {t(savesImmediately ? "saveNewRule" : "newRuleCreate")}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
