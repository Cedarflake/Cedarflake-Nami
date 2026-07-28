'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  EditRouteEntryDialog,
} from "@/components/editor/route-entry/edit-route-entry-dialog";
import { RouteEntryCard } from "@/components/editor/route-entry/route-entry-card";
import { Button } from "@/components/ui/controls/button";
import { ConfirmationDialog } from "@/components/ui/feedback/confirmation-dialog";
import type {
  RedirectEntryDraft,
  RedirectGroup,
} from "@/composables/redirects-groups/model";
import type { RedirectsMutationResult } from "@/composables/redirects-groups";

export type GroupEntriesEditorProps = {
  group: RedirectGroup;
  isReadOnly: boolean;
  savesImmediately: boolean;
  onAddEntry: (groupId: string) => void;
  onRemoveEntry: (
    groupId: string,
    entryId: string,
  ) => Promise<RedirectsMutationResult>;
  onUpdateEntry: (
    groupId: string,
    entryId: string,
    draft: RedirectEntryDraft,
  ) => Promise<RedirectsMutationResult>;
};

export function GroupEntriesEditor({
  group,
  isReadOnly,
  savesImmediately,
  onAddEntry,
  onRemoveEntry,
  onUpdateEntry,
}: GroupEntriesEditorProps) {
  const t = useTranslations("entries");
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const editingEntry = editingEntryId
    ? group.entries.find((entry) => entry.id === editingEntryId) ?? null
    : null;

  async function confirmDeleteEntry() {
    if (!pendingDeleteEntryId || isDeleting) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await onRemoveEntry(group.id, pendingDeleteEntryId);
      setIsDeleting(false);
      if (result.isSuccess) {
        setPendingDeleteEntryId(null);
        return;
      }
      setDeleteError(result.errorMessage ?? t("saveRuleFail"));
    } catch (error) {
      setIsDeleting(false);
      setDeleteError(
        error instanceof Error ? error.message : t("saveRuleFail"),
      );
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-muted"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M3 7a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1 className="text-lg font-semibold text-ink">{group.name}</h1>
          </div>
          <p className="mt-1 text-sm text-muted">{t("description")}</p>
        </div>

        {isReadOnly ? null : (
          <Button
            onClick={() => onAddEntry(group.id)}
            size="sm"
            variant="secondary"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
              <path d="M12 6v12m6-6H6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("addRule")}
          </Button>
        )}
      </div>

      {group.entries.length === 0 ? (
        <div className="mt-6 border-l-2 border-line-strong bg-panel-muted px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted">
                {t(isReadOnly ? "emptyReadOnlyHint" : "emptyHint")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {group.entries.map((entry) => (
            <RouteEntryCard
              key={entry.id}
              entry={entry}
              isReadOnly={isReadOnly}
              onOpen={() => setEditingEntryId(entry.id)}
              onDelete={() => setPendingDeleteEntryId(entry.id)}
            />
          ))}
        </div>
      )}

      {editingEntry ? (
        <EditRouteEntryDialog
          key={editingEntry.id}
          entry={editingEntry}
          group={group}
          isReadOnly={isReadOnly}
          savesImmediately={savesImmediately}
          onClose={() => setEditingEntryId(null)}
          onApply={(draft) =>
            onUpdateEntry(group.id, editingEntry.id, draft)
          }
        />
      ) : null}

      <ConfirmationDialog
        isOpen={pendingDeleteEntryId !== null}
        title={t("deleteRuleTitle")}
        description={t("confirmDeleteRule")}
        cancelLabel={t("cancelDelete")}
        confirmLabel={t("deleteRule")}
        errorMessage={deleteError}
        isPending={isDeleting}
        pendingLabel={t("deletingRule")}
        tone="danger"
        onCancel={() => {
          setDeleteError(null);
          setPendingDeleteEntryId(null);
        }}
        onConfirm={() => void confirmDeleteEntry()}
      />
    </div>
  );
}
