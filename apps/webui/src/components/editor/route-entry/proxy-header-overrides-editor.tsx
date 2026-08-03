'use client';

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  isConfigurableProxyHeaderName,
  proxyOptionLimits,
  type ProxyHeaderDirection,
  type ProxyHeaderOverrides,
} from "@i0c/config";

import { Button } from "@/components/ui/controls/button";
import {
  DropdownSelect,
  EditableDropdownSelect,
} from "@/components/ui/controls/dropdown-select";
import { formControlClassName } from "@/components/ui/controls/form-control";

interface ProxyHeaderOverridesEditorProps {
  direction: ProxyHeaderDirection;
  isReadOnly: boolean;
  onChange: (next: ProxyHeaderOverrides) => void;
  value: ProxyHeaderOverrides;
}

const commonProxyHeaders: Readonly<Record<ProxyHeaderDirection, readonly string[]>> = {
  request: [
    "Accept",
    "Accept-Language",
    "Cache-Control",
    "Content-Type",
    "Origin",
    "Range",
    "Referer",
    "User-Agent",
    "X-Requested-With",
  ],
  response: [
    "Access-Control-Allow-Origin",
    "Cache-Control",
    "Content-Disposition",
    "Content-Language",
    "Content-Security-Policy",
    "Content-Type",
    "Cross-Origin-Resource-Policy",
    "ETag",
    "Referrer-Policy",
    "Vary",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ],
};

