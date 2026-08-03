import type { RedirectsConfig } from "./types"
import {
  isConfigurableProxyHeaderName,
  proxyCookieModes,
  proxyOptionLimits,
  proxyRedirectModes,
  type ProxyHeaderDirection,
} from "./proxy-options"

export interface RedirectsConfigValidationIssue {
  message: string
  path: string
}

export type RedirectsConfigValidationResult =
  | {
      config: RedirectsConfig
      status: "valid"
    }
  | {
      issues: RedirectsConfigValidationIssue[]
      status: "invalid"
    }

const slotKeys = ["Slots", "slots", "SLOT"] as const
const destinationKeys = ["target", "to", "url"] as const
const routeConfigKeys = new Set([
  "analyticsId",
  "description",
  "proxyOptions",
  "proxyPolicy",
  "type",
  "target",
  "to",
  "url",
  "appendPath",
  "status",
  "priority",
])
const routeTypes = new Set(["prefix", "exact", "proxy"])
const proxyOptionKeys = new Set([
  "cookies",
  "maxRequestBodyMegabytes",
  "redirects",
  "requestHeaders",
  "responseHeaders",
  "timeoutSeconds",
])
const proxyRedirectKeys = new Set(["maxHops", "mode"])
const proxyCookieKeys = new Set(["mode"])
const proxyRedirectModeSet = new Set<string>(proxyRedirectModes)
const proxyCookieModeSet = new Set<string>(proxyCookieModes)
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const maximumSafeIntegerDigits = String(Number.MAX_SAFE_INTEGER)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1")
}

function addIssue(
  issues: RedirectsConfigValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message })
}

function isUriReference(value: string): boolean {
  if (!value || /[\u0000-\u0020\\]/u.test(value) || /%(?![0-9a-f]{2})/iu.test(value)) {
    return false
  }

  try {
    new URL(value, "https://redirect.invalid/")
    return true
  } catch {
    return false
  }
}

function isAbsoluteHttpUrlWithoutCredentials(value: string): boolean {
  if (!/^https?:\/\//iu.test(value)) {
    return false
  }
  try {
    const url = new URL(value)
    return (
      (url.protocol === "http:" || url.protocol === "https:")
      && !url.username
      && !url.password
    )
  } catch {
    return false
  }
}

function isSafeIntegerString(value: string): boolean {
  if (!/^-?[0-9]+$/u.test(value)) {
    return false
  }

  const unsigned = value.startsWith("-") ? value.slice(1) : value
  const normalized = unsigned.replace(/^0+(?=[0-9])/u, "")
  return normalized.length < maximumSafeIntegerDigits.length
    || (
      normalized.length === maximumSafeIntegerDigits.length
      && normalized <= maximumSafeIntegerDigits
    )
}

function validateProxyHeaderOverrides(
  value: unknown,
  path: string,
  direction: ProxyHeaderDirection,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object of header names and string or null values")
    return
  }

  const entries = Object.entries(value)
  if (entries.length > proxyOptionLimits.maximumHeaderCount) {
    addIssue(
      issues,
      path,
      `must contain at most ${proxyOptionLimits.maximumHeaderCount} headers`,
    )
  }

  const normalizedNames = new Map<string, string>()
  for (const [name, headerValue] of entries) {
    const headerPath = `${path}/${escapeJsonPointerSegment(name)}`
    if (!isConfigurableProxyHeaderName(name, direction)) {
      addIssue(issues, headerPath, `cannot configure the ${direction} header ${name}`)
    }

    const normalizedName = name.trim().toLowerCase()
    const firstName = normalizedNames.get(normalizedName)
    if (firstName) {
      addIssue(issues, headerPath, `duplicates header ${firstName} with different casing`)
    } else {
      normalizedNames.set(normalizedName, name)
    }

    if (headerValue === null) {
      continue
    }
    if (typeof headerValue !== "string") {
      addIssue(issues, headerPath, "must be a string or null")
      continue
    }
    if (headerValue.length > proxyOptionLimits.maximumHeaderValueLength) {
      addIssue(
        issues,
        headerPath,
        `must contain at most ${proxyOptionLimits.maximumHeaderValueLength} characters`,
      )
    }
    if (/[\u0000\r\n]/u.test(headerValue)) {
      addIssue(issues, headerPath, "must not contain null bytes or line breaks")
    }
  }
}

