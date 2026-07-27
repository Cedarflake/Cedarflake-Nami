import type { LineDiffRow } from "@/lib/data/line-diff";

interface RevisionDiffTableRowProps {
  omittedLabel: string;
  row: LineDiffRow;
  showOldLineNumbers: boolean;
}

export function RevisionDiffTableRow({
  omittedLabel,
  row,
  showOldLineNumbers,
}: RevisionDiffTableRowProps) {
  if (row.kind === "omission") {
    return (
      <tr className="border-y border-line bg-panel-muted text-muted">
        <td className="px-3 py-1 text-center" colSpan={showOldLineNumbers ? 4 : 3}>
          {omittedLabel}
        </td>
      </tr>
    );
  }

  const marker = row.kind === "addition"
    ? "+"
    : row.kind === "deletion"
      ? "-"
      : " ";
  const changeClassName = row.kind === "addition"
    ? "bg-emerald-50 text-emerald-950"
    : row.kind === "deletion"
      ? "bg-rose-50 text-rose-950"
      : "text-ink";
  const markerClassName = row.kind === "addition"
    ? "text-emerald-700"
    : row.kind === "deletion"
      ? "text-rose-700"
      : "text-muted";

  return (
    <tr>
      {showOldLineNumbers ? (
        <td className="w-9 select-none border-r border-line bg-panel-muted px-1 text-right text-muted">
          {row.oldLineNumber ?? ""}
        </td>
      ) : null}
      <td className="w-9 select-none border-r border-line bg-panel-muted px-1 text-right text-muted">
        {row.newLineNumber ?? ""}
      </td>
      <td
        aria-hidden="true"
        className={`w-7 select-none px-2 text-center font-semibold ${changeClassName} ${markerClassName}`}
      >
        {marker}
      </td>
      <td className={`whitespace-pre px-2 pr-4 ${changeClassName}`}>
        {row.content || " "}
      </td>
    </tr>
  );
}
