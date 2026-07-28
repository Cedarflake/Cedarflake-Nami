'use client';

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { fieldLabelClassName } from "@/components/ui/controls/form-control";
import {
  asString,
  createEmptyConfig,
  getDestinationKey,
  getMode,
  isRecord,
  setExclusiveDestination,
  type RouteMode,
} from "@/composables/editor/route-utils";

import { RouteArrayEditor } from "./array-editor";
import { RouteObjectEditor } from "./object-editor";
import { RouteQuickEditor } from "./quick-editor";

export type RouteEntryEditorProps = {
  value: unknown;
  onChange: (next: unknown) => void;
  level?: number;
  allowArray?: boolean;
  pathKey?: string;
  isReadOnly?: boolean;
};

export function RouteEntryEditor({
  value,
  onChange,
  level = 0,
  allowArray = true,
  pathKey = "",
  isReadOnly = false,
}: RouteEntryEditorProps) {
  const t = useTranslations("routeEntry");
  const mode = useMemo(() => getMode(value), [value]);
  const stringValue = mode === "string" ? asString(value) : "";
  const configValue = mode === "object" && isRecord(value) ? value : null;
  const arrayValue = mode === "array" && Array.isArray(value) ? value : null;
  const stringDraftRef = useRef<string>(stringValue);
  const objectDraftRef = useRef<Record<string, unknown> | null>(configValue);
  const arrayDraftRef = useRef<unknown[] | null>(arrayValue);

  useEffect(() => {
    if (mode === "string") stringDraftRef.current = stringValue;
  }, [mode, stringValue]);

  useEffect(() => {
    if (mode === "object" && configValue) objectDraftRef.current = configValue;
  }, [configValue, mode]);

  useEffect(() => {
    if (mode === "array" && arrayValue) arrayDraftRef.current = arrayValue;
  }, [arrayValue, mode]);

  const setMode = useCallback(
    (nextMode: RouteMode) => {
      if (isReadOnly || nextMode === mode) return;
      if (nextMode === "string") {
        const cached = stringDraftRef.current;
        if (cached.trim() !== "") {
          onChange(cached);
          return;
        }
        if (configValue) {
          const destinationKey = getDestinationKey(configValue);
          onChange(asString(configValue[destinationKey]));
          return;
        }
        if (arrayValue && arrayValue.length > 0) {
          const first = arrayValue[0];
          if (isRecord(first)) {
            const destinationKey = getDestinationKey(first);
            onChange(asString(first[destinationKey]));
            return;
          }
          onChange(asString(first));
          return;
        }
        onChange("");
        return;
      }
      if (nextMode === "object") {
        const cached = objectDraftRef.current;
        if (cached) {
          onChange(cached);
          return;
        }
        if (arrayValue && arrayValue.length > 0) {
          const first = arrayValue[0];
          if (isRecord(first)) {
            onChange(first);
            return;
          }
          const seed = createEmptyConfig();
          const seededConfig =
            asString(first).trim() === "" ? seed : setExclusiveDestination(seed, "target", asString(first).trim());
          onChange(seededConfig);
          return;
        }
        const seed = createEmptyConfig();
        const seededConfig =
          stringValue.trim() === "" ? seed : setExclusiveDestination(seed, "target", stringValue.trim());
        onChange(seededConfig);
        return;
      }
      if (nextMode === "array") {
        const cached = arrayDraftRef.current;
        if (cached && cached.length > 0) {
          onChange(cached);
          return;
        }
        if (arrayValue && arrayValue.length > 0) {
          onChange(arrayValue);
          return;
        }
        if (configValue) {
          onChange([configValue]);
          return;
        }
        if (stringValue.trim() !== "") {
          onChange([stringValue]);
          return;
        }
        onChange([""]);
        return;
      }
    },
    [arrayValue, configValue, isReadOnly, mode, onChange, stringValue]
  );

  const containerClassName = level > 0 ? "mt-3 rounded-xl border border-line bg-panel-muted p-4" : "";

  return (
    <div className={containerClassName}>
      <div className="space-y-2">
        <span className={"block " + fieldLabelClassName}>{t("ruleType")}</span>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-panel-muted p-1">
          <Button
            onClick={() => setMode("string")}
            disabled={isReadOnly}
            className="w-full whitespace-nowrap"
            size="sm"
            variant={mode === "string" ? "primary" : "ghost"}
          >
            {t("quick")}
          </Button>

          <Button
            onClick={() => setMode("object")}
            disabled={isReadOnly}
            className="w-full whitespace-nowrap"
            size="sm"
            variant={mode === "object" ? "primary" : "ghost"}
          >
            {t("detail")}
          </Button>

          {allowArray ? (
            <Button
              onClick={() => setMode("array")}
              disabled={isReadOnly}
              className="w-full whitespace-nowrap"
              size="sm"
              variant={mode === "array" ? "primary" : "ghost"}
            >
              {t("multi")}
            </Button>
          ) : (
            <div aria-hidden className="h-7" />
          )}
        </div>
      </div>

      {mode === "string" ? (
        <RouteQuickEditor
          value={stringValue}
          onChange={onChange}
          isReadOnly={isReadOnly}
        />
      ) : null}

      {mode === "array" && arrayValue ? (
        <RouteArrayEditor
          value={arrayValue}
          onChange={onChange}
          level={level}
          pathKey={pathKey}
          isReadOnly={isReadOnly}
          EntryEditor={RouteEntryEditor}
        />
      ) : null}

      {mode === "object" && configValue ? (
        <RouteObjectEditor
          value={configValue}
          onChange={onChange}
          isReadOnly={isReadOnly}
        />
      ) : null}
    </div>
  );
}
