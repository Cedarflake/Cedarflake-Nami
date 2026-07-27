'use client';

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import type { SessionProviderProps } from "next-auth/react";

import { DeviceTimeZoneSync } from "@/components/analytics/formatting/device-time-zone-sync";
import { AppLayoutProvider } from "@/components/ui/layout/app-layout-provider";
import { NavigationProgress } from "@/components/ui/feedback/navigation-progress";

type ProvidersProps = {
  children: React.ReactNode;
  session?: SessionProviderProps["session"];
};

export function Providers({ children, session }: ProvidersProps) {
  return (
    <AppLayoutProvider>
      <DeviceTimeZoneSync />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <SessionProvider session={session}>{children}</SessionProvider>
    </AppLayoutProvider>
  );
}
