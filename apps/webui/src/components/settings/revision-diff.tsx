"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { DataDocumentRevision } from "@nami/config";

import { createLineDiff } from "@/lib/data/line-diff";

import { RevisionDiffTableRow } from "./revision-diff-table-row";

interface RevisionDiffProps {
  previousRevision: DataDocumentRevision | null;
  revision: DataDocumentRevision;
}

type RevisionView = "changes" | "json";

export function RevisionDiff({
  previousRevision,
  revision,
}: RevisionDiffProps) {
  const t = useTranslations("instanceConfig.dataManagement.history");
  const [view, setView] = useState<RevisionView>("changes");
  const diff = useMemo(
    () => createLineDiff(previousRevision?.content ?? null, revision.content),
    [previousRevision?.content, revision.content],
  );
  const revisionLines = useMemo(
    () => revision.content.replace(/\r\n?/g, "\n").split("\n"),
    [revision.content],
  );

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl bg-panel-muted p-1">
          {(["changes", "json"] as const).map((candidate) => (
            <button
              key={candidate}
              className={[
                "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                view === candidate
                  ? "bg-accent text-white"
                  : "text-muted hover:text-ink",
              ].join(" ")}
              onClick={() => setView(candidate)}
              type="button"
            >
              {t(`views.${candidate}`)}
            </button>
          ))}
        </div>

        {view === "changes" ? (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted">
              {previousRevision
                ? t("comparedWith", {
                    revision: previousRevision.revision,
                  })
                : t("initialRevision")}
            </span>
            <span className="font-mono font-semibold text-emerald-700">
              +{diff.additions}
            </span>
            <span className="font-mono font-semibold text-rose-700">
              -{diff.deletions}
            </span>
          </div>
        ) : null}
      </div>

      {view === "json" ? (
        <div className="mt-4 max-h-[65vh] overflow-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-max border-collapse font-mono text-xs leading-6">
            <tbody>
              {revisionLines.map((line, index) => (
                <tr key={index}>
                  <td className="w-9 select-none border-r border-line bg-panel-muted px-1 text-right text-muted">
                    {index + 1}
                  </td>
                  <td className="whitespace-pre px-3 pr-4 text-ink">
                    {line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : diff.additions === 0 && diff.deletions === 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-panel-muted px-4 py-8 text-center text-sm text-muted">
          {t("noChanges")}
        </div>
      ) : (
        <div className="mt-4 max-h-[65vh] overflow-auto rounded-xl border border-line bg-panel">
          <table
            aria-label={t("diffLabel")}
            className="w-full min-w-max border-collapse font-mono text-xs leading-6"
          >
            <tbody>
              {diff.rows.map((row, index) => (
                <RevisionDiffTableRow
                  key={createRowKey(row, index)}
                  row={row}
                  showOldLineNumbers={previousRevision !== null}
                  omittedLabel={
                    row.kind === "omission"
                      ? t("omittedLines", { count: row.count })
                      : ""
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function createRowKey(
  row: ReturnType<typeof createLineDiff>["rows"][number],
  index: number,
): string {
  return row.kind === "omission"
    ? `omission:${index}`
    : `${row.kind}:${row.oldLineNumber ?? ""}:${row.newLineNumber ?? ""}`;
}
