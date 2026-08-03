'use client';

import { useTranslations } from "next-intl";

import {
  isConfigurableProxyHeaderName,
  proxyOptionLimits,
  type ProxyHeaderDirection,
  type ProxyHeaderOverrides,
} from "@i0c/config";

import { Button } from "@/components/ui/controls/button";
import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import { formControlClassName } from "@/components/ui/controls/form-control";

interface ProxyHeaderOverridesEditorProps {
  direction: ProxyHeaderDirection;
  isReadOnly: boolean;
  onChange: (next: ProxyHeaderOverrides) => void;
  value: ProxyHeaderOverrides;
}

function createHeaderName(value: ProxyHeaderOverrides): string {
  const names = new Set(Object.keys(value).map((name) => name.toLowerCase()));
  const baseName = "X-Custom-Header";
  if (!names.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName}-${index}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName}-${index}`;
}

export function ProxyHeaderOverridesEditor({
  direction,
  isReadOnly,
  onChange,
  value,
}: ProxyHeaderOverridesEditorProps) {
  const t = useTranslations("routeEntry");
  const entries = Object.entries(value);

  const renameHeader = (currentName: string, nextName: string) => {
    const hasCollision = Object.keys(value).some((name) => (
      name !== currentName && name.toLowerCase() === nextName.toLowerCase()
    ));
    if (hasCollision) return;

    const next: ProxyHeaderOverrides = {};
    for (const [name, headerValue] of Object.entries(value)) {
      next[name === currentName ? nextName : name] = headerValue;
    }
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
        const operation = headerValue === null ? "remove" : "set";
        const isNameInvalid = !isConfigurableProxyHeaderName(name, direction);
        const isValueInvalid = typeof headerValue === "string" && (
          headerValue.length > proxyOptionLimits.maximumHeaderValueLength
          || /[\u0000\r\n]/u.test(headerValue)
        );
        return (
          <div
            key={name}
            className="rounded-xl border border-line bg-panel-muted p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.2fr)_auto]">
              <input
                aria-label={t("proxyHeaderName")}
                value={name}
                readOnly={isReadOnly}
                onChange={(event) => renameHeader(name, event.target.value)}
                placeholder="Referer"
                className={formControlClassName({
                  className: `min-w-0 ${isNameInvalid ? "border-rose-300" : ""}`,
                })}
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
        disabled={isReadOnly || entries.length >= proxyOptionLimits.maximumHeaderCount}
        onClick={() => {
          const name = createHeaderName(value);
          onChange({ ...value, [name]: "" });
        }}
        size="sm"
        variant="secondary"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
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
