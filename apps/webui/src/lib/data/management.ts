import "server-only";

import type { DataDocumentKind, DataRepositoryManagement } from "@i0c/config";

import { getAppDataRepositoryManagement } from "./documents";

export async function requireAppDataRepositoryManagement(): Promise<
  DataRepositoryManagement
> {
  const management = await getAppDataRepositoryManagement();
  if (!management) {
    throw new Error(
      "The selected data repository does not support document management",
    );
  }
  return management;
}

export function parseDataDocumentKind(value: string): DataDocumentKind | null {
  return value === "config" || value === "redirects" ? value : null;
}
