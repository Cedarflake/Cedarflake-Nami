"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";

import type { PluginInstanceConfig } from "@i0c/config";
import type { PluginLocalizedText } from "@i0c/plugin-api";

import { PluginConfigurationEditor } from "@/components/settings/plugin-settings-editor";
import { Button } from "@/components/ui/controls/button";
import {
  SkeletonBlock,
  SkeletonPulse,
} from "@/components/ui/feedback/skeletons";
import { resolveAppLocale } from "@/i18n/routing";
import type { WebUiPluginStatusSnapshot } from "@/lib/plugins/status-types";
import {
  installedInstancePluginManifests,
} from "@/lib/configuration/validation";

import { WebUiPluginSlot } from "./plugin-slot";
import {
  loadPluginStatusMessages,
  type PluginStatusMessages,
} from "./messages";

interface PluginStatusPanelProps {
  isReadOnly?: boolean;
  onChange?: (value: Record<string, PluginInstanceConfig>) => void;
  value?: Record<string, PluginInstanceConfig>;
}

type PluginDetailView = "configuration" | "status";

export function PluginStatusPanel({
  isReadOnly = true,
  onChange,
  value,
}: PluginStatusPanelProps) {
  const locale = resolveAppLocale(useLocale());
  const [messages, setMessages] = useState<PluginStatusMessages | null>(null);
  const [snapshot, setSnapshot] = useState<WebUiPluginStatusSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [detailView, setDetailView] =
    useState<PluginDetailView>("configuration");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const loaded = await loadPluginStatus(locale);
      setMessages(loaded.messages);
      setSnapshot(loaded.snapshot);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    let isCurrent = true;
    void loadPluginStatus(locale)
      .then((loaded) => {
        if (isCurrent) {
          setMessages(loaded.messages);
          setSnapshot(loaded.snapshot);
          setError(false);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError(true);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [locale]);

  if (!messages || isLoading) {
    return (
      <SkeletonPulse className="py-8">
        <section aria-busy="true">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="mt-2 h-4 w-64 max-w-full" />
            </div>
            <SkeletonBlock className="h-9 w-24 rounded-xl" />
          </div>
          <div className="mt-5 border-y border-line py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SkeletonBlock className="h-4 w-36" />
                <SkeletonBlock className="mt-2 h-3 w-52 max-w-full" />
              </div>
              <SkeletonBlock className="h-7 w-20 rounded-full" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-2 h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </SkeletonPulse>
    );
  }

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{messages.title}</h2>
          <p className="mt-1 text-sm text-muted">{messages.description}</p>
        </div>
        <Button onClick={() => void refresh()} size="sm" variant="secondary">
          {messages.refresh}
        </Button>
      </div>

      {error || !snapshot ? (
        <p className="mt-5 border-l-2 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {messages.loadError}
        </p>
      ) : (
        <PluginStatusContent
          detailView={detailView}
          isReadOnly={isReadOnly}
          messages={messages}
          onChange={onChange}
          onDetailViewChange={setDetailView}
          onSelectedPluginIdChange={setSelectedPluginId}
          selectedPluginId={selectedPluginId}
          snapshot={snapshot}
          value={value}
        />
      )}

      <WebUiPluginSlot name="settings.plugins" context={snapshot} />
    </section>
  );
}

function PluginStatusContent({
  detailView,
  isReadOnly,
  messages,
  onChange,
  onDetailViewChange,
  onSelectedPluginIdChange,
  selectedPluginId,
  snapshot,
  value,
}: {
  detailView: PluginDetailView;
  isReadOnly: boolean;
  messages: PluginStatusMessages;
  onChange?: (value: Record<string, PluginInstanceConfig>) => void;
  onDetailViewChange: (value: PluginDetailView) => void;
  onSelectedPluginIdChange: (value: string) => void;
  selectedPluginId: string | null;
  snapshot: WebUiPluginStatusSnapshot;
  value?: Record<string, PluginInstanceConfig>;
}) {
  const locale = resolveAppLocale(useLocale());

  return (
    <div className="mt-5 divide-y divide-line border-y border-line">
      <div className="py-2">
        {snapshot.plugins.map((plugin) => {
          const manifest = installedInstancePluginManifests.find(
            (candidate) => candidate.id === plugin.id,
          );
          const summary = resolveLocalizedText(
            plugin.description?.summary,
            locale,
          );
          const canEditConfig = Boolean(manifest && value && onChange);
          const isSelected = plugin.id === selectedPluginId;
          const isConfigurationSelected =
            isSelected && detailView === "configuration";
          const isStatusSelected = isSelected && detailView === "status";

          return (
            <article key={plugin.id} className="py-4">
              <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      {plugin.name}
                    </h3>
                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        getConfigurationStateClassName(
                          plugin.configurationState,
                        ),
                      ].join(" ")}
                    >
                      {messages.configurationStates[plugin.configurationState]}
                    </span>
                  </div>
                  <code className="mt-1 block break-all text-xs text-muted">
                    {plugin.id}
                  </code>
                  {summary ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                      {summary}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-nowrap items-center gap-2 md:justify-self-end">
                  <button
                    type="button"
                    disabled={!canEditConfig}
                    onClick={() => {
                      onSelectedPluginIdChange(
                        isConfigurationSelected ? "" : plugin.id,
                      );
                      onDetailViewChange("configuration");
                    }}
                    className={[
                      "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      isConfigurationSelected
                        ? "bg-accent text-white"
                        : "bg-panel-muted text-muted hover:text-ink",
                      canEditConfig ? "" : "cursor-not-allowed opacity-50",
                    ].join(" ")}
                  >
                    {messages.configurationTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectedPluginIdChange(
                        isStatusSelected ? "" : plugin.id,
                      );
                      onDetailViewChange("status");
                    }}
                    className={[
                      "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      isStatusSelected
                        ? "bg-accent text-white"
                        : "bg-panel-muted text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {messages.statusTab}
                  </button>
                </div>
              </div>

              {isSelected && detailView === "configuration" ? (
                <div className="mt-5">
                  {canEditConfig && manifest && value && onChange ? (
                    <PluginConfigurationEditor
                      manifest={manifest}
                      value={value}
                      isReadOnly={isReadOnly}
                      onChange={onChange}
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      {messages.configurationStates[plugin.configurationState]}
                    </p>
                  )}
                </div>
              ) : null}

              {isSelected && detailView === "status" ? (
                <PluginStatusDetails
                  messages={messages}
                  plugin={plugin}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PluginStatusDetails({
  messages,
  plugin,
}: {
  messages: PluginStatusMessages;
  plugin: WebUiPluginStatusSnapshot["plugins"][number];
}) {
  return (
    <div className="mt-5">
      <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-muted">{messages.configuration}</dt>
          <dd className="mt-1 text-ink">v{plugin.version}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">{messages.apiVersion}</dt>
          <dd className="mt-1 text-ink">v{plugin.apiVersion}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">{messages.hosts}</dt>
          <dd className="mt-1 text-ink">{plugin.hosts.join(", ")}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">{messages.health}</dt>
          <dd className="mt-1 text-ink">
            {messages.healthStates[plugin.health]}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="text-xs font-medium text-muted">{messages.capabilities}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {plugin.capabilities.map((capability) => (
            <code
              key={capability}
              className="rounded-md bg-panel-muted px-2 py-1 text-[11px] text-ink"
            >
              {capability}
            </code>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs text-muted">
        {!plugin.bindingsObservable
          ? messages.bindingsNotObservable
          : plugin.missingSecretBindings.length > 0
            ? `${messages.missingBindings}: ${plugin.missingSecretBindings.join(", ")}`
            : messages.noMissingBindings}
      </p>
    </div>
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

function getConfigurationStateClassName(
  state: "compatibility" | "configured" | "disabled",
): string {
  if (state === "configured") {
    return "border-accent-soft bg-accent-soft text-accent-strong";
  }
  if (state === "compatibility") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-line bg-panel-muted text-muted";
}

async function loadPluginStatus(locale: ReturnType<typeof resolveAppLocale>) {
  const [messages, response] = await Promise.all([
    loadPluginStatusMessages(locale),
    fetch("/api/plugins/status", { cache: "no-store" }),
  ]);
  if (!response.ok) {
    throw new Error(`Plugin status request failed with ${response.status}`);
  }
  return {
    messages,
    snapshot: await response.json() as WebUiPluginStatusSnapshot,
  };
}
