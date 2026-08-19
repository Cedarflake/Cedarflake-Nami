import { NextResponse } from "next/server";

import {
  DataDocumentNotFoundError,
  DataRepositoryConflictError,
  DataRepositoryInitializationError,
} from "@nami/config";

export function createDataRepositoryErrorResponse(
  error: unknown,
): NextResponse | null {
  if (error instanceof DataRepositoryConflictError) {
    return NextResponse.json(
      {
        error:
          "This document changed after it was loaded. Reload it before saving again.",
      },
      { status: 409 },
    );
  }
  if (error instanceof DataDocumentNotFoundError) {
    return NextResponse.json(
      { error: `The ${error.kind} data document has not been initialized.` },
      { status: 404 },
    );
  }
  if (error instanceof DataRepositoryInitializationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    );
  }
  return null;
}