function validateProxyRedirectOptions(
  value: unknown,
  path: string,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }

  for (const key of Object.keys(value)) {
    if (!proxyRedirectKeys.has(key)) {
      addIssue(issues, `${path}/${escapeJsonPointerSegment(key)}`, "property is not allowed")
    }
  }

  if (
    value.mode !== undefined
    && (typeof value.mode !== "string" || !proxyRedirectModeSet.has(value.mode))
  ) {
    addIssue(issues, `${path}/mode`, "must be follow or passthrough")
  }

  if (
    value.maxHops !== undefined
    && (
      typeof value.maxHops !== "number"
      || !Number.isInteger(value.maxHops)
      || value.maxHops < 0
      || value.maxHops > proxyOptionLimits.maximumRedirectHops
    )
  ) {
    addIssue(
      issues,
      `${path}/maxHops`,
      `must be an integer from 0 to ${proxyOptionLimits.maximumRedirectHops}`,
    )
  }

  if (value.mode === "passthrough" && value.maxHops !== undefined) {
    addIssue(issues, `${path}/maxHops`, "is not used when redirects are passed through")
  }
}

function validateProxyCookieOptions(
  value: unknown,
  path: string,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }

  for (const key of Object.keys(value)) {
    if (!proxyCookieKeys.has(key)) {
      addIssue(issues, `${path}/${escapeJsonPointerSegment(key)}`, "property is not allowed")
    }
  }

  if (
    value.mode !== undefined
    && (typeof value.mode !== "string" || !proxyCookieModeSet.has(value.mode))
  ) {
    addIssue(issues, `${path}/mode`, "must be rewrite-domain, preserve, or strip")
  }
}

function validateProxyOptions(
  value: unknown,
  path: string,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }

  for (const key of Object.keys(value)) {
    if (!proxyOptionKeys.has(key)) {
      addIssue(issues, `${path}/${escapeJsonPointerSegment(key)}`, "property is not allowed")
    }
  }

  if (
    value.timeoutSeconds !== undefined
    && (
      typeof value.timeoutSeconds !== "number"
      || !Number.isInteger(value.timeoutSeconds)
      || value.timeoutSeconds < 1
      || value.timeoutSeconds > proxyOptionLimits.maximumTimeoutSeconds
    )
  ) {
    addIssue(
      issues,
      `${path}/timeoutSeconds`,
      `must be an integer from 1 to ${proxyOptionLimits.maximumTimeoutSeconds}`,
    )
  }

  if (
    value.maxRequestBodyMegabytes !== undefined
    && (
      typeof value.maxRequestBodyMegabytes !== "number"
      || !Number.isFinite(value.maxRequestBodyMegabytes)
      || value.maxRequestBodyMegabytes <= 0
      || value.maxRequestBodyMegabytes > proxyOptionLimits.maximumRequestBodyMegabytes
    )
  ) {
    addIssue(
      issues,
      `${path}/maxRequestBodyMegabytes`,
      `must be greater than 0 and at most ${proxyOptionLimits.maximumRequestBodyMegabytes}`,
    )
  }

  if (value.requestHeaders !== undefined) {
    validateProxyHeaderOverrides(value.requestHeaders, `${path}/requestHeaders`, "request", issues)
  }
  if (value.responseHeaders !== undefined) {
    validateProxyHeaderOverrides(value.responseHeaders, `${path}/responseHeaders`, "response", issues)
  }
  if (value.redirects !== undefined) {
    validateProxyRedirectOptions(value.redirects, `${path}/redirects`, issues)
  }
  if (value.cookies !== undefined) {
    validateProxyCookieOptions(value.cookies, `${path}/cookies`, issues)
  }
}

