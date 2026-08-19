"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  JsonObject,
  JsonValue,
  PluginInstanceConfig,
} from "@nami/config";
import type {
  PluginConfigurationFieldUi,
  PluginLocalizedText,
  PluginManifest,
  PluginSecretRequirement,
} from "@nami/plugin-api";

import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";
import { NumberInput } from "@/components/ui/controls/number-input";
import { Switch } from "@/components/ui/controls/switch";
import { ConfirmationDialog } from "@/components/ui/feedback/confirmation-dialog";
import {
  compatibilityEnabledInstancePluginIds,
  installedInstancePluginManifests,
  requiredInstancePluginIds,
} from "@/lib/configuration/validation";

interface PluginConfigurationEditorProps {
  isReadOnly: boolean;
  value: Record<string, PluginInstanceConfig>;
  onChange: (value: Record<string, PluginInstanceConfig>) => void;
}

export function PluginConfigurationEditor({
  isReadOnly,
  manifest,
  value,
  onChange,
}: PluginConfigurationEditorProps & {
  manifest: PluginManifest;
}) {
  const locale = useLocale();
  const t = useTranslations("instanceConfig");
  const declaration = value[manifest.id];
  const isRequired = requiredInstancePluginIds.has(manifest.id);
  const isEnabled = declaration?.enabled
    ?? compatibilityEnabledInstancePluginIds.has(manifest.id);
  const properties = getSchemaProperties(manifest);
  const propertyEntries = sortPluginConfigProperties(manifest, properties);
  const secretEntries = sortPluginSecrets(manifest.secrets);
  const hasDetails = Object.keys(properties).length > 0 || secretEntries.length > 0;
  const fieldsDisabled = isReadOnly || !isEnabled;
  const [isDisablePlatformDialogOpen, setIsDisablePlatformDialogOpen] = useState(false);

  function updateDeclaration(
    updater: (current: PluginInstanceConfig) => PluginInstanceConfig,
  ) {
    const current = value[manifest.id] ?? {
      enabled: isRequired,
      version: manifest.config.version,
    };
    onChange({
      ...value,
      [manifest.id]: updater(current),
    });
  }

  function applyPluginEnabled(enabled: boolean) {
    const next = { ...value };
    if (enabled && manifest.kind === "analytics-store") {
      for (const candidate of installedInstancePluginManifests) {
        if (candidate.kind !== "analytics-store" || candidate.id === manifest.id) {
          continue;
        }
        const candidateDeclaration = next[candidate.id];
        if (candidateDeclaration) {
          next[candidate.id] = { ...candidateDeclaration, enabled: false };
        }
      }
    }
    const config = declaration?.config ?? createInitialConfig(manifest);
    const secrets = declaration?.secrets ?? createInitialSecrets(manifest);
    onChange({
      ...next,
      [manifest.id]: {
        ...(declaration ?? {
          enabled: false,
          version: manifest.config.version,
        }),
        enabled,
        version: declaration?.version ?? manifest.config.version,
        ...(Object.keys(config).length > 0 ? { config } : {}),
        ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
      },
    });
  }

  function setPluginEnabled(enabled: boolean) {
    if (!enabled && manifest.kind === "runtime-platform") {
      setIsDisablePlatformDialogOpen(true);
      return;
    }

    applyPluginEnabled(enabled);
  }

  function updateConfigProperty(
    property: string,
    nextValue: JsonValue | undefined,
  ) {
    updateDeclaration((current) => {
      const config = { ...(current.config ?? {}) };
      if (nextValue === undefined) {
        delete config[property];
      } else {
        config[property] = nextValue;
      }
      return {
        ...current,
        version: current.version ?? manifest.config.version,
        config,
      };
    });
  }

  function updateSecretBinding(secret: string, binding: string) {
    updateDeclaration((current) => ({
      ...current,
      version: current.version ?? manifest.config.version,
      secrets: {
        ...(current.secrets ?? {}),
        [secret]: binding,
      },
    }));
  }

  return (
    <>
      <div className="border-t border-line pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">{t("pluginState")}</p>
            <p className="mt-1 text-xs text-muted">
              {isEnabled ? t("enabled") : t("disabled")}
            </p>
            {isRequired ? (
              <p className="mt-1 text-xs text-accent-strong">{t("required")}</p>
            ) : null}
          </div>
          <Switch
            checked={isEnabled}
            disabled={isReadOnly || isRequired}
            label={t("togglePlugin", { name: manifest.name })}
            onChange={setPluginEnabled}
          />
        </div>

        {isEnabled && hasDetails ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {propertyEntries.map(([property, schema]) => {
              const ui = getFieldUi(manifest, property);
              return (
                <PluginPropertyField
                  key={property}
                  control={ui?.control}
                  disabled={fieldsDisabled}
                  help={resolveLocalizedText(ui?.help, locale)}
                  label={
                    resolveLocalizedText(ui?.label, locale)
                    ?? humanize(property)
                  }
                  onChange={(nextValue) =>
                    updateConfigProperty(property, nextValue)
                  }
                  placeholder={resolveLocalizedText(ui?.placeholder, locale)}
                  schema={schema}
                  value={declaration?.config?.[property]}
                />
              );
            })}

            {secretEntries.map(([secret, requirement]) => {
              const binding =
                declaration?.secrets?.[secret]
                ?? requirement.defaultBinding
                ?? "";
              const label = resolveLocalizedText(
                requirement.label,
                locale,
              ) ?? t("secretBinding", { secret });
              const help = resolveLocalizedText(
                requirement.help,
                locale,
              ) ?? requirement.description ?? t("secretBindingHint");

              return (
                <div key={secret}>
                  <label className={fieldLabelRowClassName}>
                    <span className={fieldLabelClassName}>{label}</span>
                  </label>
                  <input
                    value={binding}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      updateSecretBinding(secret, event.target.value.toUpperCase())
                    }
                    placeholder={requirement.defaultBinding}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className={formControlClassName({
                      className: "w-full font-mono",
                    })}
                  />
                  {help ? (
                    <p className="mt-1.5 text-xs leading-5 text-muted">
                      {help}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {isEnabled ? t("noPluginSettings") : t("disabledPluginSettings")}
          </p>
        )}
      </div>
      <ConfirmationDialog
        isOpen={isDisablePlatformDialogOpen}
        title={t("disableRuntimePlatformTitle")}
        description={t("disableRuntimePlatformConfirm", { name: manifest.name })}
        cancelLabel={t("disableRuntimePlatformCancel")}
        confirmLabel={t("disableRuntimePlatformConfirmAction")}
        tone="danger"
        onCancel={() => setIsDisablePlatformDialogOpen(false)}
        onConfirm={() => {
          setIsDisablePlatformDialogOpen(false);
          applyPluginEnabled(false);
        }}
      />
    </>
  );
}

function PluginPropertyField({
  control,
  disabled,
  help,
  label,
  onChange,
  placeholder,
  schema,
  value,
}: {
  control?: PluginConfigurationFieldUi["control"];
  disabled: boolean;
  help?: string;
  label: string;
  onChange: (value: JsonValue | undefined) => void;
  placeholder?: string;
  schema: JsonObject;
  value: JsonValue | undefined;
}) {
  const t = useTranslations("instanceConfig");
  const constantValue = schema.const;
  const minimum = typeof schema.minimum === "number" ? schema.minimum : undefined;
  const maximum = typeof schema.maximum === "number" ? schema.maximum : undefined;
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
    : [];
  const hint = constantValue !== undefined
    ? t("fixedValue")
    : help
      ? help
    : minimum !== undefined || maximum !== undefined
      ? t("range", {
          minimum: minimum ?? "−∞",
          maximum: maximum ?? "∞",
        })
      : null;

  return (
    <div>
      <label className={fieldLabelRowClassName}>
        <span className={fieldLabelClassName}>{label}</span>
      </label>

      {control === "select" || enumValues.length > 0 ? (
        <DropdownSelect
          value={String(value ?? enumValues[0] ?? "")}
          disabled={disabled}
          onChange={(next) => {
            const resolved = enumValues.find((item) => String(item) === next);
            onChange(resolved);
          }}
          options={enumValues.map((item) => ({
            value: String(item),
            label: String(item),
          }))}
        />
      ) : control === "switch" || schema.type === "boolean" ? (
        <div className="flex h-10 items-center justify-between rounded-xl border border-line bg-panel px-3.5">
          <span className="text-sm text-ink">
            {value === true ? t("enabled") : t("disabled")}
          </span>
          <Switch
            checked={value === true}
            disabled={disabled}
            label={label}
            onChange={onChange}
          />
        </div>
      ) : control === "number" || schema.type === "integer" || schema.type === "number" || typeof constantValue === "number" ? (
        <NumberInput
          value={
            typeof constantValue === "number"
              ? constantValue
              : typeof value === "number"
                ? value
                : undefined
          }
          disabled={disabled}
          readOnly={constantValue !== undefined}
          minimum={minimum}
          maximum={maximum}
          onChange={onChange}
        />
      ) : (
        <input
          value={typeof constantValue === "string"
            ? constantValue
            : typeof value === "string"
              ? value
              : ""}
          disabled={disabled}
          readOnly={constantValue !== undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={formControlClassName({ className: "w-full" })}
        />
      )}

      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function getSchemaProperties(
  manifest: PluginManifest,
): Record<string, JsonObject> {
  const properties = manifest.config.schema?.properties;
  if (!isJsonObject(properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).filter(
      (entry): entry is [string, JsonObject] => isJsonObject(entry[1]),
    ),
  );
}

function sortPluginConfigProperties(
  manifest: PluginManifest,
  properties: Record<string, JsonObject>,
): [string, JsonObject][] {
  return Object.entries(properties)
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftOrder = getFieldUi(manifest, left.entry[0])?.order;
      const rightOrder = getFieldUi(manifest, right.entry[0])?.order;
      return readOrder(leftOrder) - readOrder(rightOrder)
        || left.index - right.index;
    })
    .map((item) => item.entry);
}

function sortPluginSecrets(
  secrets: Readonly<Record<string, PluginSecretRequirement>>,
): [string, PluginSecretRequirement][] {
  return Object.entries(secrets)
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      return readOrder(left.entry[1].order) - readOrder(right.entry[1].order)
        || left.index - right.index;
    })
    .map((item) => item.entry);
}

function getFieldUi(
  manifest: PluginManifest,
  property: string,
): PluginConfigurationFieldUi | undefined {
  return manifest.config.ui?.fields?.[property];
}

function readOrder(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function createInitialConfig(manifest: PluginManifest): JsonObject {
  const config: JsonObject = {};
  for (const [property, schema] of Object.entries(getSchemaProperties(manifest))) {
    if (schema.const !== undefined) {
      config[property] = schema.const;
    }
  }
  return config;
}

function createInitialSecrets(
  manifest: PluginManifest,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(manifest.secrets)
      .filter((entry): entry is [string, typeof entry[1] & { defaultBinding: string }] =>
        typeof entry[1].defaultBinding === "string",
      )
      .map(([secret, requirement]) => [secret, requirement.defaultBinding]),
  );
}

function resolveLocalizedText(
  value: PluginLocalizedText | undefined,
  locale: string,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (!value) {
    return undefined;
  }
  return value[locale] ?? value.en ?? Object.values(value)[0];
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/^./, (first) => first.toUpperCase());
}
