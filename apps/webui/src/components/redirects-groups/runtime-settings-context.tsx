"use client";

import { defaultDataConfig } from "@nami/config";
import { createContext, useContext, type ReactNode } from "react";

interface RuntimeSettingsContextValue {
  canonicalOrigin: string;
}

const RuntimeSettingsContext = createContext<RuntimeSettingsContextValue>({
  canonicalOrigin: defaultDataConfig.runtime.canonicalOrigin,
});

export function RuntimeSettingsProvider({
  canonicalOrigin,
  children,
}: RuntimeSettingsContextValue & { children: ReactNode }) {
  const resolvedCanonicalOrigin = canonicalOrigin
    || defaultDataConfig.runtime.canonicalOrigin;

  return (
    <RuntimeSettingsContext.Provider value={{ canonicalOrigin: resolvedCanonicalOrigin }}>
      {children}
    </RuntimeSettingsContext.Provider>
  );
}

export function useRuntimeSettings(): RuntimeSettingsContextValue {
  return useContext(RuntimeSettingsContext);
}
