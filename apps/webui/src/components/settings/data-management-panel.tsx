"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  DataDocumentKind,
  DataDocumentRevision,
  DataDocumentRevisionSummary,
} from "@i0c/config";

import {
  Button,
  buttonClassName,
} from "@/components/ui/controls/button";
import { AppDialog } from "@/components/ui/feedback/app-dialog";
import { ConfirmationDialog } from "@/components/ui/feedback/confirmation-dialog";
import {
  SkeletonBlock,
  SkeletonPulse,
} from "@/components/ui/feedback/skeletons";

interface DataManagementPanelProps {
  hasUnsavedChanges: boolean;
  isReadOnly: boolean;
}

interface HistoryResponse {
  revisions: DataDocumentRevisionSummary[];
}

interface DocumentResponse {
  revision: DataDocumentRevision;
}

interface PendingRestore {
  kind: DataDocumentKind;
  revision: string;
}

const maximumDocumentSize = 1_000_000;

export function DataManagementPanel({
  hasUnsavedChanges,
  isReadOnly,
}: DataManagementPanelProps) {
  const t = useTranslations("instanceConfig.dataManagement");
  const locale = useLocale();
  const [selectedKind, setSelectedKind] =
    useState<DataDocumentKind>("config");
  const [revisions, setRevisions] =
    useState<readonly DataDocumentRevisionSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!isReadOnly);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [redirectsFile, setRedirectsFile] = useState<File | null>(null);
  const [pendingRestore, setPendingRestore] =
    useState<PendingRestore | null>(null);
  const [isImportConfirmationOpen, setIsImportConfirmationOpen] =
    useState(false);
  const [preview, setPreview] = useState<DataDocumentRevision | null>(null);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    [locale],
  );

  useEffect(() => {
    if (isReadOnly) {
      return;
    }

    const controller = new AbortController();
    void fetchHistory(selectedKind, controller.signal)
      .then((nextRevisions) => {
        if (!controller.signal.aborted) {
          setRevisions(nextRevisions);
        }
      })
      .catch((caughtError: unknown) => {
        if (!controller.signal.aborted) {
          setError(resolveErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isReadOnly, selectedKind]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
    kind: DataDocumentKind,
  ) {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > maximumDocumentSize) {
      event.target.value = "";
      setError(t("errors.fileTooLarge"));
      if (kind === "config") {
        setConfigFile(null);
      } else {
        setRedirectsFile(null);
      }
      return;
    }
    setError(null);
    if (kind === "config") {
      setConfigFile(file);
    } else {
      setRedirectsFile(file);
    }
  }

  function selectHistoryKind(kind: DataDocumentKind) {
    if (kind === selectedKind) {
      return;
    }
    setError(null);
    setRevisions([]);
    setIsLoadingHistory(true);
    setSelectedKind(kind);
  }

  async function handlePreview(
    revision: DataDocumentRevisionSummary,
  ) {
    setError(null);
    try {
      const response = await fetch(
        `/api/data/history/${revision.kind}/${revision.revision}`,
        {
          cache: "no-store",
        },
      );
      const data = await readJson<DocumentResponse>(response);
      setPreview(data.revision);
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError));
    }
  }

  async function handleRestore() {
    if (!pendingRestore || hasUnsavedChanges || isMutating) {
      return;
    }
    const restoreTarget = pendingRestore;
    setPendingRestore(null);
    setIsMutating(true);
    setError(null);
    try {
      const latest = await fetchHistory(restoreTarget.kind);
      const expectedRevision = latest[0]?.revision;
      if (!expectedRevision) {
        throw new Error(t("errors.currentRevisionUnavailable"));
      }
      const response = await fetch(
        `/api/data/history/${restoreTarget.kind}/${restoreTarget.revision}/restore`,
        {
          body: JSON.stringify({ expectedRevision }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      await readJson(response);
      window.location.reload();
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError));
      setIsMutating(false);
    }
  }

  async function handleImport() {
    if (
      !configFile
      || !redirectsFile
      || hasUnsavedChanges
      || isMutating
    ) {
      return;
    }
    setIsImportConfirmationOpen(false);
    setIsMutating(true);
    setError(null);
    try {
      const configHistory = await fetchHistory("config");
      const redirectsHistory = await fetchHistory("redirects");
      const expectedConfigRevision = configHistory[0]?.revision;
      const expectedRedirectsRevision = redirectsHistory[0]?.revision;
      if (!expectedConfigRevision || !expectedRedirectsRevision) {
        throw new Error(t("errors.currentRevisionUnavailable"));
      }
      const configContent = await configFile.text();
      const redirectsContent = await redirectsFile.text();
      const response = await fetch("/api/data/import", {
        body: JSON.stringify({
          configContent,
          expectedConfigRevision,
          expectedRedirectsRevision,
          redirectsContent,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      await readJson(response);
      window.location.reload();
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError));
      setIsMutating(false);
    }
  }

  if (isReadOnly) {
    return (
      <DataManagementSection
        description={t("description")}
        title={t("title")}
      >
        <p className="text-sm leading-6 text-muted">
          {t("managerOnly")}
        </p>
      </DataManagementSection>
    );
  }

  const currentRevision = revisions[0]?.revision;

  return (
    <>
      <div className="space-y-10 py-8">
        <DataManagementSection
          description={t("description")}
          title={t("title")}
        >
          {hasUnsavedChanges ? (
            <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("unsavedWarning")}
            </div>
          ) : null}
          {error ? (
            <div
              className="border-l-2 border-danger bg-danger/5 px-4 py-3 text-sm text-danger"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </DataManagementSection>

        <DataManagementSection
          description={t("export.description")}
          title={t("export.title")}
        >
          <div className="flex flex-wrap gap-2">
            <a
              className={buttonClassName()}
              download="config.json"
              href="/api/data/export/config"
            >
              {t("export.config")}
            </a>
            <a
              className={buttonClassName()}
              download="redirects.json"
              href="/api/data/export/redirects"
            >
              {t("export.redirects")}
            </a>
          </div>
        </DataManagementSection>

        <DataManagementSection
          description={t("import.description")}
          title={t("import.title")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FilePicker
              file={configFile}
              id="data-import-config"
              label={t("import.config")}
              onChange={(event) => handleFileChange(event, "config")}
            />
            <FilePicker
              file={redirectsFile}
              id="data-import-redirects"
              label={t("import.redirects")}
              onChange={(event) => handleFileChange(event, "redirects")}
            />
          </div>
          <Button
            className="mt-4"
            disabled={
              isMutating
              || hasUnsavedChanges
              || !configFile
              || !redirectsFile
            }
            onClick={() => setIsImportConfirmationOpen(true)}
            variant="primary"
          >
            {t("import.action")}
          </Button>
        </DataManagementSection>

        <DataManagementSection
          description={t("history.description")}
          title={t("history.title")}
        >
          <div className="mb-4 inline-flex rounded-xl bg-panel-muted p-1">
            {(["config", "redirects"] as const).map((kind) => (
              <button
                key={kind}
                className={[
                  "h-9 rounded-lg px-4 text-sm font-semibold transition-colors",
                  selectedKind === kind
                    ? "bg-accent text-white"
                    : "text-muted hover:text-ink",
                ].join(" ")}
                onClick={() => selectHistoryKind(kind)}
                type="button"
              >
                {t(`kinds.${kind}`)}
              </button>
            ))}
          </div>

          {isLoadingHistory ? (
            <HistorySkeleton />
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted">{t("history.empty")}</p>
          ) : (
            <ol className="divide-y divide-line border-y border-line">
              {revisions.map((revision) => {
                const isCurrent = revision.revision === currentRevision;
                return (
                  <li
                    key={`${revision.kind}:${revision.revision}`}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">
                          {t("history.revision", {
                            revision: revision.revision,
                          })}
                        </span>
                        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                          {t(`operations.${revision.operation}`)}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                            {t("history.current")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {dateFormatter.format(new Date(revision.createdAt))}
                        {revision.actorGitHubUserId
                          ? ` · ${t("history.actor", {
                              actor: revision.actorGitHubUserId,
                            })}`
                          : ""}
                      </p>
                      <p
                        className="mt-1 truncate font-mono text-[11px] text-muted"
                        title={revision.checksum}
                      >
                        {t("history.checksum", {
                          checksum: revision.checksum.slice(0, 12),
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() => void handlePreview(revision)}
                        size="sm"
                      >
                        {t("history.view")}
                      </Button>
                      <Button
                        disabled={isCurrent || hasUnsavedChanges || isMutating}
                        onClick={() => setPendingRestore({
                          kind: revision.kind,
                          revision: revision.revision,
                        })}
                        size="sm"
                      >
                        {t("history.restore")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </DataManagementSection>
      </div>

      <ConfirmationDialog
        cancelLabel={t("cancel")}
        confirmLabel={t("import.confirmAction")}
        description={t("import.confirmDescription")}
        isOpen={isImportConfirmationOpen}
        onCancel={() => {
          if (!isMutating) {
            setIsImportConfirmationOpen(false);
          }
        }}
        onConfirm={() => void handleImport()}
        title={t("import.confirmTitle")}
      />

      <ConfirmationDialog
        cancelLabel={t("cancel")}
        confirmLabel={t("history.confirmAction")}
        description={t("history.confirmDescription", {
          revision: pendingRestore?.revision ?? "",
        })}
        isOpen={pendingRestore !== null}
        onCancel={() => {
          if (!isMutating) {
            setPendingRestore(null);
          }
        }}
        onConfirm={() => void handleRestore()}
        title={t("history.confirmTitle")}
      />

      <AppDialog
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        widthClassName="max-w-4xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                {t("history.previewTitle", {
                  revision: preview?.revision ?? "",
                })}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {preview ? t(`kinds.${preview.kind}`) : ""}
              </p>
            </div>
            <Button onClick={() => setPreview(null)} size="sm">
              {t("close")}
            </Button>
          </div>
          <pre className="mt-5 max-h-[65vh] overflow-auto rounded-xl border border-line bg-panel-muted p-4 text-xs leading-6 text-ink">
            {preview?.content}
          </pre>
        </div>
      </AppDialog>
    </>
  );
}

function DataManagementSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
        {description}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FilePicker({
  file,
  id,
  label,
  onChange,
}: {
  file: File | null;
  id: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const t = useTranslations("instanceConfig.dataManagement");

  return (
    <div>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        <label
          className={buttonClassName({
            className: "shrink-0 cursor-pointer",
            size: "sm",
          })}
          htmlFor={id}
        >
          {t("import.chooseFile")}
        </label>
        <input
          accept="application/json,.json"
          className="sr-only"
          id={id}
          onChange={onChange}
          type="file"
        />
        <span className="truncate text-sm text-muted">
          {file?.name ?? t("import.noFile")}
        </span>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <SkeletonPulse className="divide-y divide-line border-y border-line">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 py-4"
        >
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-3 w-56" />
          </div>
          <SkeletonBlock className="h-8 w-28" />
        </div>
      ))}
    </SkeletonPulse>
  );
}

async function fetchHistory(
  kind: DataDocumentKind,
  signal?: AbortSignal,
): Promise<readonly DataDocumentRevisionSummary[]> {
  const response = await fetch(`/api/data/history/${kind}`, {
    cache: "no-store",
    signal,
  });
  const data = await readJson<HistoryResponse>(response);
  return data.revisions;
}

async function readJson<T = unknown>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as
    | { error?: unknown }
    | T
    | null;
  if (!response.ok) {
    const error = data && typeof data === "object" && "error" in data
      ? data.error
      : null;
    throw new Error(
      typeof error === "string"
        ? error
        : `Request failed with status ${response.status}`,
    );
  }
  return data as T;
}

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
