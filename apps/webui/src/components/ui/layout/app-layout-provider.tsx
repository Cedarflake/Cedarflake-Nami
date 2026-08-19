'use client';

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  layoutWidthLimits,
  type AppLayoutMode,
  type LayoutPreferences,
} from "@/components/ui/layout/layout-switcher";

interface AppLayoutContextValue {
  isLayoutTransitioning: boolean;
  layoutPreferences: LayoutPreferences;
  previewSidebarWidth: (width: number) => void;
}

interface AppLayoutProviderProps {
  children: ReactNode;
}

const defaultSidebarWidth = 320;
const defaultContentWidth = 1152;
const defaultLayoutMode: AppLayoutMode = "original";
const sidebarWidthStorageKey = "nami:webui:sidebar-width";
const contentWidthStorageKey = "nami:webui:content-width";
const layoutModeStorageKey = "nami:webui:layout-mode";

const AppLayoutContext = createContext<AppLayoutContextValue | null>(null);

function clampSidebarWidth(width: number): number {
  return Math.min(layoutWidthLimits.sidebar.max, Math.max(layoutWidthLimits.sidebar.min, width));
}

function clampContentWidth(width: number): number {
  return Math.min(layoutWidthLimits.content.max, Math.max(layoutWidthLimits.content.min, width));
}

function isAppLayoutMode(value: string | null): value is AppLayoutMode {
  return value === "full" || value === "sidebar" || value === "both" || value === "original";
}

function persistLayoutPreference(key: string, value: string | number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function AppLayoutProvider({ children }: AppLayoutProviderProps) {
  const [layoutMode, setLayoutMode] = useState<AppLayoutMode>(defaultLayoutMode);
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [contentWidth, setContentWidth] = useState(defaultContentWidth);
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false);
  const layoutTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const storedSidebarWidth = Number(window.localStorage.getItem(sidebarWidthStorageKey));
        if (Number.isFinite(storedSidebarWidth) && storedSidebarWidth > 0) {
          setSidebarWidth(clampSidebarWidth(storedSidebarWidth));
        }

        const storedContentWidth = Number(window.localStorage.getItem(contentWidthStorageKey));
        if (Number.isFinite(storedContentWidth) && storedContentWidth > 0) {
          setContentWidth(clampContentWidth(storedContentWidth));
        }

        const storedLayoutMode = window.localStorage.getItem(layoutModeStorageKey);
        if (isAppLayoutMode(storedLayoutMode)) {
          setLayoutMode(storedLayoutMode);
        }
      } catch {
        // Keep the defaults when local storage is unavailable.
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (layoutTransitionTimerRef.current) {
        clearTimeout(layoutTransitionTimerRef.current);
      }
    };
  }, []);

  const previewSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(clampSidebarWidth(width));
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    const nextWidth = clampSidebarWidth(width);
    setSidebarWidth(nextWidth);
    persistLayoutPreference(sidebarWidthStorageKey, nextWidth);
  }, []);

  const handleContentWidthChange = useCallback((width: number) => {
    const nextWidth = clampContentWidth(width);
    setContentWidth(nextWidth);
    persistLayoutPreference(contentWidthStorageKey, nextWidth);
  }, []);

  const handleLayoutModeChange = useCallback((mode: AppLayoutMode) => {
    if (mode === layoutMode) {
      return;
    }

    if (layoutTransitionTimerRef.current) {
      clearTimeout(layoutTransitionTimerRef.current);
    }

    setIsLayoutTransitioning(true);
    setLayoutMode(mode);
    persistLayoutPreference(layoutModeStorageKey, mode);
    layoutTransitionTimerRef.current = setTimeout(() => {
      setIsLayoutTransitioning(false);
      layoutTransitionTimerRef.current = null;
    }, 320);
  }, [layoutMode]);

  const layoutPreferences = useMemo<LayoutPreferences>(() => ({
    contentWidth,
    mode: layoutMode,
    onContentWidthChange: handleContentWidthChange,
    onModeChange: handleLayoutModeChange,
    onSidebarWidthChange: handleSidebarWidthChange,
    sidebarWidth,
  }), [
    contentWidth,
    handleContentWidthChange,
    handleLayoutModeChange,
    handleSidebarWidthChange,
    layoutMode,
    sidebarWidth,
  ]);

  const value = useMemo<AppLayoutContextValue>(() => ({
    isLayoutTransitioning,
    layoutPreferences,
    previewSidebarWidth,
  }), [isLayoutTransitioning, layoutPreferences, previewSidebarWidth]);

  return (
    <AppLayoutContext.Provider value={value}>
      {children}
    </AppLayoutContext.Provider>
  );
}

export function useAppLayout(): AppLayoutContextValue {
  const context = useContext(AppLayoutContext);
  if (!context) {
    throw new Error("useAppLayout must be used within AppLayoutProvider");
  }
  return context;
}
