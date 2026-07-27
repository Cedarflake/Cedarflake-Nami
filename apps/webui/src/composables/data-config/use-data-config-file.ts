"use client";

import { useCallback, useState, useTransition } from "react";

import { fetchDataConfig, saveDataConfig } from "./api";

interface UseDataConfigFileOptions {
  fallbackLoadErrorText: string;
  fallbackSaveErrorText: string;
  saveOkText: string;
}

export function useDataConfigFile(options: UseDataConfigFileOptions) {
  const [revision, setRevision] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"error" | "success" | null>(null);
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setResultMessage(null);
    setResultStatus(null);
    setLastCommitUrl(null);
    const data = await fetchDataConfig(options.fallbackLoadErrorText);
    setRevision(data.document.revision);
    setLastSavedContent(data.document.content);
    return data.document.content;
  }, [options.fallbackLoadErrorText]);

  const save = useCallback(
    (content: string): Promise<boolean> =>
      new Promise((resolve) => {
        startTransition(async () => {
          setResultMessage(null);
          setResultStatus(null);
          setLastCommitUrl(null);
          try {
            const result = await saveDataConfig({
              content,
              expectedRevision: revision,
              message: "chore(config): update instance settings",
            }, options.fallbackSaveErrorText);
            setRevision(result.revision);
            setLastSavedContent(content);
            setLastCommitUrl(result.revisionUrl ?? null);
            setResultMessage(options.saveOkText);
            setResultStatus("success");
            resolve(true);
          } catch (error) {
            setResultMessage(
              error instanceof Error ? error.message : options.fallbackSaveErrorText,
            );
            setResultStatus("error");
            resolve(false);
          }
        });
      }),
    [options.fallbackSaveErrorText, options.saveOkText, revision],
  );

  return {
    isPending,
    lastCommitUrl,
    lastSavedContent,
    load,
    resultMessage,
    resultStatus,
    save,
  };
}
