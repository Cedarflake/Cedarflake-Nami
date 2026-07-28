'use client';

import { useTranslations } from "next-intl";

import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";
import { LabelWithTooltip } from "@/components/ui/controls/label-with-tooltip";
import { QRCodeButton } from "@/components/ui/controls/qr-code";
import {
  asString,
  getDestinationKey,
  normalizePriority,
  normalizeStatus,
  setExclusiveDestination,
  setRouteType,
  type DestinationKey,
} from "@/composables/editor/route-utils";

import { ProxyPolicyEditor } from "./proxy-policy-editor";

interface RouteObjectEditorProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  pathKey: string;
  isReadOnly: boolean;
}

export function RouteObjectEditor({
  value,
  onChange,
  pathKey,
  isReadOnly,
}: RouteObjectEditorProps) {
  const t = useTranslations("routeEntry");
  const routeType = ((value.type as string | undefined) ?? "prefix").trim();
  const showAppendPath = routeType !== "exact";
  const showStatus = routeType !== "proxy";
  const detailCols = showStatus ? 3 : 2;
  const statusValue = normalizeStatus(value.status);
  const priorityValue = normalizePriority(value.priority);
  const statusInvalid = showStatus && statusValue.trim() !== "" && !/^\d{3}$/.test(statusValue.trim());
  const priorityInvalid = priorityValue.trim() !== "" && !/^-?\d+$/.test(priorityValue.trim());

  return (
    <div className="mt-4 grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <LabelWithTooltip label={t("typeLabel")} tooltip={t("typeTooltip")} />
          <DropdownSelect
            value={(value.type as string | undefined) ?? "prefix"}
            disabled={isReadOnly}
            onChange={(next) => {
              onChange(setRouteType(value, next));
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
            {pathKey && <QRCodeButton pathKey={pathKey} />}
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
        <ProxyPolicyEditor
          value={value.proxyPolicy}
          onChange={(next) => onChange({ ...value, proxyPolicy: next })}
          isReadOnly={isReadOnly}
        />
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
