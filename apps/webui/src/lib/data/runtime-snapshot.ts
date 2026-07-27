import { createHash } from "node:crypto";

import type {
  DataRepositorySnapshot,
  RedirectsConfig,
  RuntimeDataSnapshot,
} from "@i0c/config";

import { parseDataConfig } from "@/lib/configuration/parse-data-config";
import { getAppDataSnapshot } from "@/lib/data/documents";
import { validateRedirectConfig } from "@/lib/redirects/config-validation";

export async function readRuntimeDataSnapshot(): Promise<RuntimeDataSnapshot> {
  const snapshot = await getAppDataSnapshot();
  return createRuntimeDataSnapshot(snapshot);
}

export function createRuntimeDataSnapshot(
  snapshot: DataRepositorySnapshot,
): RuntimeDataSnapshot {
  return {
    schemaVersion: 1,
    revision: snapshot.revision,
    config: parseDataConfig(snapshot.config.content),
    redirects: parseRedirects(snapshot.redirects.content),
  };
}

export function createRuntimeSnapshotEtag(revision: string): string {
  const digest = createHash("sha256")
    .update(revision)
    .digest("base64url");
  return `"${digest}"`;
}

export function matchesRuntimeSnapshotEtag(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) =>
      candidate === "*"
      || candidate === etag
      || candidate === `W/${etag}`,
    );
}

function parseRedirects(content: string): RedirectsConfig {
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    throw new Error("Redirect data must be valid JSON");
  }
  const validation = validateRedirectConfig(value);
  if (validation.status !== "valid") {
    throw new Error("Redirect data failed validation");
  }
  return value as RedirectsConfig;
}
