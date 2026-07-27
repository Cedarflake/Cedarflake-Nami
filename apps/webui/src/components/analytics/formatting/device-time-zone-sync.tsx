"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  analyticsTimeZoneCookieMaxAge,
  analyticsTimeZoneCookieName,
} from "@/lib/analytics/time-zone-cookie"

import { getDeviceTimeZone } from "./device-time-zone"

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length)

  if (!value) {
    return null
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function isAnalyticsPath(pathname: string): boolean {
  return /\/analytics(?:\/|$)/.test(pathname)
}

export function DeviceTimeZoneSync() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const timeZone = getDeviceTimeZone()
    if (readCookie(analyticsTimeZoneCookieName) === timeZone) {
      return
    }

    document.cookie = [
      `${analyticsTimeZoneCookieName}=${encodeURIComponent(timeZone)}`,
      "Path=/",
      `Max-Age=${analyticsTimeZoneCookieMaxAge}`,
      "SameSite=Lax",
    ].join("; ")

    if (isAnalyticsPath(pathname)) {
      router.refresh()
    }
  }, [pathname, router])

  return null
}
