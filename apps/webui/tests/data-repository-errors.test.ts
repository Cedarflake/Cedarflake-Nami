import assert from "node:assert/strict";
import test from "node:test";

import {
  DataDocumentNotFoundError,
  DataRepositoryConflictError,
  DataRepositoryInitializationError,
} from "@nami/config";

import { createDataRepositoryErrorResponse } from "../src/lib/data/errors";

test("maps stale repository revisions to a conflict response", async () => {
  const response = createDataRepositoryErrorResponse(
    new DataRepositoryConflictError("redirects", "1", "2"),
  );

  assert.ok(response);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error:
      "This document changed after it was loaded. Reload it before saving again.",
  });
});

test("maps missing repository documents without exposing database details", async () => {
  const response = createDataRepositoryErrorResponse(
    new DataDocumentNotFoundError("config"),
  );

  assert.ok(response);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "The config data document has not been initialized.",
  });
});

test("leaves unrelated repository failures to the caller", () => {
  assert.equal(
    createDataRepositoryErrorResponse(new Error("connection failed")),
    null,
  );
});

test("maps repeated initialization to a conflict response", async () => {
  const response = createDataRepositoryErrorResponse(
    new DataRepositoryInitializationError(
      "The data repository has already been initialized",
    ),
  );

  assert.ok(response);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "The data repository has already been initialized",
  });
});
