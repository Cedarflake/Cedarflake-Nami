"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";

interface SaveNotificationProps {
  commitUrl?: string | null;
  message?: string | null;
  status: "error" | "success";
}

export function SaveNotification({
  commitUrl,
  message,
  status,
}: SaveNotificationProps) {
  const t = useTranslations("groups");
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setIsDismissed(true), 10000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!message || isDismissed) {
    return null;
  }

  const isSuccess = status === "success";

  return (
    <aside
      role={isSuccess ? "status" : "alert"}
      aria-live={isSuccess ? "polite" : "assertive"}
      className="fixed bottom-5 right-5 z-[1200] w-[calc(100%_-_2.5rem)] max-w-sm animate-[fade-left_180ms_ease-out] rounded-xl border border-line bg-panel p-4 motion-reduce:animate-none"
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            isSuccess
              ? "bg-accent-soft text-accent-strong"
              : "bg-rose-50 text-rose-700",
          ].join(" ")}
          aria-hidden="true"
        >
          {isSuccess ? (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-3.5 w-3.5"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-3.5 w-3.5"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M10 6v4M10 13.5v.01" strokeLinecap="round" />
              <circle cx="10" cy="10" r="7" />
            </svg>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm text-ink">
            {message}
          </p>
          {commitUrl ? (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-strong"
            >
              {t("viewCommit")}
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-3.5 w-3.5"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M11.5 4.5h4v4M15.5 4.5l-7 7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 5.5H5.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : null}
        </div>

        <Button
          onClick={() => setIsDismissed(true)}
          size="icon-xs"
          variant="ghost"
          title={t("dismissNotification")}
          aria-label={t("dismissNotification")}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-3.5 w-3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
          </svg>
        </Button>
      </div>
    </aside>
  );
}
