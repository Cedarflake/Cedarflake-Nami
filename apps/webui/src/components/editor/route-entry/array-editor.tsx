'use client';

import { useState } from "react";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { Card } from "@/components/ui/surfaces/card";
import { ConfirmationDialog } from "@/components/ui/feedback/confirmation-dialog";
import { fieldLabelClassName } from "@/components/ui/controls/form-control";

interface NestedRouteEntryEditorProps {
  value: unknown;
  onChange: (next: unknown) => void;
  level?: number;
  allowArray?: boolean;
  pathKey?: string;
  isReadOnly?: boolean;
  isProxyOptionsOpen?: boolean;
  onProxyOptionsOpenChange?: (isOpen: boolean) => void;
}

interface RouteArrayEditorProps {
  value: unknown[];
  onChange: (next: unknown[]) => void;
  level: number;
  pathKey: string;
  isReadOnly: boolean;
  isProxyOptionsOpen?: boolean;
  onProxyOptionsOpenChange?: (isOpen: boolean) => void;
  EntryEditor: ComponentType<NestedRouteEntryEditorProps>;
}

export function RouteArrayEditor({
  value,
  onChange,
  level,
  pathKey,
  isReadOnly,
  isProxyOptionsOpen,
  onProxyOptionsOpenChange,
  EntryEditor,
}: RouteArrayEditorProps) {
  const t = useTranslations("routeEntry");
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [proxyOptionsIndex, setProxyOptionsIndex] = useState<number | null>(null);

  function confirmDeleteItem() {
    if (pendingDeleteIndex === null) {
      return;
    }
    const next = value.slice();
    if (next.length <= 1) {
      next[0] = "";
      onChange(next);
      setPendingDeleteIndex(null);
      return;
    }
    next.splice(pendingDeleteIndex, 1);
    onChange(next);
    setPendingDeleteIndex(null);
  }

  if (isProxyOptionsOpen && proxyOptionsIndex !== null) {
    const item = value[proxyOptionsIndex];
    return (
      <EntryEditor
        value={Array.isArray(item) ? "" : item}
        allowArray={false}
        level={level + 1}
        pathKey={pathKey}
        isReadOnly={isReadOnly}
        isProxyOptionsOpen
        onProxyOptionsOpenChange={onProxyOptionsOpenChange}
        onChange={(nextItem) => {
          const safeNext = Array.isArray(nextItem) ? "" : nextItem;
          const next = value.slice();
          next[proxyOptionsIndex] = safeNext;
          onChange(next);
        }}
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {value.length === 0 ? (
        <Card elevation="flat" padding="sm" tone="muted" className="border-dashed">
          <p className="text-sm text-muted">{t("noRuleItems")}</p>
        </Card>
      ) : null}

      {value.map((item, index) => (
        <Card key={index} elevation="flat" padding="sm">
          <div className="flex items-center justify-between gap-3">
            <p className={fieldLabelClassName}>{t("ruleItem", { index: index + 1 })}</p>
            {isReadOnly ? null : (
              <Button
                onClick={() => setPendingDeleteIndex(index)}
                size="icon"
                variant="danger"
                title={t("deleteRule")}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                  <path
                    d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M10 11v6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            )}
          </div>
          <div className="mt-3">
            <EntryEditor
              value={Array.isArray(item) ? "" : item}
              allowArray={false}
              level={level + 1}
              pathKey={pathKey}
              isReadOnly={isReadOnly}
              isProxyOptionsOpen={onProxyOptionsOpenChange ? false : undefined}
              onProxyOptionsOpenChange={onProxyOptionsOpenChange
                ? (isOpen) => {
                  if (isOpen) {
                    setProxyOptionsIndex(index);
                  }
                  onProxyOptionsOpenChange(isOpen);
                }
                : undefined}
              onChange={(nextItem) => {
                const safeNext = Array.isArray(nextItem) ? "" : nextItem;
                const next = value.slice();
                next[index] = safeNext;
                onChange(next);
              }}
            />
          </div>
        </Card>
      ))}

      {isReadOnly ? null : (
        <Button
          onClick={() => onChange([...(value ?? []), ""])}
          size="sm"
          variant="secondary"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
            <path d="M12 6v12m6-6H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("addRuleItem")}
        </Button>
      )}
      <ConfirmationDialog
        isOpen={pendingDeleteIndex !== null}
        title={t("deleteRuleTitle")}
        description={t("confirmDeleteRule")}
        cancelLabel={t("cancelDelete")}
        confirmLabel={t("deleteRule")}
        tone="danger"
        onCancel={() => setPendingDeleteIndex(null)}
        onConfirm={confirmDeleteItem}
      />
    </div>
  );
}
