import "server-only"

import { cookies } from "next/headers"

import { normalizeAnalyticsTimeZone } from "@i0c/analytics-domain/range"

import { analyticsTimeZoneCookieName } from "./time-zone-cookie"

export async function getRequestAnalyticsTimeZone(): Promise<string> {
  const cookieStore = await cookies()
  return normalizeAnalyticsTimeZone(
    cookieStore.get(analyticsTimeZoneCookieName)?.value,
  )
}
