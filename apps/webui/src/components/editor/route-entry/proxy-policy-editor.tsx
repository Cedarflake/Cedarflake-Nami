'use client';

import {
  proxyCacheModes,
  proxyCookieModes,
  proxyCredentialModes,
  proxyProfiles,
  proxyRedirectModes,
  proxyResponseCookieAttributeModes,
  proxyResponseCookiePathModes,
  proxySourceHeaderModes,
  type ProxyProfile,
} from "@i0c/config";
import { useTranslations } from "next-intl";

import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";

interface ProxyPolicyEditorProps {
  value: unknown;
  onChange: (next: Record<string, unknown>) => void;
  isReadOnly: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isProxyProfile(value: unknown): value is ProxyProfile {
  return (
    typeof value === "string"
    && (proxyProfiles as readonly string[]).includes(value)
  );
}

function asStringList(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(", ")
    : "";
}

function parseStringList(value: string, uppercase = false): string[] | undefined {
  const items = value
    .split(/[,\n]/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => uppercase ? item.toUpperCase() : item);
  return items.length > 0 ? [...new Set(items)] : undefined;
}

function setNestedValue(
  source: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): Record<string, unknown> {
  const [key, ...rest] = path;
  if (!key) return source;

  const next = { ...source };
  if (rest.length === 0) {
    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    return next;
  }

  const child = setNestedValue(asRecord(next[key]), rest, value);
  if (Object.keys(child).length === 0) {
    delete next[key];
  } else {
    next[key] = child;
  }
  return next;
}

function numericValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className={fieldLabelRowClassName + " " + fieldLabelClassName}>{label}</div>
      {children}
    </div>
  );
}

