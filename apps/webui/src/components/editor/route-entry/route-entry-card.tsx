"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { QRCodeButton } from "@/components/ui/controls/qr-code";
import {
  asString,
  getDestinationKey,
  getMode,
  getRouteDescription,
  isRecord,
} from "@/composables/editor/route-utils";
import type { RedirectEntry } from "@/composables/redirects-groups/model";

import { TargetFavicon } from "./target-favicon";

interface RouteEntryCardProps {
  entry: RedirectEntry;
  isReadOnly: boolean;
  onDelete: () => void;
  onOpen: () => void;
}

function getFirstDestination(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "string") {
    return candidate.trim();
  }
  if (isRecord(candidate)) {
    return asString(candidate[getDestinationKey(candidate)]).trim();
  }
  return "";
}

export function RouteEntryCard({
  entry,
  isReadOnly,
  onDelete,
  onOpen,
}: RouteEntryCardProps) {
  const t = useTranslations("entries");
  const tRoute = useTranslations("routeEntry");
  const mode = getMode(entry.value);
  const objectType = isRecord(entry.value)
    ? asString(entry.value.type).trim() || "prefix"
    : null;
  const typeLabel = mode === "object"
    ? objectType
    : tRoute(mode === "array" ? "multi" : "quick");
  const target = getFirstDestination(entry.value);
  const destination = target || t("ruleTargetMissing");
  const openLabel = t(isReadOnly ? "viewRule" : "editRule");
  const pathLabel = entry.key.trim() || t("rulePathMissing");
  const candidateCount = Array.isArray(entry.value)
    ? entry.value.length
    : null;
  const description = getRouteDescription(entry.value)
    || (candidateCount !== null
      ? t("ruleArrayCount", { count: candidateCount })
      : t("ruleDescriptionMissing"));

  return (
    <article
      id={`entry-${entry.id}`}
      className="flex min-h-48 flex-col rounded-xl border border-line bg-panel p-4 transition hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${openLabel}: ${pathLabel}`}
          className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex min-w-0 items-start gap-3">
            <TargetFavicon target={target} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 break-all text-base font-semibold leading-6 text-ink">
                {destination}
              </span>
              <span className="mt-1.5 block truncate font-mono text-sm text-muted">
                {pathLabel}
              </span>
            </span>
          </span>
        </button>

        <span className="shrink-0 rounded-full border border-line bg-panel-muted px-2.5 py-1 text-xs font-semibold text-muted">
          {typeLabel}
        </span>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">
        {description}
      </p>

      <div className="mt-auto flex items-center gap-2 pt-6">
        <QRCodeButton pathKey={entry.key.trim()} />
        <Button
          onClick={onOpen}
          size="icon"
          variant="secondary"
          title={openLabel}
          aria-label={`${openLabel}: ${pathLabel}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            {isReadOnly ? (
              <>
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            ) : (
              <>
                <path d="m4 16-.75 4.75L8 20l10.5-10.5-4-4L4 16Z" strokeLinejoin="round" />
                <path d="m12.75 7.25 4 4" />
              </>
            )}
          </svg>
        </Button>
        {isReadOnly ? null : (
          <Button
            onClick={onDelete}
            size="icon"
            variant="danger"
            title={t("deleteRule")}
            aria-label={`${t("deleteRule")}: ${pathLabel}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M10 11v6M14 11v6" strokeLinecap="round" />
            </svg>
          </Button>
        )}
      </div>
    </article>
  );
}
