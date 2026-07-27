"use client"

import { useSyncExternalStore } from "react"

const serverTimeZone = "UTC"

function subscribeToTimeZone() {
  return () => undefined
}

export function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || serverTimeZone
}

export function useDeviceTimeZone() {
  return useSyncExternalStore(
    subscribeToTimeZone,
    getDeviceTimeZone,
    () => serverTimeZone,
  )
}