export function ProxyPolicyEditor({
  value,
  onChange,
  isReadOnly,
}: ProxyPolicyEditorProps) {
  const t = useTranslations("routeEntry");
  if (!isRecord(value)) {
    return (
      <div className="border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink">{t("proxyPolicyLegacyTitle")}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{t("proxyPolicyLegacyDescription")}</p>
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() => onChange({ profile: "isolated" })}
          className="mt-3 h-9 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-line-strong hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("proxyPolicyApplyIsolated")}
        </button>
      </div>
    );
  }

  const policy = value;
  const profile = isProxyProfile(policy.profile)
    ? policy.profile
    : "isolated";
  const requestPolicy = asRecord(policy.request);
  const requestCookies = asRecord(requestPolicy.cookies);
  const responsePolicy = asRecord(policy.response);
  const responseCookies = asRecord(responsePolicy.cookies);
  const cachePolicy = asRecord(policy.cache);
  const redirectPolicy = asRecord(policy.redirects);
  const limitPolicy = asRecord(policy.limits);
  const forwardsCredentials = (
    requestPolicy.authorization === "preserve"
    || requestCookies.mode === "allowlist"
  );
  const inheritOption = { value: "", label: t("proxyPolicyInherit") };
  const update = (path: readonly string[], next: unknown) => {
    onChange(setNestedValue(policy, path, next));
  };

  return (
    <div className="mt-1">
      <div className="border-t border-line py-4">
        <Field label={t("proxyProfileLabel")}>
          <DropdownSelect
            value={profile}
            disabled={isReadOnly}
            ariaLabel={t("proxyProfileLabel")}
            onChange={(next) => update(["profile"], next)}
            options={proxyProfiles.map((item) => ({
              value: item,
              label: t(`proxyProfile.${item}`),
            }))}
          />
        </Field>
        <p className="mt-2 text-xs leading-5 text-muted">
          {t(`proxyProfileDescription.${profile}`)}
        </p>
      </div>

      <Section
        title={t("proxyRequestTitle")}
        description={t("proxyRequestDescription")}
      >
        <Field label={t("proxyMethodsLabel")} className="sm:col-span-2">
          <input
            value={asStringList(requestPolicy.methods)}
            readOnly={isReadOnly}
            aria-label={t("proxyMethodsLabel")}
            onChange={(event) => update(
              ["request", "methods"],
              parseStringList(event.target.value, true),
            )}
            placeholder={t("proxyMethodsPlaceholder")}
            className={formControlClassName({ className: "w-full" })}
          />
        </Field>
        <Field label={t("proxyRequestCookiesLabel")}>
          <DropdownSelect
            value={asString(requestCookies.mode)}
            disabled={isReadOnly}
            ariaLabel={t("proxyRequestCookiesLabel")}
            onChange={(next) => {
              let nextPolicy = setNestedValue(policy, ["request", "cookies", "mode"], next);
              if (next !== "allowlist") {
                nextPolicy = setNestedValue(nextPolicy, ["request", "cookies", "names"], undefined);
              }
              onChange(nextPolicy);
            }}
            options={[
              inheritOption,
              ...proxyCookieModes.map((item) => ({
                value: item,
                label: t(`proxyCookieMode.${item}`),
              })),
            ]}
          />
        </Field>
        {requestCookies.mode === "allowlist" ? (
          <Field label={t("proxyCookieNamesLabel")}>
            <input
              value={asStringList(requestCookies.names)}
              readOnly={isReadOnly}
              aria-label={t("proxyCookieNamesLabel")}
              onChange={(event) => update(
                ["request", "cookies", "names"],
                parseStringList(event.target.value),
              )}
              placeholder={t("proxyCookieNamesPlaceholder")}
              className={formControlClassName({ className: "w-full" })}
            />
          </Field>
        ) : null}
        <Field label={t("proxyAuthorizationLabel")}>
          <DropdownSelect
            value={asString(requestPolicy.authorization)}
            disabled={isReadOnly}
            ariaLabel={t("proxyAuthorizationLabel")}
            onChange={(next) => update(["request", "authorization"], next)}
            options={[
              inheritOption,
              ...proxyCredentialModes.map((item) => ({
                value: item,
                label: t(`proxyCredentialMode.${item}`),
              })),
            ]}
          />
        </Field>
        <Field label={t("proxyOriginLabel")}>
          <DropdownSelect
            value={asString(requestPolicy.origin)}
            disabled={isReadOnly}
            ariaLabel={t("proxyOriginLabel")}
            onChange={(next) => update(["request", "origin"], next)}
            options={[
              inheritOption,
              ...proxySourceHeaderModes.map((item) => ({
                value: item,
                label: t(`proxySourceHeaderMode.${item}`),
              })),
            ]}
          />
        </Field>
        <Field label={t("proxyRefererLabel")}>
          <DropdownSelect
            value={asString(requestPolicy.referer)}
            disabled={isReadOnly}
            ariaLabel={t("proxyRefererLabel")}
            onChange={(next) => update(["request", "referer"], next)}
            options={[
              inheritOption,
              ...proxySourceHeaderModes.map((item) => ({
                value: item,
                label: t(`proxySourceHeaderMode.${item}`),
              })),
            ]}
          />
        </Field>
      </Section>

      <Section
        title={t("proxyResponseTitle")}
        description={t("proxyResponseDescription")}
      >
        <Field label={t("proxyResponseCookiesLabel")}>
          <DropdownSelect
            value={asString(responseCookies.mode)}
            disabled={isReadOnly}
            ariaLabel={t("proxyResponseCookiesLabel")}
            onChange={(next) => {
              let nextPolicy = setNestedValue(policy, ["response", "cookies", "mode"], next);
              if (next !== "allowlist") {
                nextPolicy = setNestedValue(nextPolicy, ["response", "cookies", "names"], undefined);
                nextPolicy = setNestedValue(nextPolicy, ["response", "cookies", "domain"], undefined);
                nextPolicy = setNestedValue(nextPolicy, ["response", "cookies", "path"], undefined);
              }
              onChange(nextPolicy);
            }}
            options={[
              inheritOption,
              ...proxyCookieModes.map((item) => ({
                value: item,
                label: t(`proxyCookieMode.${item}`),
              })),
            ]}
          />
        </Field>
        {responseCookies.mode === "allowlist" ? (
          <>
            <Field label={t("proxyCookieNamesLabel")}>
              <input
                value={asStringList(responseCookies.names)}
                readOnly={isReadOnly}
                aria-label={t("proxyCookieNamesLabel")}
                onChange={(event) => update(
                  ["response", "cookies", "names"],
                  parseStringList(event.target.value),
                )}
                placeholder={t("proxyCookieNamesPlaceholder")}
                className={formControlClassName({ className: "w-full" })}
              />
            </Field>
            <Field label={t("proxyCookieDomainLabel")}>
              <DropdownSelect
                value={asString(responseCookies.domain)}
                disabled={isReadOnly}
                ariaLabel={t("proxyCookieDomainLabel")}
                onChange={(next) => update(["response", "cookies", "domain"], next)}
                options={[
                  inheritOption,
                  ...proxyResponseCookieAttributeModes.map((item) => ({
                    value: item,
                    label: t(`proxyCookieAttributeMode.${item}`),
                  })),
                ]}
              />
            </Field>
            <Field label={t("proxyCookiePathLabel")}>
              <DropdownSelect
                value={asString(responseCookies.path)}
                disabled={isReadOnly}
                ariaLabel={t("proxyCookiePathLabel")}
                onChange={(next) => update(["response", "cookies", "path"], next)}
                options={[
                  inheritOption,
                  ...proxyResponseCookiePathModes.map((item) => ({
                    value: item,
                    label: t(`proxyCookiePathMode.${item}`),
                  })),
                ]}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <Section
        title={t("proxyRedirectCacheTitle")}
        description={t("proxyRedirectCacheDescription")}
      >
        <Field label={t("proxyRedirectModeLabel")}>
          <DropdownSelect
            value={asString(redirectPolicy.mode)}
            disabled={isReadOnly}
            ariaLabel={t("proxyRedirectModeLabel")}
            onChange={(next) => {
              let nextPolicy = setNestedValue(policy, ["redirects", "mode"], next);
              if (next === "manual" || next === "") {
                nextPolicy = setNestedValue(nextPolicy, ["redirects", "maxHops"], undefined);
                nextPolicy = setNestedValue(nextPolicy, ["redirects", "allowedOrigins"], undefined);
              }
              onChange(nextPolicy);
            }}
            options={[
              inheritOption,
              ...proxyRedirectModes.map((item) => ({
                value: item,
                label: t(`proxyRedirectMode.${item}`),
              })),
            ]}
          />
        </Field>
        {redirectPolicy.mode === "follow" ? (
          <>
            <Field label={t("proxyMaxHopsLabel")}>
              <input
                type="number"
                min="0"
                max="10"
                value={numericValue(redirectPolicy.maxHops)}
                readOnly={isReadOnly}
                aria-label={t("proxyMaxHopsLabel")}
                onChange={(event) => update(
                  ["redirects", "maxHops"],
                  parseOptionalNumber(event.target.value),
                )}
                placeholder="5"
                className={formControlClassName({ className: "w-full" })}
              />
            </Field>
            <Field label={t("proxyAllowedOriginsLabel")} className="sm:col-span-2">
              <input
                value={asStringList(redirectPolicy.allowedOrigins)}
                readOnly={isReadOnly}
                aria-label={t("proxyAllowedOriginsLabel")}
                onChange={(event) => update(
                  ["redirects", "allowedOrigins"],
                  parseStringList(event.target.value),
                )}
                placeholder="https://api.example.com"
                className={formControlClassName({ className: "w-full" })}
              />
            </Field>
          </>
        ) : null}
        <Field label={t("proxyCacheModeLabel")}>
          <DropdownSelect
            value={asString(cachePolicy.mode)}
            disabled={isReadOnly}
            ariaLabel={t("proxyCacheModeLabel")}
            onChange={(next) => {
              let nextPolicy = setNestedValue(policy, ["cache", "mode"], next);
              if (next !== "public") {
                nextPolicy = setNestedValue(nextPolicy, ["cache", "edgeTtlSeconds"], undefined);
                nextPolicy = setNestedValue(nextPolicy, ["cache", "browserTtlSeconds"], undefined);
              }
              onChange(nextPolicy);
            }}
            options={[
              inheritOption,
              ...proxyCacheModes.map((item) => ({
                value: item,
                label: t(`proxyCacheMode.${item}`),
              })),
            ]}
          />
        </Field>
        {cachePolicy.mode === "public" && forwardsCredentials ? (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 sm:col-span-2"
            role="alert"
          >
            {t("proxyPublicCacheCredentialWarning")}
          </p>
        ) : null}
        {cachePolicy.mode === "public" ? (
          <>
            <Field label={t("proxyBrowserTtlLabel")}>
              <input
                type="number"
                min="0"
                max="31536000"
                value={numericValue(cachePolicy.browserTtlSeconds)}
                readOnly={isReadOnly}
                aria-label={t("proxyBrowserTtlLabel")}
                onChange={(event) => update(
                  ["cache", "browserTtlSeconds"],
                  parseOptionalNumber(event.target.value),
                )}
                className={formControlClassName({ className: "w-full" })}
              />
            </Field>
            <Field label={t("proxyEdgeTtlLabel")}>
              <input
                type="number"
                min="0"
                max="31536000"
                value={numericValue(cachePolicy.edgeTtlSeconds)}
                readOnly={isReadOnly}
                aria-label={t("proxyEdgeTtlLabel")}
                onChange={(event) => update(
                  ["cache", "edgeTtlSeconds"],
                  parseOptionalNumber(event.target.value),
                )}
                className={formControlClassName({ className: "w-full" })}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <Section
        title={t("proxyLimitsTitle")}
        description={t("proxyLimitsDescription")}
      >
        <Field label={t("proxyTimeoutLabel")}>
          <input
            type="number"
            min="100"
            max="60000"
            value={numericValue(limitPolicy.timeoutMs)}
            readOnly={isReadOnly}
            aria-label={t("proxyTimeoutLabel")}
            onChange={(event) => update(
              ["limits", "timeoutMs"],
              parseOptionalNumber(event.target.value),
            )}
            placeholder="10000"
            className={formControlClassName({ className: "w-full" })}
          />
        </Field>
        <Field label={t("proxyBodyLimitLabel")}>
          <input
            type="number"
            min="0"
            max="10485760"
            value={numericValue(limitPolicy.maxRequestBodyBytes)}
            readOnly={isReadOnly}
            aria-label={t("proxyBodyLimitLabel")}
            onChange={(event) => update(
              ["limits", "maxRequestBodyBytes"],
              parseOptionalNumber(event.target.value),
            )}
            placeholder="1048576"
            className={formControlClassName({ className: "w-full" })}
          />
        </Field>
      </Section>
    </div>
  );
}
