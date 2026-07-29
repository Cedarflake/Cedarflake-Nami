"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { AppDialog } from "@/components/ui/feedback/app-dialog";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  isSaving: boolean;
  kind: "rules" | "settings";
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function UnsavedChangesDialog({
  isOpen,
  isSaving,
  kind,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  const t = useTranslations("unsavedChanges");

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onCancel}
      preventClose={isSaving}
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">
          {t(kind === "settings" ? "settingsTitle" : "rulesTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t(kind === "settings" ? "settingsDescription" : "rulesDescription")}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={onCancel}
            disabled={isSaving}
            variant="ghost"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={onDiscard}
            disabled={isSaving}
            variant="secondary"
          >
            {t("discard")}
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            isPending={isSaving}
            pendingLabel={t("saving")}
            variant="primary"
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
