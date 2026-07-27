'use client';

import type { CSSProperties, ReactNode } from "react";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { AppHeader } from "@/components/ui/layout/app-header";
import { useAppLayout } from "@/components/ui/layout/app-layout-provider";
import { useNavigationDrawer } from "@/components/ui/layout/app-shell/use-navigation-drawer";
import { useSidebarResize } from "@/components/ui/layout/app-shell/use-sidebar-resize";
import { Button } from "@/components/ui/controls/button";

interface AppShellProps {
  children: ReactNode;
  navigation: ReactNode;
  onBeforeNavigate?: (proceed: () => void) => void;
}

export function AppShell({
  children,
  navigation,
  onBeforeNavigate,
}: AppShellProps) {
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const {
    isLayoutTransitioning,
    layoutPreferences,
    previewSidebarWidth,
  } = useAppLayout();
  const { contentWidth, mode: layoutMode, sidebarWidth } = layoutPreferences;
  const {
    closeButtonRef,
    closeNavigation,
    drawerRef,
    handleDrawerKeyDown,
    handleNavigationClick,
    isNavigationOpen,
    toggleNavigation,
  } = useNavigationDrawer();
  const {
    finishSidebarResize,
    handleResizeKeyDown,
    handleResizePointerDown,
    handleResizePointerMove,
    maxSidebarWidth,
    minSidebarWidth,
  } = useSidebarResize({
    onSidebarWidthChange: layoutPreferences.onSidebarWidthChange,
    previewSidebarWidth,
    sidebarWidth,
  });

  const layoutGutter = layoutMode === "original"
    ? "max(0px, calc((100vw - 90rem) / 2))"
    : "0px";
  const contentMaxWidth = layoutMode === "full"
    ? "100%"
    : layoutMode === "both"
      ? `${contentWidth}px`
      : "72rem";

  const shellStyle = {
    "--app-header-max-width": layoutMode === "original" ? "90rem" : "100%",
    "--app-sidebar-width": `${sidebarWidth}px`,
    "--app-layout-gutter": layoutGutter,
    "--app-content-max-width": contentMaxWidth,
  } as CSSProperties;

  return (
    <div
      data-app-shell
      data-layout-transitioning={isLayoutTransitioning ? "true" : "false"}
      className="min-h-dvh bg-canvas text-ink"
      style={shellStyle}
    >
      <AppHeader
        navigationToggle={{
          isOpen: isNavigationOpen,
          onToggle: toggleNavigation,
        }}
        layoutPreferences={layoutPreferences}
        onBeforeNavigate={onBeforeNavigate}
      />

      <aside
        aria-label={tHeader("primaryNavigation")}
        data-layout-region="sidebar"
        className="fixed bottom-0 left-0 top-[4.5rem] z-30 hidden w-[calc(var(--app-layout-gutter)+var(--app-sidebar-width))] border-r border-line bg-panel-muted/55 lg:flex lg:flex-col"
      >
        <div
          data-layout-region="sidebar-content"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-[var(--app-layout-gutter)]"
        >
          {navigation}
        </div>
        <div
          role="separator"
          tabIndex={0}
          aria-label={tHeader("resizeNavigation")}
          aria-orientation="vertical"
          aria-valuemin={minSidebarWidth}
          aria-valuemax={maxSidebarWidth}
          aria-valuenow={sidebarWidth}
          onKeyDown={handleResizeKeyDown}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishSidebarResize}
          onPointerCancel={finishSidebarResize}
          onLostPointerCapture={finishSidebarResize}
          className="group absolute bottom-0 right-[-4px] top-0 z-10 w-2 cursor-col-resize touch-none outline-none"
        >
          <span className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-transparent transition group-hover:bg-accent group-focus-visible:bg-accent" />
        </div>
      </aside>

      {isNavigationOpen ? (
        <div className="fixed inset-0 z-[1100] lg:hidden">
          <div
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px] animate-[backdrop-in_180ms_ease-out] motion-reduce:animate-none"
            aria-hidden="true"
            onClick={closeNavigation}
          />
          <aside
            ref={drawerRef}
            id="app-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={tHeader("primaryNavigation")}
            onKeyDown={handleDrawerKeyDown}
            className="relative flex h-dvh w-[calc(100vw-1rem)] max-w-md flex-col border-r border-line bg-panel shadow-[24px_0_64px_-32px_rgb(23_32_51_/_45%)] animate-[drawer-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
          >
            <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-line px-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/logo.ico"
                  alt=""
                  width={32}
                  height={32}
                  className="rounded-xl border border-line bg-panel-muted"
                />
                <span className="truncate text-sm font-semibold tracking-tight text-ink">
                  {tHeader("console")}
                </span>
              </div>
              <Button
                ref={closeButtonRef}
                onClick={closeNavigation}
                size="icon"
                aria-label={tCommon("close")}
                title={tCommon("close")}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              onClick={handleNavigationClick}
            >
              {navigation}
            </div>
          </aside>
        </div>
      ) : null}

      <div
        data-layout-region="content-frame"
        className="lg:pl-[calc(var(--app-layout-gutter)+var(--app-sidebar-width))] lg:pr-[var(--app-layout-gutter)]"
      >
        {children}
      </div>
    </div>
  );
}
