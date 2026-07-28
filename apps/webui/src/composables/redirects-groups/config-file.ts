"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { fetchRedirectsConfig, saveRedirectsConfig } from "./api";

export interface RedirectsSaveResult {
  errorMessage?: string;
  isSuccess: boolean;
}

export function useRedirectsConfigFile(options: {
  fallbackLoadErrorText: string;
  fallbackSaveErrorText: string;
  saveOkText: string;
  commitMessage: string;
}) {
  const [revision, setRevision] = useState("");
  const [canonicalOrigin, setCanonicalOrigin] = useState<string>("");

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"error" | "success" | null>(null);
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (nextSourceUrl?: string | null) => {
    setResultMessage(null);
    setResultStatus(null);
    setLastCommitUrl(null);

    const normalizedSourceUrl = typeof nextSourceUrl === "string" ? nextSourceUrl.trim() : null;
    const requestedSourceUrl = typeof nextSourceUrl === "undefined"
      ? sourceUrlRef.current
      : (normalizedSourceUrl || null);

    const data = await fetchRedirectsConfig({
      fallbackLoadErrorText: options.fallbackLoadErrorText,
      sourceUrl: requestedSourceUrl,
    });

    if (typeof nextSourceUrl !== "undefined") {
      sourceUrlRef.current = requestedSourceUrl;
      setSourceUrl(requestedSourceUrl);
    }

    setRevision(data.config.revision);
    setCanonicalOrigin(data.runtime.canonicalOrigin);
    setLastSavedContent(data.config.content);
    return data.config.content;
  }, [options.fallbackLoadErrorText]);

  const save = useCallback(
    (content: string): Promise<RedirectsSaveResult> =>
      new Promise((resolve) => {
        startTransition(async () => {
          setResultMessage(null);
          setResultStatus(null);
          setLastCommitUrl(null);

          try {
            const result = await saveRedirectsConfig(
              {
                content,
                expectedRevision: revision,
                message: options.commitMessage,
                ...(sourceUrl ? { sourceUrl } : {}),
              },
              {
                fallbackSaveErrorText: options.fallbackSaveErrorText,
              },
            );

            setRevision(result.revision);
            setLastSavedContent(content);
            setLastCommitUrl(result.revisionUrl ?? null);
            setResultMessage(options.saveOkText);
            setResultStatus("success");
            resolve({ isSuccess: true });
          } catch (error) {
            const errorMessage = error instanceof Error
              ? error.message
              : options.fallbackSaveErrorText;
            setResultMessage(errorMessage);
            setResultStatus("error");
            resolve({ errorMessage, isSuccess: false });
          }
        });
      }),
    [
      options.commitMessage,
      options.fallbackSaveErrorText,
      options.saveOkText,
      revision,
      sourceUrl,
    ],
  );

  return {
    isPending,
    canonicalOrigin,
    lastSavedContent,
    sourceUrl,
    load,
    save,
    resultMessage,
    resultStatus,
    lastCommitUrl,
  };
}