function validateRouteConfig(
  value: Record<string, unknown>,
  path: string,
  analyticsIdPaths: Map<string, string>,
  issues: RedirectsConfigValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!routeConfigKeys.has(key)) {
      addIssue(issues, `${path}/${escapeJsonPointerSegment(key)}`, "property is not allowed")
    }
  }

  const destinations = destinationKeys.filter((key) => value[key] !== undefined)
  if (destinations.length !== 1) {
    addIssue(issues, path, "must define exactly one of target, to, or url")
  }

  for (const key of destinations) {
    const destination = value[key]
    if (typeof destination !== "string" || !isUriReference(destination)) {
      addIssue(issues, `${path}/${key}`, "must be a non-empty URI reference")
    } else if (value.type === "proxy" && !isAbsoluteHttpUrlWithoutCredentials(destination)) {
      addIssue(
        issues,
        `${path}/${key}`,
        "must be an absolute HTTP(S) URL without credentials for proxy routes",
      )
    }
  }

  if (value.analyticsId !== undefined) {
    if (typeof value.analyticsId !== "string" || !uuidPattern.test(value.analyticsId)) {
      addIssue(issues, `${path}/analyticsId`, "must be a UUID")
    } else {
      const analyticsIdPath = `${path}/analyticsId`
      const normalizedAnalyticsId = value.analyticsId.toLowerCase()
      const firstPath = analyticsIdPaths.get(normalizedAnalyticsId)
      if (firstPath) {
        addIssue(issues, analyticsIdPath, `must be unique; first used at ${firstPath}`)
      } else {
        analyticsIdPaths.set(normalizedAnalyticsId, analyticsIdPath)
      }
    }
  }

  if (
    value.description !== undefined
    && (
      typeof value.description !== "string"
      || value.description.length > 500
    )
  ) {
    addIssue(issues, `${path}/description`, "must be a string with at most 500 characters")
  }

  if (value.proxyOptions !== undefined) {
    validateProxyOptions(value.proxyOptions, `${path}/proxyOptions`, issues)
  }

  if (value.type !== undefined && (typeof value.type !== "string" || !routeTypes.has(value.type))) {
    addIssue(issues, `${path}/type`, "must be prefix, exact, or proxy")
  }

  if (value.appendPath !== undefined && typeof value.appendPath !== "boolean") {
    addIssue(issues, `${path}/appendPath`, "must be a boolean")
  }

  if (value.status !== undefined) {
    const isValidStatus = (
      typeof value.status === "number"
      && Number.isInteger(value.status)
      && value.status >= 200
      && value.status <= 599
    ) || (
      typeof value.status === "string"
      && /^[2-5][0-9]{2}$/u.test(value.status)
    )
    if (!isValidStatus) {
      addIssue(issues, `${path}/status`, "must be an HTTP status from 200 to 599")
    }
  }

  if (value.priority !== undefined) {
    const isValidPriority = (
      typeof value.priority === "number"
      && Number.isSafeInteger(value.priority)
    ) || (
      typeof value.priority === "string"
      && isSafeIntegerString(value.priority)
    )
    if (!isValidPriority) {
      addIssue(issues, `${path}/priority`, "must be a safe integer")
    }
  }

  if (value.type === "proxy" && value.status !== undefined) {
    addIssue(issues, `${path}/status`, "is not allowed for proxy routes")
  }
  if (value.type !== "proxy" && value.proxyOptions !== undefined) {
    addIssue(issues, `${path}/proxyOptions`, "is only allowed for proxy routes")
  }
  if (value.type === "exact" && value.appendPath !== undefined) {
    addIssue(issues, `${path}/appendPath`, "is not allowed for exact routes")
  }
}

function validateRouteItem(
  value: unknown,
  path: string,
  analyticsIdPaths: Map<string, string>,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (typeof value === "string") {
    if (!value) {
      addIssue(issues, path, "must be a non-empty string")
    }
    return
  }

  if (isRecord(value)) {
    validateRouteConfig(value, path, analyticsIdPaths, issues)
    return
  }

  addIssue(issues, path, "must be a string or route object")
}

function validateRouteEntry(
  value: unknown,
  path: string,
  analyticsIdPaths: Map<string, string>,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      addIssue(issues, path, "must contain at least one route")
    }
    value.forEach((item, index) => {
      validateRouteItem(item, `${path}/${index}`, analyticsIdPaths, issues)
    })
    return
  }

  validateRouteItem(value, path, analyticsIdPaths, issues)
}

function validateSlotBranch(
  value: unknown,
  path: string,
  analyticsIdPaths: Map<string, string>,
  issues: RedirectsConfigValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${escapeJsonPointerSegment(key)}`
    if (key.startsWith("/")) {
      validateRouteEntry(child, childPath, analyticsIdPaths, issues)
    } else {
      validateSlotBranch(child, childPath, analyticsIdPaths, issues)
    }
  }
}

export function validateRedirectsConfig(value: unknown): RedirectsConfigValidationResult {
  if (!isRecord(value)) {
    return {
      status: "invalid",
      issues: [{ path: "(root)", message: "must be an object" }],
    }
  }

  const issues: RedirectsConfigValidationIssue[] = []
  const presentSlotKeys = slotKeys.filter((key) => value[key] !== undefined)
  if (presentSlotKeys.length !== 1) {
    addIssue(issues, "(root)", "must define exactly one of Slots, slots, or SLOT")
  }

  const analyticsIdPaths = new Map<string, string>()
  for (const slotKey of presentSlotKeys) {
    validateSlotBranch(value[slotKey], `/${slotKey}`, analyticsIdPaths, issues)
  }

  return issues.length > 0
    ? { status: "invalid", issues }
    : { status: "valid", config: value as RedirectsConfig }
}
