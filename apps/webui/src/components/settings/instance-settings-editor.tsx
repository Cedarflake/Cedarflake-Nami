"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { DataConfig, RobotsPolicy, WebUiAccessMode } from "@i0c/config";

import { PluginStatusPanel } from "@/components/plugins/plugin-status-panel";
import { DataManagementPanel } from "@/components/settings/data-management-panel";
import { Button } from "@/components/ui/controls/button";
import { DropdownSelect } from "@/components/ui/controls/dropdown-select";
import {
  fieldLabelClassName,
  fieldLabelRowClassName,
  formControlClassName,
} from "@/components/ui/controls/form-control";
import { NumberInput } from "@/components/ui/controls/number-input";
import { validateInstanceDataConfig } from "@/lib/configuration/validation";

import type { SettingsCategory } from "./settings-navigation";

interface InstanceSettingsEditorProps {
  hasUnsavedChanges: boolean;
  isReadOnly: boolean;
  onChange: (value: DataConfig) => void;
  onCategoryChange: (category: SettingsCategory) => void;
  selectedCategory: SettingsCategory;
  value: DataConfig;
}

interface SettingsFieldProps {
  children: ReactNode;
  description: string;
  label: string;
}

export function InstanceSettingsEditor({
  hasUnsavedChanges,
  isReadOnly,
  onChange,
  onCategoryChange,
  selectedCategory,
  value,
}: InstanceSettingsEditorProps) {
  const t = useTranslations("instanceConfig");
  const validation = useMemo(() => validateInstanceDataConfig(value), [value]);
  const issues = validation.status === "invalid" ? validation.issues : [];
  const validationFieldLabels: Readonly<Record<string, string>> = {
    "/$schema": t("validationFields.schema"),
    "/schemaVersion": t("validationFields.schemaVersion"),
    "/runtime": t("sections.runtime.title"),
    "/runtime/canonicalOrigin": t("fields.canonicalOrigin"),
    "/runtime/robotsPolicy": t("fields.robotsPolicy"),
    "/analytics": t("sections.analytics.title"),
    "/analytics/ingestEndpoint": t("fields.ingestEndpoint"),
    "/analytics/sourceId": t("fields.sourceId"),
    "/webui/access": t("sections.access.title"),
    "/webui/access/mode": t("fields.accessMode"),
    "/webui/access/managerGitHubUserIds": t(
      "fields.managerGitHubUserIds",
    ),
    "/webui/access/blockedGitHubUserIds": t(
      "fields.blockedGitHubUserIds",
    ),
    "/plugins": t("sections.installedPlugins.title"),
  };
  const validationReasonLabels: Readonly<Record<string, string>> = {
    "must contain GitHub numeric user IDs": t(
      "validationReasons.githubNumericUserIds",
    ),
    "must not contain duplicate IDs": t("validationReasons.duplicateIds"),
    "must not contain manager GitHub user IDs": t(
      "validationReasons.managerBlockedOverlap",
    ),
    "must not be empty in allowlist mode": t(
      "validationReasons.managerRequired",
    ),
    "must be an HTTPS URL without credentials": t(
      "validationReasons.httpsUrl",
    ),
    "must be an HTTPS origin without credentials, path, query, or hash": t(
      "validationReasons.httpsOrigin",
    ),
    "must be a lowercase hostname": t(
      "validationReasons.lowercaseHostname",
    ),
    "must be allow or disallow": t("validationReasons.robotsPolicy"),
    "must be authenticated, allowlist, or public-readonly": t(
      "validationReasons.accessMode",
    ),
    "must be an array": t("validationReasons.list"),
    "must be an object": t("validationReasons.object"),
    "must be an object with an enabled boolean": t(
      "validationReasons.pluginDeclaration",
    ),
    "must be a positive integer": t("validationReasons.positiveInteger"),
    "must be a JSON object": t("validationReasons.jsonObject"),
    "must name an environment variable": t(
      "validationReasons.environmentVariable",
    ),
    "must be a boolean": t("validationReasons.boolean"),
    "must be a finite number": t("validationReasons.number"),
    "must be a string": t("validationReasons.string"),
    "must be a string array": t("validationReasons.stringList"),
    "is required": t("validationReasons.required"),
    "is not allowed": t("validationReasons.notAllowed"),
    "plugin is not installed in this host": t(
      "validationReasons.pluginNotInstalled",
    ),
    "required secret binding is missing": t(
      "validationReasons.secretBindingRequired",
    ),
    "must be enabled for the installed Runtime deployment": t(
      "validationReasons.runtimePluginRequired",
    ),
    "must be enabled for the WebUI data repository": t(
      "validationReasons.webUiRepositoryRequired",
    ),
  };

  function formatValidationIssue(issue: { path: string; message: string }) {
    const pluginId = resolveValidationPluginId(issue.path);
    const field = validationFieldLabels[issue.path]
      ?? (pluginId
        ? t("validationPluginField", { plugin: pluginId })
        : t("validationFields.configuration"));
    let reason = validationReasonLabels[issue.message];

    const minimum = /^must be at least (.+)$/.exec(issue.message)?.[1];
    const maximum = /^must be at most (.+)$/.exec(issue.message)?.[1];
    const range = /^must be an integer from (.+) through (.+)$/.exec(
      issue.message,
    );
    if (!reason && minimum) {
      reason = t("validationReasons.minimum", { value: minimum });
    } else if (!reason && maximum) {
      reason = t("validationReasons.maximum", { value: maximum });
    } else if (!reason && range?.[1] && range[2]) {
      reason = t("validationReasons.integerRange", {
        minimum: range[1],
        maximum: range[2],
      });
    }

    return t("validationIssue", {
      field,
      reason: reason ?? t("validationReasons.invalid"),
    });
  }

  function updateRuntime(next: Partial<DataConfig["runtime"]>) {
    onChange({
      ...value,
      runtime: {
        ...value.runtime,
        ...next,
      },
    });
  }

  function updateAnalytics(next: Partial<DataConfig["analytics"]>) {
    onChange({
      ...value,
      analytics: {
        ...value.analytics,
        ...next,
      },
    });
  }

  function updateAccess(next: Partial<DataConfig["webui"]["access"]>) {
    onChange({
      ...value,
      webui: {
        ...value.webui,
        access: {
          ...value.webui.access,
          ...next,
        },
      },
    });
  }

  return (
    <div>
      {issues.length > 0 ? (
        <div className="mb-6 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">{t("validationSummary")}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {issues.slice(0, 5).map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>
                {formatValidationIssue(issue)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav
          aria-label={t("categoryNavigation")}
          className="lg:sticky lg:top-20 lg:self-start"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {t("categoryNavigation")}
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            <SettingsCategoryButton
              isSelected={selectedCategory === "runtime"}
              onClick={() => onCategoryChange("runtime")}
            >
              {t("sections.runtime.title")}
            </SettingsCategoryButton>
            <SettingsCategoryButton
              isSelected={selectedCategory === "analytics"}
              onClick={() => onCategoryChange("analytics")}
            >
              {t("sections.analytics.title")}
            </SettingsCategoryButton>
            <SettingsCategoryButton
              isSelected={selectedCategory === "access"}
              onClick={() => onCategoryChange("access")}
            >
              {t("sections.access.title")}
            </SettingsCategoryButton>
            <SettingsCategoryButton
              isSelected={selectedCategory === "installed-plugins"}
              onClick={() => onCategoryChange("installed-plugins")}
            >
              {t("sections.installedPlugins.title")}
            </SettingsCategoryButton>
            <SettingsCategoryButton
              isSelected={selectedCategory === "data"}
              onClick={() => onCategoryChange("data")}
            >
              {t("sections.data.title")}
            </SettingsCategoryButton>
          </div>
        </nav>

        <div className="min-w-0">
          {selectedCategory === "runtime" ? (
            <SettingsSection
              title={t("sections.runtime.title")}
              description={t("sections.runtime.description")}
            >
            <SettingsField
              label={t("fields.canonicalOrigin")}
              description={t("fieldHints.canonicalOrigin")}
            >
              <input
                value={value.runtime.canonicalOrigin}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateRuntime({
                    canonicalOrigin: event.target.value as `https://${string}`,
                  })
                }
                placeholder="https://i0c.cc"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={formControlClassName({ className: "w-full" })}
              />
            </SettingsField>

            <SettingsField
              label={t("fields.robotsPolicy")}
              description={t("fieldHints.robotsPolicy")}
            >
              <DropdownSelect
                value={value.runtime.robotsPolicy}
                disabled={isReadOnly}
                onChange={(robotsPolicy) =>
                  updateRuntime({ robotsPolicy: robotsPolicy as RobotsPolicy })
                }
                options={[
                  { value: "allow", label: t("options.robotsAllow") },
                  { value: "disallow", label: t("options.robotsDisallow") },
                ]}
              />
            </SettingsField>

            <SettingsField
              label={t("fields.configCacheTtlSeconds")}
              description={t("fieldHints.configCacheTtlSeconds")}
            >
              <NumberInput
                value={value.runtime.configCacheTtlSeconds}
                disabled={isReadOnly}
                minimum={1}
                maximum={86400}
                onChange={(configCacheTtlSeconds) => {
                  if (configCacheTtlSeconds !== undefined) {
                    updateRuntime({ configCacheTtlSeconds });
                  }
                }}
              />
            </SettingsField>

            <SettingsField
              label={t("fields.redirectsCacheTtlSeconds")}
              description={t("fieldHints.redirectsCacheTtlSeconds")}
            >
              <NumberInput
                value={value.runtime.redirectsCacheTtlSeconds}
                disabled={isReadOnly}
                minimum={1}
                maximum={86400}
                onChange={(redirectsCacheTtlSeconds) => {
                  if (redirectsCacheTtlSeconds !== undefined) {
                    updateRuntime({ redirectsCacheTtlSeconds });
                  }
                }}
              />
            </SettingsField>
            </SettingsSection>
          ) : null}

          {selectedCategory === "analytics" ? (
            <SettingsSection
              title={t("sections.analytics.title")}
              description={t("sections.analytics.description")}
            >
            <SettingsField
              label={t("fields.ingestEndpoint")}
              description={t("fieldHints.ingestEndpoint")}
            >
              <input
                value={value.analytics.ingestEndpoint}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateAnalytics({
                    ingestEndpoint: event.target.value as `https://${string}`,
                  })
                }
                placeholder="https://u.i0c.cc/api/analytics/events"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={formControlClassName({ className: "w-full" })}
              />
            </SettingsField>

            <SettingsField
              label={t("fields.sourceId")}
              description={t("fieldHints.sourceId")}
            >
              <input
                value={value.analytics.sourceId}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateAnalytics({ sourceId: event.target.value.toLowerCase() })
                }
                placeholder="i0c.cc"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={formControlClassName({ className: "w-full font-mono" })}
              />
            </SettingsField>
            </SettingsSection>
          ) : null}

          {selectedCategory === "access" ? (
            <SettingsSection
              title={t("sections.access.title")}
              description={t("sections.access.description")}
            >
            <SettingsField
              label={t("fields.accessMode")}
              description={t("fieldHints.accessMode")}
            >
              <DropdownSelect
                value={value.webui.access.mode}
                disabled={isReadOnly}
                onChange={(mode) =>
                  updateAccess({ mode: mode as WebUiAccessMode })
                }
                options={[
                  { value: "authenticated", label: t("options.authenticated") },
                  { value: "allowlist", label: t("options.allowlist") },
                  { value: "public-readonly", label: t("options.publicReadonly") },
                ]}
              />
            </SettingsField>

            <GitHubUserIdListEditor
              addLabel={t("addManager")}
              description={t("fieldHints.managerGitHubUserIds")}
              ids={value.webui.access.managerGitHubUserIds}
              isReadOnly={isReadOnly}
              itemLabel={(index) => t("managerIdLabel", { index })}
              label={t("fields.managerGitHubUserIds")}
              onChange={(managerGitHubUserIds) =>
                updateAccess({ managerGitHubUserIds })
              }
              removeLabel={t("removeManager")}
            />

            {value.webui.access.mode === "allowlist" ? null : (
              <GitHubUserIdListEditor
                addLabel={t("addBlockedUser")}
                description={t("fieldHints.blockedGitHubUserIds")}
                ids={value.webui.access.blockedGitHubUserIds ?? []}
                isReadOnly={isReadOnly}
                itemLabel={(index) => t("blockedIdLabel", { index })}
                label={t("fields.blockedGitHubUserIds")}
                onChange={(blockedGitHubUserIds) =>
                  updateAccess({ blockedGitHubUserIds })
                }
                removeLabel={t("removeBlockedUser")}
              />
            )}
            </SettingsSection>
          ) : null}

          {selectedCategory === "installed-plugins" ? (
            <PluginStatusPanel
              value={value.plugins}
              isReadOnly={isReadOnly}
              onChange={(plugins) => onChange({ ...value, plugins })}
            />
          ) : null}

          {selectedCategory === "data" ? (
            <DataManagementPanel
              hasUnsavedChanges={hasUnsavedChanges}
              isReadOnly={isReadOnly}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="py-8">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      <div className="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function SettingsCategoryButton({
  children,
  isSelected,
  onClick,
}: {
  children: ReactNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        isSelected
          ? "bg-accent-soft text-accent-strong"
          : "text-muted hover:bg-panel-muted hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SettingsField({
  children,
  description,
  label,
}: SettingsFieldProps) {
  return (
    <div>
      <label className={fieldLabelRowClassName}>
        <span className={fieldLabelClassName}>{label}</span>
      </label>
      {children}
      <p className="mt-1.5 text-xs leading-5 text-muted">{description}</p>
    </div>
  );
}

function GitHubUserIdListEditor({
  addLabel,
  description,
  ids,
  isReadOnly,
  itemLabel,
  label,
  onChange,
  removeLabel,
}: {
  addLabel: string;
  description: string;
  ids: readonly string[];
  isReadOnly: boolean;
  itemLabel: (index: number) => string;
  label: string;
  onChange: (ids: string[]) => void;
  removeLabel: string;
}) {
  return (
    <div className="sm:col-span-2">
      <div className={fieldLabelRowClassName}>
        <span className={fieldLabelClassName}>{label}</span>
      </div>
      <p className="mb-3 text-xs leading-5 text-muted">{description}</p>
      <div className="space-y-2">
        {ids.map((userId, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={userId}
              disabled={isReadOnly}
              onChange={(event) => {
                const nextIds = [...ids];
                nextIds[index] = event.target.value.replace(/\D/g, "");
                onChange(nextIds);
              }}
              inputMode="numeric"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label={itemLabel(index + 1)}
              className={formControlClassName({
                className: "min-w-0 flex-1 font-mono",
              })}
            />
            {isReadOnly ? null : (
              <Button
                onClick={() =>
                  onChange(
                    ids.filter(
                      (_, candidateIndex) => candidateIndex !== index,
                    ),
                  )
                }
                size="icon"
                variant="danger"
                title={removeLabel}
                aria-label={removeLabel}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" strokeLinecap="round" />
                </svg>
              </Button>
            )}
          </div>
        ))}
      </div>
      {isReadOnly ? null : (
        <Button
          onClick={() => onChange([...ids, ""])}
          className="mt-3"
          size="sm"
          variant="secondary"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {addLabel}
        </Button>
      )}
    </div>
  );
}

function resolveValidationPluginId(path: string): string | null {
  const [, root, encodedPluginId] = path.split("/");
  if (root !== "plugins" || !encodedPluginId) {
    return null;
  }

  return encodedPluginId
    .replaceAll("~1", "/")
    .replaceAll("~0", "~");
}
