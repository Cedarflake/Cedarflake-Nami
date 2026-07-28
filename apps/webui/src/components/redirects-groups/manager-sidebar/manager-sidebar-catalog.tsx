'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { ConfirmationDialog } from "@/components/ui/feedback/confirmation-dialog";
import type { RedirectEntry } from "@/composables/redirects-groups/model";
import type { RedirectsMutationResult } from "@/composables/redirects-groups";

export type RouteEntriesCatalogProps = {
  entries: RedirectEntry[];
  className?: string;
  hideHeader?: boolean;
  title?: string;
  onAddRule?: () => void;
  addRuleLabel?: string;
  onLocateEntry?: (entryId: string) => void;
  onRemoveEntry?: (entryId: string) => Promise<RedirectsMutationResult>;
  showLocateButton?: boolean;
};

export function RouteEntriesCatalog({
  entries,
  className,
  hideHeader,
  title,
  onAddRule,
  addRuleLabel,
  onLocateEntry,
  onRemoveEntry,
  showLocateButton,
}: RouteEntriesCatalogProps) {
  const tEntries = useTranslations("entries");
  const [entriesExpanded, setEntriesExpanded] = useState(true);
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!entries.length) {
    return null;
  }

  const headerTitle = title ?? "Entries";
  const addLabel = addRuleLabel ?? tEntries("addRule");
  const deleteLabel = tEntries("deleteRule");
  const locateLabel = tEntries("locate");
  const allowToggle = !hideHeader;
  const showList = !allowToggle || entriesExpanded;

  const renderEntryIcon = (key: string) => {
    if (!key || key === "/") {
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4 shrink-0 text-muted"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m3 10.5 9-6.5 9 6.5V20a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-4h-4v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (key.endsWith("/")) {
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4 shrink-0 text-muted"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 7a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4 shrink-0 text-muted"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 4h9l3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 4v3h3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12h6m-6 4h4" strokeLinecap="round" />
      </svg>
    );
  };

  const handleJump = (entryId: string) => {
    if (onLocateEntry) {
      onLocateEntry(entryId);
      return;
    }

    const target = document.getElementById(`entry-${entryId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const list = (
    <div
      className={[
        "flex min-h-0 flex-col",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {hideHeader ? null : (
        <div className="mb-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{headerTitle}</h2>
            <div className="flex items-center gap-2">
              {onAddRule ? (
                <Button
                  onClick={onAddRule}
                  size="sm"
                  variant="secondary"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
                    <path d="M12 6v12m6-6H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {addLabel}
                </Button>
              ) : null}

              <Button
                onClick={() => setEntriesExpanded((value) => !value)}
                size="icon-sm"
                variant="ghost"
                title={entriesExpanded ? tEntries("collapse") : tEntries("expand")}
                aria-label={entriesExpanded ? tEntries("collapse") : tEntries("expand")}
              >
                <svg
                  className={"h-4 w-4 text-muted transition-transform " + (entriesExpanded ? "rotate-180" : "")}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      )}
      {showList ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-line-strong scrollbar-track-transparent" style={{ scrollbarGutter: "stable" }}>
          <ul className="space-y-1 text-sm text-ink">
            {entries.map((entry) => (
              <li key={entry.id} className="group flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-panel-muted">
                <button
                  type="button"
                  data-navigation-close="true"
                  onClick={() => handleJump(entry.id)}
                  className="min-w-0 flex-1 truncate rounded-lg px-1 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  title={entry.key || "/"}
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm text-ink">
                    {renderEntryIcon(entry.key)}
                    <span className="block min-w-0 truncate">{entry.key || "/"}</span>
                  </span>
                </button>

                {showLocateButton ? (
                  <Button
                    data-navigation-close="true"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleJump(entry.id);
                    }}
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0"
                    aria-label={locateLabel}
                    title={locateLabel}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 2v4" strokeLinecap="round" />
                      <path d="M12 18v4" strokeLinecap="round" />
                      <path d="M2 12h4" strokeLinecap="round" />
                      <path d="M18 12h4" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </Button>
                ) : null}

                {onRemoveEntry ? (
                  <Button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPendingDeleteEntryId(entry.id);
                    }}
                    size="icon-sm"
                    variant="danger"
                    className="shrink-0"
                    aria-label={deleteLabel}
                    title={deleteLabel}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 11v6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {list}
      <ConfirmationDialog
        isOpen={pendingDeleteEntryId !== null}
        title={tEntries("deleteRuleTitle")}
        description={tEntries("confirmDeleteRule")}
        cancelLabel={tEntries("cancelDelete")}
        confirmLabel={tEntries("deleteRule")}
        errorMessage={deleteError}
        isPending={isDeleting}
        pendingLabel={tEntries("deletingRule")}
        tone="danger"
        onCancel={() => {
          setDeleteError(null);
          setPendingDeleteEntryId(null);
        }}
        onConfirm={() => {
          if (!pendingDeleteEntryId || !onRemoveEntry || isDeleting) {
            return;
          }
          setIsDeleting(true);
          setDeleteError(null);
          void onRemoveEntry(pendingDeleteEntryId)
            .then((result) => {
              if (result.isSuccess) {
                setPendingDeleteEntryId(null);
                return;
              }
              setDeleteError(result.errorMessage ?? tEntries("saveRuleFail"));
            })
            .catch((error: unknown) => {
              setDeleteError(
                error instanceof Error
                  ? error.message
                  : tEntries("saveRuleFail"),
              );
            })
            .finally(() => setIsDeleting(false));
        }}
      />
    </>
  );
}
