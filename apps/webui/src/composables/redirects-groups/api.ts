'use client';

import type {
  DataDocument,
  DataRepositoryWriteResult,
} from "@i0c/config";

export type ApiConfigResponse = {
  config: DataDocument;
  runtime: {
    canonicalOrigin: string;
  };
};

export async function fetchRedirectsConfig(options?: {
  fallbackLoadErrorText?: string;
  sourceUrl?: string | null;
}): Promise<ApiConfigResponse> {
  const url = new URL("/api/config", window.location.origin);
  if (options?.sourceUrl) {
    url.searchParams.set("sourceUrl", options.sourceUrl);
  }
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const text =
      typeof data?.error === "string" ? data.error : (options?.fallbackLoadErrorText ?? "Failed to load config");
    throw new Error(text);
  }
  return (await response.json()) as ApiConfigResponse;
}

export async function saveRedirectsConfig(input: {
  content: string;
  expectedRevision: string;
  message: string;
  sourceUrl?: string;
}, options?: {
  fallbackSaveErrorText?: string;
}): Promise<DataRepositoryWriteResult> {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const text =
      typeof data?.error === "string"
        ? data.error
        : (data?.error ? JSON.stringify(data.error) : (options?.fallbackSaveErrorText ?? "Save failed"));
    throw new Error(text);
  }

  return (await response.json()) as DataRepositoryWriteResult;
}
