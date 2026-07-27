import "server-only";

import type { DataRepositoryManagement, DataRepositorySetupState } from "@i0c/config";

import { getAppDataRepositoryManagement } from "@/lib/data/documents";

export type AppSetupState =
  | DataRepositorySetupState
  | {
      state: "unsupported";
    };

export async function getDataRepositoryManagement(): Promise<
  DataRepositoryManagement | null
> {
  return getAppDataRepositoryManagement();
}

export async function getAppSetupState(): Promise<AppSetupState> {
  const management = await getDataRepositoryManagement();
  if (!management) {
    return { state: "unsupported" };
  }
  return management.inspectSetupState();
}

export async function isAppSetupPending(): Promise<boolean> {
  const state = await getAppSetupState();
  return state.state !== "initialized" && state.state !== "unsupported";
}
