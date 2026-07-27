import { getServerSession } from "next-auth/next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { bootstrapConfig } from "@i0c/config";

import { authOptions } from "@/auth/config";
import { SetupForm } from "@/components/setup/setup-form";
import { LanguageSwitcher } from "@/components/ui/controls/language-switcher";
import { SignInPanel } from "@/components/ui/feedback/sign-in-panel";
import { Card } from "@/components/ui/surfaces/card";
import { getAppSetupState } from "@/lib/setup/setup-state";
import { isSetupSecretConfigured } from "@/lib/setup/setup-secret";

interface SetupPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function SetupPage({ params }: SetupPageProps) {
  const { locale } = await params;
  const setupState = await getAppSetupState();
  if (setupState.state === "initialized") {
    redirect(`/${locale}`);
  }

  const t = await getTranslations({ locale, namespace: "setup" });
  if (setupState.state === "migration-required") {
    return (
      <SetupStatePanel
        title={t("migrationRequired")}
        description={t("migrationRequiredHelp")}
        detail={
          bootstrapConfig.data.repository.provider === "d1"
            ? t("migrationRequiredD1Detail")
            : "pnpm --filter @i0c/plugin-data-repository-postgres migrate"
        }
      />
    );
  }
  if (setupState.state === "partial") {
    return (
      <SetupStatePanel
        title={t("partial")}
        description={t("partialHelp")}
        detail={setupState.existingKinds.join(", ")}
      />
    );
  }
  if (setupState.state === "unsupported") {
    return (
      <SetupStatePanel
        title={t("unsupported")}
        description={t("unsupportedHelp")}
      />
    );
  }
  if (!isSetupSecretConfigured()) {
    return (
      <SetupStatePanel
        title={t("secretMissing")}
        description={t("secretMissingHelp")}
        detail="I0C_SECRET"
      />
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <SignInPanel callbackUrl={`/${locale}/setup`} />
      </main>
    );
  }
  const defaultWebUiOrigin = await resolveRequestOrigin();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-2xl">
        <Card elevation="flat" padding="lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-muted">
              <span aria-hidden="true" className="h-1 w-8 rounded-full bg-accent" />
              i0c.cc
            </div>
            <LanguageSwitcher />
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-ink">{t("title")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("description")}</p>
          <SetupForm defaultWebUiOrigin={defaultWebUiOrigin} />
        </Card>
      </div>
    </main>
  );
}

async function resolveRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host")
    ?? requestHeaders.get("host")
    ?? ""
  ).split(",")[0]?.trim();
  if (!host) {
    return "";
  }
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol = forwardedProtocol
    || (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${protocol}://${host}`;
}

function SetupStatePanel({
  description,
  detail,
  title,
}: {
  description: string;
  detail?: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md">
        <Card elevation="flat" padding="lg">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-muted">
            <span aria-hidden="true" className="h-1 w-8 rounded-full bg-accent" />
            i0c.cc
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
          {detail ? (
            <code className="mt-5 block break-all rounded-xl bg-panel-muted px-4 py-3 text-xs text-ink">
              {detail}
            </code>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
