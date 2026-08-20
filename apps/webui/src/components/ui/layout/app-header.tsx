'use client';

import Image from "next/image";
import { useTranslations } from "next-intl";
import { signIn, signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/controls/button";
import { LanguageSwitcher } from "@/components/ui/controls/language-switcher";
import {
  LayoutSwitcher,
  type LayoutPreferences,
} from "@/components/ui/layout/layout-switcher";

export type AppHeaderProps = {
  layoutPreferences: LayoutPreferences;
  navigationToggle?: {
    isOpen: boolean;
    onToggle: () => void;
  };
  onBeforeNavigate?: (proceed: () => void) => void;
};

export function AppHeader({
  layoutPreferences,
  navigationToggle,
  onBeforeNavigate,
}: AppHeaderProps) {
  const t = useTranslations("header");

  const { data: session, status } = useSession();
  const navigationToggleLabel = navigationToggle?.isOpen
    ? t("closeNavigation")
    : t("openNavigation");
  const requestNavigation = (proceed: () => void) => {
    if (onBeforeNavigate) {
      onBeforeNavigate(proceed);
      return;
    }
    proceed();
  };

  return (
    <header className="sticky top-0 z-[1000] flex h-[4.5rem] items-center border-b border-line/90 bg-panel/85 backdrop-blur-xl">
      <div
        data-layout-region="header"
        className="mx-auto flex w-full max-w-[var(--app-header-max-width)] items-center justify-between gap-3 px-4 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {navigationToggle ? (
            <Button
              id="app-navigation-trigger"
              onClick={navigationToggle.onToggle}
              aria-expanded={navigationToggle.isOpen}
              aria-controls="app-navigation-drawer"
              aria-label={navigationToggleLabel}
              title={navigationToggleLabel}
              size="icon-lg"
              className="shrink-0 lg:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M5 7h14M5 12h9M5 17h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
          ) : null}
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/nami-favicon.webp"
              alt=""
              width={32}
              height={32}
              className="rounded-xl bg-panel"
              priority
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-ink sm:text-base">
                {t("console")}
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted sm:block">
                {t("workspaceLabel")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 text-sm text-ink sm:gap-3">
          <LayoutSwitcher {...layoutPreferences} />
          <LanguageSwitcher onBeforeNavigate={onBeforeNavigate} />
          {session ? (
            <div className="flex min-w-0 items-center gap-2 border-l border-line pl-2 sm:pl-3">
              {session.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? t("githubUser")}
                  width={28}
                  height={28}
                  className="rounded-full border border-line"
                />
              ) : null}
              <span className="hidden max-w-[14rem] truncate text-sm text-muted md:block">
                {session.user?.name ?? session.user?.email ?? t("signedIn")}
              </span>
              <Button
                onClick={() => requestNavigation(() => void signOut())}
                size="icon-lg"
                aria-label={t("signOut")}
                title={t("signOut")}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M10 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 12H3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 9l-3 3 3 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </div>
          ) : status === "unauthenticated" ? (
            <Button
              onClick={() => signIn("github")}
              size="icon-lg"
              aria-label={t("signIn")}
              title={t("signIn")}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M14 7V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M9 12h12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="m18 9 3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
