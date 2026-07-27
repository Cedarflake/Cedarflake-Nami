"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/controls/button";
import { formControlClassName } from "@/components/ui/controls/form-control";
import { Switch } from "@/components/ui/controls/switch";
import { resolveAppLocale } from "@/i18n/routing";

const providerIds = ["cloudflare", "vercel", "netlify"] as const;

export function SetupForm({
  defaultWebUiOrigin,
}: {
  defaultWebUiOrigin: string;
}) {
  const locale = resolveAppLocale(useLocale());
  const t = useTranslations("setup");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [analyticsSourceId, setAnalyticsSourceId] = useState("");
  const [enabledProviders, setEnabledProviders] = useState<
    Set<(typeof providerIds)[number]>
  >(new Set(["cloudflare"]));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runtimeOrigin, setRuntimeOrigin] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [webUiOrigin, setWebUiOrigin] = useState(defaultWebUiOrigin);

  function toggleProvider(
    provider: (typeof providerIds)[number],
    enabled: boolean,
  ) {
    setEnabledProviders((current) => {
      const next = new Set(current);
      if (enabled) {
        next.add(provider);
      } else {
        next.delete(provider);
      }
      return next;
    });
  }

  function updateRuntimeOrigin(value: string) {
    setRuntimeOrigin(value);
    if (!analyticsSourceId) {
      try {
        setAnalyticsSourceId(new URL(value).hostname.toLowerCase());
      } catch {
        // Keep the source ID empty until the Runtime origin becomes valid.
      }
    }
  }

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyticsEnabled,
          analyticsSourceId,
          runtimeOrigin,
          runtimeProviders: [...enabledProviders],
          setupSecret,
          webUiOrigin,
        }),
      });
      const result = await response.json() as { error?: unknown };
      if (!response.ok) {
        throw new Error(resolveErrorMessage(result.error, t("unknownError")));
      }
      window.location.assign(`/${locale}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t("unknownError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="mt-7 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="setup-secret">
          {t("secret")}
        </label>
        <input
          id="setup-secret"
          type="password"
          autoComplete="off"
          value={setupSecret}
          onChange={(event) => setSetupSecret(event.target.value)}
          className={formControlClassName({ className: "mt-2 w-full" })}
          required
          minLength={32}
        />
        <p className="mt-2 text-xs leading-5 text-muted">{t("secretHelp")}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="webui-origin">
            {t("webUiOrigin")}
          </label>
          <input
            id="webui-origin"
            type="url"
            value={webUiOrigin}
            onChange={(event) => setWebUiOrigin(event.target.value)}
            className={formControlClassName({ className: "mt-2 w-full" })}
            placeholder="https://u.example.com"
            required
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="runtime-origin">
            {t("runtimeOrigin")}
          </label>
          <input
            id="runtime-origin"
            type="url"
            value={runtimeOrigin}
            onChange={(event) => updateRuntimeOrigin(event.target.value)}
            className={formControlClassName({ className: "mt-2 w-full" })}
            placeholder="https://example.com"
            required
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">
          {t("runtimePlatforms")}
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {providerIds.map((provider) => (
            <label
              key={provider}
              className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink"
            >
              <input
                type="checkbox"
                checked={enabledProviders.has(provider)}
                onChange={(event) =>
                  toggleProvider(provider, event.target.checked)
                }
                className="h-4 w-4 accent-accent"
              />
              {t(`providers.${provider}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-5 border-y border-line py-4">
        <div>
          <p className="text-sm font-semibold text-ink">{t("analytics")}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("analyticsHelp")}
          </p>
        </div>
        <Switch
          checked={analyticsEnabled}
          label={t("analytics")}
          onChange={setAnalyticsEnabled}
        />
      </div>

      {analyticsEnabled ? (
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="source-id">
            {t("sourceId")}
          </label>
          <input
            id="source-id"
            type="text"
            value={analyticsSourceId}
            onChange={(event) =>
              setAnalyticsSourceId(event.target.value.toLowerCase())
            }
            className={formControlClassName({ className: "mt-2 w-full" })}
            placeholder="example.com"
            required
          />
          <p className="mt-2 text-xs leading-5 text-muted">{t("sourceIdHelp")}</p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-l-2 border-danger bg-danger/5 px-4 py-3 text-sm leading-6 text-danger"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={
          isSubmitting
          || setupSecret.length < 32
          || enabledProviders.size === 0
        }
      >
        {isSubmitting ? t("initializing") : t("initialize")}
      </Button>
    </form>
  );
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const messages = Object.values(error)
      .flatMap((value) => Array.isArray(value) ? value : [])
      .filter((value): value is string => typeof value === "string");
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }
  return fallback;
}
