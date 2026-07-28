"use client";

import { Button } from "@/components/ui/controls/button";
import { AppDialog } from "@/components/ui/feedback/app-dialog";

interface ConfirmationDialogProps {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  errorMessage?: string | null;
  isOpen: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pendingLabel?: string;
  title: string;
  tone?: "danger" | "default";
}

export function ConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  errorMessage,
  isOpen,
  isPending = false,
  onCancel,
  onConfirm,
  pendingLabel,
  title,
  tone = "default",
}: ConfirmationDialogProps) {
  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onCancel}
      preventClose={isPending}
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">
          {description}
        </p>
        {errorMessage ? (
          <p
            role="alert"
            className="mt-4 border-l-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} disabled={isPending} variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {isPending ? pendingLabel ?? confirmLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
