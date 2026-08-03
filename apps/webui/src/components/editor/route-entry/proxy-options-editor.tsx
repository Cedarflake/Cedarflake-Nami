'use client';

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  defaultProxyOptions,
  proxyOptionLimits,
  type ProxyHeaderOverrides,
  type ProxyOptions,
} from "@i0c/config";

import { Button } from "@/components/ui/controls/button";
import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import { fieldLabelClassName, formControlClassName } from "@/components/ui/controls/form-control";

import { ProxyHeaderOverridesEditor } from "./proxy-header-overrides-editor";

type ProxySection = "limits" | "redirects" | "request" | "response";

interface ProxyOptionsEditorProps {
  isReadOnly: boolean;
  onBack: () => void;
  onChange: (next: ProxyOptions | undefined) => void;
  showNavigationHeader?: boolean;
  value: ProxyOptions;
}

interface ProxySectionCardProps {
  children: ReactNode;
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
}

function cleanHeaderOverrides(
  value: ProxyHeaderOverrides | undefined,
): ProxyHeaderOverrides | undefined {
  return value && Object.keys(value).length > 0 ? value : undefined;
}

function cleanProxyOptions(value: ProxyOptions): ProxyOptions | undefined {
  const requestHeaders = cleanHeaderOverrides(value.requestHeaders);
  const responseHeaders = cleanHeaderOverrides(value.responseHeaders);
  const redirects = value.redirects && (
    value.redirects.mode !== undefined || value.redirects.maxHops !== undefined
  ) ? value.redirects : undefined;
  const cookies = value.cookies?.mode ? value.cookies : undefined;
  const next: ProxyOptions = {
    ...(value.timeoutSeconds === undefined ? {} : { timeoutSeconds: value.timeoutSeconds }),
    ...(value.maxRequestBodyMegabytes === undefined
      ? {}
      : { maxRequestBodyMegabytes: value.maxRequestBodyMegabytes }),
    ...(requestHeaders ? { requestHeaders } : {}),
    ...(responseHeaders ? { responseHeaders } : {}),
    ...(redirects ? { redirects } : {}),
    ...(cookies ? { cookies } : {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

function ProxySectionCard({
  children,
  description,
  isExpanded,
  onToggle,
  title,
}: ProxySectionCardProps) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-panel-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${isExpanded ? "rounded-t-xl" : "rounded-xl"}`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isExpanded ? (
        <div className="rounded-b-xl border-t border-line px-4 py-4">{children}</div>
      ) : null}
    </section>
  );
}

export function ProxyOptionsEditor({
  isReadOnly,
  onBack,
  onChange,
  showNavigationHeader = true,
  value,
}: ProxyOptionsEditorProps) {
  const t = useTranslations("routeEntry");
  const [expandedSection, setExpandedSection] = useState<ProxySection | null>("request");
  const maxRedirectHopsInvalid = value.redirects?.maxHops !== undefined && (
    !Number.isInteger(value.redirects.maxHops)
    || value.redirects.maxHops < 0
    || value.redirects.maxHops > proxyOptionLimits.maximumRedirectHops
  );
  const timeoutInvalid = value.timeoutSeconds !== undefined && (
    !Number.isInteger(value.timeoutSeconds)
    || value.timeoutSeconds < 1
    || value.timeoutSeconds > proxyOptionLimits.maximumTimeoutSeconds
  );
  const bodyLimitInvalid = value.maxRequestBodyMegabytes !== undefined && (
    !Number.isFinite(value.maxRequestBodyMegabytes)
    || value.maxRequestBodyMegabytes <= 0
    || value.maxRequestBodyMegabytes > proxyOptionLimits.maximumRequestBodyMegabytes
  );

  const update = (next: ProxyOptions) => onChange(cleanProxyOptions(next));
  const setHeaderOverrides = (
    key: "requestHeaders" | "responseHeaders",
    nextHeaders: ProxyHeaderOverrides,
  ) => update({ ...value, [key]: nextHeaders });

  return (
    <div className="mt-4 space-y-4">
      {showNavigationHeader ? (
        <div className="flex min-w-0 items-center gap-2 border-b border-line pb-4">
          <Button
            aria-label={t("proxyAdvancedBack")}
            onClick={onBack}
            size="icon"
            variant="ghost"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          <h3 className="min-w-0 text-base font-semibold text-ink">
            {t("proxyAdvancedTitle")}
          </h3>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-xs leading-5 text-muted">
          {t("proxyAdvancedDescription")}
        </p>
        <Button
          disabled={isReadOnly || Object.keys(value).length === 0}
          onClick={() => onChange(undefined)}
          size="sm"
          variant="secondary"
        >
          {t("proxyResetDefaults")}
        </Button>
      </div>

      <div className="space-y-3">
        <ProxySectionCard
          title={t("proxyRequestTitle")}
          description={t("proxyRequestDescription")}
          isExpanded={expandedSection === "request"}
          onToggle={() => setExpandedSection((current) => current === "request" ? null : "request")}
        >
          <ProxyHeaderOverridesEditor
            direction="request"
            isReadOnly={isReadOnly}
            value={value.requestHeaders ?? {}}
            onChange={(next) => setHeaderOverrides("requestHeaders", next)}
          />
        </ProxySectionCard>

        <ProxySectionCard
          title={t("proxyResponseTitle")}
          description={t("proxyResponseDescription")}
          isExpanded={expandedSection === "response"}
          onToggle={() => setExpandedSection((current) => current === "response" ? null : "response")}
        >
          <div className="space-y-4">
            <ProxyHeaderOverridesEditor
              direction="response"
              isReadOnly={isReadOnly}
              value={value.responseHeaders ?? {}}
              onChange={(next) => setHeaderOverrides("responseHeaders", next)}
            />
            <div className="max-w-sm">
              <label className={fieldLabelClassName}>{t("proxyCookieMode")}</label>
              <DropdownSelect
                value={value.cookies?.mode ?? defaultProxyOptions.cookies.mode}
                disabled={isReadOnly}
                onChange={(mode) => {
                  update({
                    ...value,
                    cookies: mode === defaultProxyOptions.cookies.mode
                      ? undefined
                      : { mode: mode as "preserve" | "strip" },
                  });
                }}
                options={[
                  { value: "rewrite-domain", label: t("proxyCookieRewrite") },
                  { value: "preserve", label: t("proxyCookiePreserve") },
                  { value: "strip", label: t("proxyCookieStrip") },
                ]}
              />
              <p className="mt-1.5 text-xs leading-5 text-muted">{t("proxyCookieHint")}</p>
            </div>
          </div>
        </ProxySectionCard>

        <ProxySectionCard
          title={t("proxyRedirectTitle")}
          description={t("proxyRedirectDescription")}
          isExpanded={expandedSection === "redirects"}
          onToggle={() => setExpandedSection((current) => current === "redirects" ? null : "redirects")}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClassName}>{t("proxyRedirectMode")}</label>
              <DropdownSelect
                value={value.redirects?.mode ?? defaultProxyOptions.redirects.mode}
                disabled={isReadOnly}
                onChange={(mode) => {
                  const redirects = mode === "passthrough"
                    ? { mode: "passthrough" as const }
                    : value.redirects?.maxHops === undefined
                      ? undefined
                      : { maxHops: value.redirects.maxHops };
                  update({ ...value, redirects });
                }}
                options={[
                  { value: "follow", label: t("proxyRedirectFollow") },
                  { value: "passthrough", label: t("proxyRedirectPassthrough") },
                ]}
              />
            </div>
            <div>
              <label className={fieldLabelClassName}>{t("proxyMaxRedirectHops")}</label>
              <input
                type="number"
                min="0"
                max={proxyOptionLimits.maximumRedirectHops}
                step="1"
                value={value.redirects?.maxHops ?? ""}
                readOnly={isReadOnly}
                disabled={(value.redirects?.mode ?? defaultProxyOptions.redirects.mode) === "passthrough"}
                onChange={(event) => {
                  const raw = event.target.value;
                  const maxHops = raw === "" ? undefined : Number(raw);
                  update({
                    ...value,
                    redirects: maxHops === undefined
                      ? undefined
                      : { ...value.redirects, maxHops },
                  });
                }}
                placeholder={String(defaultProxyOptions.redirects.maxHops)}
                className={formControlClassName({
                  className: `w-full disabled:bg-panel-muted disabled:text-muted ${maxRedirectHopsInvalid ? "border-rose-300" : ""}`,
                })}
              />
              <p className={`mt-1.5 text-xs leading-5 ${maxRedirectHopsInvalid ? "text-rose-600" : "text-muted"}`}>
                {maxRedirectHopsInvalid
                  ? t("proxyIntegerRangeInvalid", {
                    minimum: 0,
                    maximum: proxyOptionLimits.maximumRedirectHops,
                  })
                  : t("proxyMaxRedirectHopsHint", { count: defaultProxyOptions.redirects.maxHops })}
              </p>
            </div>
          </div>
        </ProxySectionCard>

        <ProxySectionCard
          title={t("proxyLimitsTitle")}
          description={t("proxyLimitsDescription")}
          isExpanded={expandedSection === "limits"}
          onToggle={() => setExpandedSection((current) => current === "limits" ? null : "limits")}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={fieldLabelClassName}>{t("proxyTimeoutSeconds")}</label>
              <input
                type="number"
                min="1"
                max={proxyOptionLimits.maximumTimeoutSeconds}
                step="1"
                value={value.timeoutSeconds ?? ""}
                readOnly={isReadOnly}
                onChange={(event) => update({
                  ...value,
                  timeoutSeconds: event.target.value === "" ? undefined : Number(event.target.value),
                })}
                placeholder={t("proxyPlatformDefault")}
                className={formControlClassName({
                  className: `w-full ${timeoutInvalid ? "border-rose-300" : ""}`,
                })}
              />
              <p className={`mt-1.5 text-xs leading-5 ${timeoutInvalid ? "text-rose-600" : "text-muted"}`}>
                {timeoutInvalid
                  ? t("proxyIntegerRangeInvalid", {
                    minimum: 1,
                    maximum: proxyOptionLimits.maximumTimeoutSeconds,
                  })
                  : t("proxyTimeoutHint")}
              </p>
            </div>
            <div>
              <label className={fieldLabelClassName}>{t("proxyBodyLimitMegabytes")}</label>
              <input
                type="number"
                min="0.1"
                max={proxyOptionLimits.maximumRequestBodyMegabytes}
                step="0.1"
                value={value.maxRequestBodyMegabytes ?? ""}
                readOnly={isReadOnly}
                onChange={(event) => update({
                  ...value,
                  maxRequestBodyMegabytes: event.target.value === ""
                    ? undefined
                    : Number(event.target.value),
                })}
                placeholder={t("proxyPlatformDefault")}
                className={formControlClassName({
                  className: `w-full ${bodyLimitInvalid ? "border-rose-300" : ""}`,
                })}
              />
              <p className={`mt-1.5 text-xs leading-5 ${bodyLimitInvalid ? "text-rose-600" : "text-muted"}`}>
                {bodyLimitInvalid
                  ? t("proxyBodyLimitInvalid", {
                    maximum: proxyOptionLimits.maximumRequestBodyMegabytes,
                  })
                  : t("proxyBodyLimitHint")}
              </p>
            </div>
          </div>
        </ProxySectionCard>
      </div>
    </div>
  );
}
