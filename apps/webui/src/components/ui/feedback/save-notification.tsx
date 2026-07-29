"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Toaster, toast } from "sonner";

interface SaveNotificationProps {
  commitUrl?: string | null;
  message?: string | null;
  notificationId: number;
  status: "error" | "success";
}

const toasterStyle = {
  "--width": "min(24rem, calc(100vw - 2.5rem))",
} as CSSProperties;

function SuccessIcon() {
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="h-3.5 w-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ErrorIcon() {
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-700"
      aria-hidden="true"
    >
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
    </span>
  );
}

function CloseIcon() {
  return (
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
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M11.5 4.5h4v4M15.5 4.5l-7 7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M9 5.5H5.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveNotification({
  commitUrl,
  message,
  notificationId,
  status,
}: SaveNotificationProps) {
  const t = useTranslations("groups");
  const [isExpanded, setIsExpanded] = useState(false);
  const handledNotificationIdRef = useRef(0);
  const notificationLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      notificationId === 0
      || handledNotificationIdRef.current === notificationId
      || !message
    ) {
      return;
    }

    handledNotificationIdRef.current = notificationId;

    const notificationLayer = notificationLayerRef.current;
    if (notificationLayer && typeof notificationLayer.showPopover === "function") {
      if (notificationLayer.matches(":popover-open")) {
        notificationLayer.hidePopover();
      }
      notificationLayer.showPopover();
    }

    const description = commitUrl ? (
      <a
        href={commitUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-strong"
      >
        {t("viewCommit")}
        <ExternalLinkIcon />
      </a>
    ) : undefined;
    const options = {
      description,
      duration: 10000,
      style: {
        boxShadow: "none",
        width: "100%",
      },
    };

    if (status === "success") {
      toast.success(message, options);
    } else {
      toast.error(message, options);
    }
  }, [commitUrl, message, notificationId, status, t]);

  function handleNotificationClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      !(target instanceof Element)
      || !target.closest("[data-sonner-toast]")
      || target.closest("a, button")
    ) {
      return;
    }

    setIsExpanded((value) => !value);
  }

  return (
    <div
      ref={notificationLayerRef}
      popover="manual"
      onClick={handleNotificationClick}
      className="pointer-events-none fixed inset-0 m-0 h-0 w-0 overflow-visible border-0 bg-transparent p-0"
    >
      <Toaster
        closeButton
        containerAriaLabel={t("notifications")}
        duration={10000}
        expand={isExpanded}
        icons={{
          close: <CloseIcon />,
          error: <ErrorIcon />,
          success: <SuccessIcon />,
        }}
        mobileOffset={20}
        offset={20}
        position="bottom-right"
        style={toasterStyle}
        swipeDirections={["right", "left"]}
        toastOptions={{
          classNames: {
            closeButton: "!static !order-last !h-7 !w-7 !shrink-0 !transform-none !border-0 !bg-transparent !text-muted hover:!bg-subtle hover:!text-ink",
            content: "!min-w-0 !flex-1",
            description: "!mt-2",
            icon: "!m-0 !h-6 !w-6 !shrink-0",
            title: "!whitespace-pre-wrap !break-words !text-sm !font-normal !leading-5 !text-ink",
            toast: "!w-full !items-start !gap-3 !rounded-xl !border-line !bg-panel !p-4 !text-ink !shadow-none",
          },
          closeButtonAriaLabel: t("dismissNotification"),
        }}
        visibleToasts={Number.POSITIVE_INFINITY}
        className="pointer-events-auto"
      />
    </div>
  );
}
