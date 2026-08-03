'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ProxyOptions } from "@i0c/config";

import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";
import { LabelWithTooltip } from "@/components/ui/controls/label-with-tooltip";
import {
  asString,
  getDestinationKey,
  isRecord,
  normalizePriority,
  normalizeStatus,
  setExclusiveDestination,
  type DestinationKey,
} from "@/composables/editor/route-utils";

import { ProxyOptionsEditor } from "./proxy-options-editor";

interface RouteObjectEditorProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  isReadOnly: boolean;
  isProxyOptionsOpen?: boolean;
  onProxyOptionsOpenChange?: (isOpen: boolean) => void;
}

export function RouteObjectEditor({
  value,
  onChange,
  isReadOnly,
  isProxyOptionsOpen: controlledProxyOptionsOpen,
  onProxyOptionsOpenChange,
}: RouteObjectEditorProps) {
  const t = useTranslations("routeEntry");
  const [localProxyOptionsOpen, setLocalProxyOptionsOpen] = useState(false);
  const isProxyOptionsOpen = controlledProxyOptionsOpen ?? localProxyOptionsOpen;
  const setIsProxyOptionsOpen = (isOpen: boolean) => {
    if (controlledProxyOptionsOpen === undefined) {
      setLocalProxyOptionsOpen(isOpen);
    }
    onProxyOptionsOpenChange?.(isOpen);
  };
  const routeType = ((value.type as string | undefined) ?? "prefix").trim();
  const showAppendPath = routeType !== "exact";
  const showStatus = routeType !== "proxy";
  const detailCols = showStatus ? 3 : 2;
  const statusValue = normalizeStatus(value.status);
  const priorityValue = normalizePriority(value.priority);
  const statusInvalid = showStatus && statusValue.trim() !== "" && !/^\d{3}$/.test(statusValue.trim());
  const priorityInvalid = priorityValue.trim() !== "" && !/^-?\d+$/.test(priorityValue.trim());
  const proxyOptions = isRecord(value.proxyOptions)
    ? value.proxyOptions as ProxyOptions
    : {};
  const proxyOverrideCount = [
    proxyOptions.timeoutSeconds === undefined ? 0 : 1,
    proxyOptions.maxRequestBodyMegabytes === undefined ? 0 : 1,
    Object.keys(proxyOptions.requestHeaders ?? {}).length,
    Object.keys(proxyOptions.responseHeaders ?? {}).length,
    proxyOptions.redirects?.mode === undefined ? 0 : 1,
    proxyOptions.redirects?.maxHops === undefined ? 0 : 1,
    proxyOptions.cookies?.mode === undefined ? 0 : 1,
  ].reduce((total, count) => total + count, 0);

  if (routeType === "proxy" && isProxyOptionsOpen) {
    return (
      <ProxyOptionsEditor
        value={proxyOptions}
        isReadOnly={isReadOnly}
        showNavigationHeader={controlledProxyOptionsOpen === undefined}
        onBack={() => setIsProxyOptionsOpen(false)}
        onChange={(nextOptions) => {
          const nextConfig = { ...value };
          if (nextOptions) {
            nextConfig.proxyOptions = nextOptions;
          } else {
            delete nextConfig.proxyOptions;
          }
          onChange(nextConfig);
        }}
      />
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <LabelWithTooltip label={t("typeLabel")} tooltip={t("typeTooltip")} />
          <DropdownSelect
            value={(value.type as string | undefined) ?? "prefix"}
            disabled={isReadOnly}
            onChange={(next) => {
              const nextConfig: Record<string, unknown> = { ...value, type: next };
              if (next === "proxy") delete nextConfig.status;
              if (next === "exact") {
                delete nextConfig.appendPath;
              }
              if (next !== "proxy") {
                setIsProxyOptionsOpen(false);
                delete nextConfig.proxyOptions;
              }
              onChange(nextConfig);
            }}
            options={[
              { value: "prefix", label: "prefix" },
              { value: "exact", label: "exact" },
              { value: "proxy", label: "proxy" },
            ]}
          />
        </div>

        {showAppendPath ? (
          <div>
            <label className={fieldLabelRowClassName + " " + fieldLabelClassName}>
              {t("appendPath")}
            </label>
            <div className="inline-flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-panel px-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={value.appendPath !== false}
                disabled={isReadOnly}
                onChange={(event) => onChange({ ...value, appendPath: event.target.checked })}
                className="h-4 w-4 rounded border-line-strong accent-accent"
              />
              <span className="text-sm text-ink">{t("appendPathHint")}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className={"grid grid-cols-1 gap-2 " + (detailCols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <div className={detailCols === 3 ? "sm:col-span-3" : "sm:col-span-2"}>
          <LabelWithTooltip label={t("targetLabel")} tooltip={t("targetTooltip")} />
          <div className="flex gap-2">
            <DropdownSelect
              className="w-28 shrink-0"
              value={getDestinationKey(value)}
              disabled={isReadOnly}
              onChange={(next) => {
                const nextKey = next as DestinationKey;
                const currentKey = getDestinationKey(value);
                const currentValue = asString(value[currentKey]);
                onChange(setExclusiveDestination(value, nextKey, currentValue));
              }}
              options={[
                { value: "target", label: "target" },
                { value: "to", label: "to" },
                { value: "url", label: "url" },
              ]}
            />
            <input
              value={asString(value[getDestinationKey(value)])}
              onChange={(event) => {
                const nextKey = getDestinationKey(value);
                onChange(setExclusiveDestination(value, nextKey, event.target.value));
              }}
              placeholder="https://example.com"
              readOnly={isReadOnly}
              className={formControlClassName({ className: "flex-1" })}
            />
          </div>
        </div>

        {showStatus ? (
          <div>
            <LabelWithTooltip label={t("statusLabel")} tooltip={t("statusTooltip")} />
            <input
              value={statusValue}
              onChange={(event) => {
                const raw = event.target.value.trim();
                const next = raw === "" ? undefined : raw;
                const nextConfig = { ...value };
                if (next === undefined) {
                  delete nextConfig.status;
                  onChange(nextConfig);
                  return;
                }
                onChange({ ...nextConfig, status: next });
              }}
              placeholder="301"
              readOnly={isReadOnly}
              className={formControlClassName({
                className: "w-full " + (statusInvalid ? "border-rose-300" : ""),
              })}
            />
            {statusInvalid ? <p className="mt-1 text-xs text-rose-600">{t("statusInvalid")}</p> : null}
          </div>
        ) : null}

        <div>
          <LabelWithTooltip label={t("priorityLabel")} tooltip={t("priorityTooltip")} />
          <input
            value={priorityValue}
            onChange={(event) => {
              const raw = event.target.value.trim();
              const next = raw === "" ? undefined : raw;
              const nextConfig = { ...value };
              if (next === undefined) {
                delete nextConfig.priority;
                onChange(nextConfig);
                return;
              }
              onChange({ ...nextConfig, priority: next });
            }}
            placeholder="0"
            readOnly={isReadOnly}
            className={formControlClassName({
              className: "w-full " + (priorityInvalid ? "border-rose-300" : ""),
            })}
          />
          {priorityInvalid ? <p className="mt-1 text-xs text-rose-600">{t("priorityInvalid")}</p> : null}
        </div>
      </div>

      {routeType === "proxy" ? (
        <button
          type="button"
          onClick={() => setIsProxyOptionsOpen(true)}
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-panel px-4 py-3.5 text-left transition hover:border-line-strong hover:bg-panel-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{t("proxyAdvancedTitle")}</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              {proxyOverrideCount === 0
                ? t("proxyAdvancedDefaultSummary")
                : t("proxyAdvancedCustomSummary", { count: proxyOverrideCount })}
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}

      <div>
        <LabelWithTooltip label={t("analyticsIdLabel")} tooltip={t("analyticsIdTooltip")} />
        <input
          value={asString(value.analyticsId)}
          readOnly
          className="h-10 w-full rounded-xl border border-line bg-panel-muted px-3.5 font-mono text-xs text-muted outline-none"
        />
      </div>
    </div>
  );
}
