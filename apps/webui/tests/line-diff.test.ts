import assert from "node:assert/strict";
import test from "node:test";

import { createLineDiff } from "../src/lib/data/line-diff";

test("renders an initial revision as additions", () => {
  const diff = createLineDiff(null, "{\n  \"enabled\": true\n}");

  assert.equal(diff.additions, 3);
  assert.equal(diff.deletions, 0);
  assert.deepEqual(
    diff.rows.map((row) => row.kind),
    ["addition", "addition", "addition"],
  );
});

test("aligns changed JSON lines with old and new line numbers", () => {
  const diff = createLineDiff(
    "{\n  \"enabled\": false,\n  \"count\": 1\n}",
    "{\n  \"enabled\": true,\n  \"count\": 2\n}",
  );

  assert.equal(diff.additions, 2);
  assert.equal(diff.deletions, 2);
  assert.deepEqual(diff.rows, [
    {
      content: "{",
      kind: "context",
      newLineNumber: 1,
      oldLineNumber: 1,
    },
    {
      content: "  \"enabled\": false,",
      kind: "deletion",
      newLineNumber: null,
      oldLineNumber: 2,
    },
    {
      content: "  \"count\": 1",
      kind: "deletion",
      newLineNumber: null,
      oldLineNumber: 3,
    },
    {
      content: "  \"enabled\": true,",
      kind: "addition",
      newLineNumber: 2,
      oldLineNumber: null,
    },
    {
      content: "  \"count\": 2",
      kind: "addition",
      newLineNumber: 3,
      oldLineNumber: null,
    },
    {
      content: "}",
      kind: "context",
      newLineNumber: 4,
      oldLineNumber: 4,
    },
  ]);
});

test("collapses long unchanged sections around a modification", () => {
  const previous = Array.from(
    { length: 12 },
    (_, index) => `line ${index + 1}`,
  );
  const current = [...previous];
  current[6] = "changed";

  const diff = createLineDiff(
    previous.join("\n"),
    current.join("\n"),
    2,
  );

  assert.deepEqual(
    diff.rows.map((row) => row.kind),
    [
      "context",
      "context",
      "omission",
      "context",
      "context",
      "deletion",
      "addition",
      "context",
      "context",
      "context",
      "context",
      "context",
    ],
  );
});

test("normalizes line endings before comparing content", () => {
  const diff = createLineDiff("first\r\nsecond", "first\nsecond");

  assert.equal(diff.additions, 0);
  assert.equal(diff.deletions, 0);
});

test("falls back safely for a large completely changed document", () => {
  const previous = Array.from(
    { length: 1_001 },
    (_, index) => `old ${index}`,
  ).join("\n");
  const current = Array.from(
    { length: 1_001 },
    (_, index) => `new ${index}`,
  ).join("\n");

  const diff = createLineDiff(previous, current);

  assert.equal(diff.deletions, 1_001);
  assert.equal(diff.additions, 1_001);
});
