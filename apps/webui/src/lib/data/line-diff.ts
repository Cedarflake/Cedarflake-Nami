export type LineDiffRow =
  | {
      content: string;
      kind: "addition" | "context" | "deletion";
      newLineNumber: number | null;
      oldLineNumber: number | null;
    }
  | {
      count: number;
      kind: "omission";
    };

export interface LineDiffResult {
  additions: number;
  deletions: number;
  rows: readonly LineDiffRow[];
}

interface RawLineDiffRow {
  content: string;
  kind: "addition" | "context" | "deletion";
  newLineNumber: number | null;
  oldLineNumber: number | null;
}

const maximumLcsMatrixCells = 1_000_000;
const defaultContextLineCount = 3;

export function createLineDiff(
  previousContent: string | null,
  currentContent: string,
  contextLineCount = defaultContextLineCount,
): LineDiffResult {
  if (!Number.isInteger(contextLineCount) || contextLineCount < 0) {
    throw new TypeError("Diff context line count must be a non-negative integer");
  }

  const previousLines = splitLines(previousContent ?? "");
  const currentLines = splitLines(currentContent);
  const rawRows = createRawRows(previousLines, currentLines);

  return {
    additions: rawRows.filter((row) => row.kind === "addition").length,
    deletions: rawRows.filter((row) => row.kind === "deletion").length,
    rows: collapseContextRows(rawRows, contextLineCount),
  };
}

function createRawRows(
  previousLines: readonly string[],
  currentLines: readonly string[],
): readonly RawLineDiffRow[] {
  const prefixLength = findCommonPrefixLength(previousLines, currentLines);
  const suffixLength = findCommonSuffixLength(
    previousLines,
    currentLines,
    prefixLength,
  );
  const previousMiddle = previousLines.slice(
    prefixLength,
    previousLines.length - suffixLength,
  );
  const currentMiddle = currentLines.slice(
    prefixLength,
    currentLines.length - suffixLength,
  );
  const middleOperations = createMiddleOperations(
    previousMiddle,
    currentMiddle,
  );
  const operations = [
    ...previousLines.slice(0, prefixLength).map((content) => ({
      content,
      kind: "context" as const,
    })),
    ...middleOperations,
    ...previousLines.slice(previousLines.length - suffixLength).map(
      (content) => ({
        content,
        kind: "context" as const,
      }),
    ),
  ];

  let oldLineNumber = 1;
  let newLineNumber = 1;
  return operations.map((operation): RawLineDiffRow => {
    if (operation.kind === "addition") {
      return {
        ...operation,
        newLineNumber: newLineNumber++,
        oldLineNumber: null,
      };
    }
    if (operation.kind === "deletion") {
      return {
        ...operation,
        newLineNumber: null,
        oldLineNumber: oldLineNumber++,
      };
    }
    return {
      ...operation,
      newLineNumber: newLineNumber++,
      oldLineNumber: oldLineNumber++,
    };
  });
}

function createMiddleOperations(
  previousLines: readonly string[],
  currentLines: readonly string[],
): readonly {
  content: string;
  kind: "addition" | "context" | "deletion";
}[] {
  if (previousLines.length * currentLines.length > maximumLcsMatrixCells) {
    return [
      ...previousLines.map((content) => ({
        content,
        kind: "deletion" as const,
      })),
      ...currentLines.map((content) => ({
        content,
        kind: "addition" as const,
      })),
    ];
  }

  const columnCount = currentLines.length + 1;
  const table = new Uint32Array((previousLines.length + 1) * columnCount);
  for (let oldIndex = previousLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (
      let newIndex = currentLines.length - 1;
      newIndex >= 0;
      newIndex -= 1
    ) {
      const tableIndex = oldIndex * columnCount + newIndex;
      table[tableIndex] = previousLines[oldIndex] === currentLines[newIndex]
        ? table[(oldIndex + 1) * columnCount + newIndex + 1] + 1
        : Math.max(
            table[(oldIndex + 1) * columnCount + newIndex],
            table[tableIndex + 1],
          );
    }
  }

  const operations: {
    content: string;
    kind: "addition" | "context" | "deletion";
  }[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (
    oldIndex < previousLines.length
    && newIndex < currentLines.length
  ) {
    if (previousLines[oldIndex] === currentLines[newIndex]) {
      operations.push({
        content: previousLines[oldIndex] ?? "",
        kind: "context",
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }
    const deletionScore = table[(oldIndex + 1) * columnCount + newIndex];
    const additionScore = table[oldIndex * columnCount + newIndex + 1];
    if (deletionScore >= additionScore) {
      operations.push({
        content: previousLines[oldIndex] ?? "",
        kind: "deletion",
      });
      oldIndex += 1;
    } else {
      operations.push({
        content: currentLines[newIndex] ?? "",
        kind: "addition",
      });
      newIndex += 1;
    }
  }
  while (oldIndex < previousLines.length) {
    operations.push({
      content: previousLines[oldIndex] ?? "",
      kind: "deletion",
    });
    oldIndex += 1;
  }
  while (newIndex < currentLines.length) {
    operations.push({
      content: currentLines[newIndex] ?? "",
      kind: "addition",
    });
    newIndex += 1;
  }
  return operations;
}

function collapseContextRows(
  rows: readonly RawLineDiffRow[],
  contextLineCount: number,
): readonly LineDiffRow[] {
  const collapsed: LineDiffRow[] = [];
  let index = 0;
  while (index < rows.length) {
    if (rows[index]?.kind !== "context") {
      const row = rows[index];
      if (row) {
        collapsed.push(row);
      }
      index += 1;
      continue;
    }

    const start = index;
    while (index < rows.length && rows[index]?.kind === "context") {
      index += 1;
    }
    const contextRows = rows.slice(start, index);
    if (contextLineCount === 0) {
      collapsed.push({
        count: contextRows.length,
        kind: "omission",
      });
      continue;
    }
    const maximumVisible = contextLineCount * 2;
    if (contextRows.length <= maximumVisible + 1) {
      collapsed.push(...contextRows);
      continue;
    }

    collapsed.push(...contextRows.slice(0, contextLineCount));
    collapsed.push({
      count: contextRows.length - maximumVisible,
      kind: "omission",
    });
    collapsed.push(...contextRows.slice(-contextLineCount));
  }
  return collapsed;
}

function findCommonPrefixLength(
  previousLines: readonly string[],
  currentLines: readonly string[],
): number {
  const maximum = Math.min(previousLines.length, currentLines.length);
  let index = 0;
  while (index < maximum && previousLines[index] === currentLines[index]) {
    index += 1;
  }
  return index;
}

function findCommonSuffixLength(
  previousLines: readonly string[],
  currentLines: readonly string[],
  prefixLength: number,
): number {
  const maximum = Math.min(
    previousLines.length - prefixLength,
    currentLines.length - prefixLength,
  );
  let count = 0;
  while (
    count < maximum
    && previousLines[previousLines.length - count - 1]
      === currentLines[currentLines.length - count - 1]
  ) {
    count += 1;
  }
  return count;
}

function splitLines(content: string): readonly string[] {
  if (content.length === 0) {
    return [];
  }
  return content.replace(/\r\n?/gu, "\n").split("\n");
}