export function ProxyHeaderOverridesEditor({
  direction,
  isReadOnly,
  onChange,
  value,
}: ProxyHeaderOverridesEditorProps) {
  const t = useTranslations("routeEntry");
  const listId = useId();
  const initialHeaderNames = Object.keys(value);
  const nextRowIdRef = useRef(initialHeaderNames.length);
  const [rowIds, setRowIds] = useState<Record<string, string>>(() => (
    Object.fromEntries(initialHeaderNames.map((name, index) => [
      name,
      `${listId}-header-${index}`,
    ]))
  ));
  const nameInputRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocusRowIdRef = useRef<string | null>(null);
  const entries = Object.entries(value);
  const configuredHeaderNames = new Set(
    Object.keys(value).map((name) => name.toLowerCase()),
  );
  const cannotAddHeader = isReadOnly
    || entries.length >= proxyOptionLimits.maximumHeaderCount;

  const addHeader = (name: string) => {
    const existingName = Object.keys(value).find(
      (configuredName) => configuredName.toLowerCase() === name.toLowerCase(),
    );
    if (existingName !== undefined) {
      const existingRowId = rowIds[existingName];
      const input = existingRowId ? nameInputRefs.current.get(existingRowId) : undefined;
      input?.focus();
      input?.select();
      return;
    }

    const rowId = `${listId}-header-${nextRowIdRef.current}`;
    nextRowIdRef.current += 1;
    pendingFocusRowIdRef.current = rowId;
    setRowIds((current) => ({ ...current, [name]: rowId }));
    onChange({ ...value, [name]: "" });
  };

  const renameHeader = (currentName: string, nextName: string) => {
    const collisionName = Object.keys(value).find((name) => (
      name !== currentName && name.toLowerCase() === nextName.toLowerCase()
    ));
    if (collisionName) {
      const collisionRowId = rowIds[collisionName];
      const input = collisionRowId ? nameInputRefs.current.get(collisionRowId) : undefined;
      input?.focus();
      input?.select();
      return;
    }

    const next: ProxyHeaderOverrides = {};
    for (const [name, headerValue] of Object.entries(value)) {
      next[name === currentName ? nextName : name] = headerValue;
    }

    let rowId = rowIds[currentName];
    if (!rowId) {
      rowId = `${listId}-header-${nextRowIdRef.current}`;
      nextRowIdRef.current += 1;
    }
    setRowIds((current) => {
      const nextRowIds = { ...current };
      delete nextRowIds[currentName];
      nextRowIds[nextName] = rowId;
      return nextRowIds;
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          {t(direction === "request" ? "proxyRequestHeadersEmpty" : "proxyResponseHeadersEmpty")}
        </p>
      ) : null}

      {entries.map(([name, headerValue]) => {
        const rowId = rowIds[name] ?? `${listId}-external-${name}`;
        const operation = headerValue === null ? "remove" : "set";
        const isNameInvalid = name !== "" && !isConfigurableProxyHeaderName(name, direction);
        const isValueInvalid = typeof headerValue === "string" && (
          headerValue.length > proxyOptionLimits.maximumHeaderValueLength
          || /[\u0000\r\n]/u.test(headerValue)
        );
        return (
          <div
            key={rowId}
            className="rounded-xl border border-line bg-panel-muted p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.2fr)_auto]">
              <EditableDropdownSelect
                inputRef={(node) => {
                  if (node) {
                    nameInputRefs.current.set(rowId, node);
                    if (pendingFocusRowIdRef.current === rowId) {
                      pendingFocusRowIdRef.current = null;
                      node.focus({ preventScroll: true });
                    }
                  } else {
                    nameInputRefs.current.delete(rowId);
                  }
                }}
                ariaLabel={t("proxyHeaderName")}
                value={name}
                disabled={isReadOnly}
                onChange={(nextName) => renameHeader(name, nextName)}
                options={commonProxyHeaders[direction].map((headerName) => ({
                  value: headerName,
                  label: configuredHeaderNames.has(headerName.toLowerCase())
                    ? t("proxyHeaderConfigured", { name: headerName })
                    : headerName,
                }))}
                placeholder={t("proxyHeaderNamePlaceholder")}
                toggleLabel={t("proxyHeaderSuggestions")}
                className={isNameInvalid ? "[&_input]:border-rose-300" : ""}
              />
              <DropdownSelect
                value={operation}
                disabled={isReadOnly}
                onChange={(nextOperation) => {
                  onChange({
                    ...value,
                    [name]: nextOperation === "remove" ? null : "",
                  });
                }}
                options={[
                  { value: "set", label: t("proxyHeaderSet") },
                  { value: "remove", label: t("proxyHeaderRemove") },
                ]}
              />
              <input
                aria-label={t("proxyHeaderValue")}
                value={headerValue ?? ""}
                readOnly={isReadOnly || operation === "remove"}
                disabled={operation === "remove"}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => onChange({ ...value, [name]: event.target.value })}
                placeholder="https://www.example.com/"
                className={formControlClassName({
                  className: `min-w-0 disabled:bg-panel-muted disabled:text-muted ${isValueInvalid ? "border-rose-300" : ""}`,
                })}
              />
              <Button
                aria-label={t("proxyHeaderDelete")}
                disabled={isReadOnly}
                onClick={() => {
                  const next = { ...value };
                  delete next[name];
                  nameInputRefs.current.delete(rowId);
                  setRowIds((current) => {
                    const nextRowIds = { ...current };
                    delete nextRowIds[name];
                    return nextRowIds;
                  });
                  onChange(next);
                }}
                size="icon-lg"
                variant="danger"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
            {isNameInvalid || isValueInvalid ? (
              <p className="mt-2 text-xs leading-5 text-rose-600">
                {t(isNameInvalid ? "proxyHeaderNameInvalid" : "proxyHeaderValueInvalid")}
              </p>
            ) : null}
          </div>
        );
      })}

      <Button
        disabled={isReadOnly || (cannotAddHeader && !configuredHeaderNames.has(""))}
        onClick={() => addHeader("")}
        size="sm"
        variant="secondary"
      >
        {t(direction === "request" ? "proxyAddRequestHeader" : "proxyAddResponseHeader")}
      </Button>
      {entries.length >= proxyOptionLimits.maximumHeaderCount ? (
        <p className="text-xs leading-5 text-muted">
          {t("proxyHeaderLimitReached", { count: proxyOptionLimits.maximumHeaderCount })}
        </p>
      ) : null}
    </div>
  );
}
