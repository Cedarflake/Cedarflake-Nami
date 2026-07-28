import { validateProxyPolicy } from "./proxy-policy-validation"
import type { RedirectsConfig } from "./types"

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
  "type",
  "target",
  "to",
  "url",
  "appendPath",
  "status",
  "priority",
  "proxyPolicy",
])
const routeTypes = new Set(["prefix", "exact", "proxy"])
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

  if (value.type !== undefined && (typeof value.type !== "string" || !routeTypes.has(value.type))) {
    addIssue(issues, `${path}/type`, "must be prefix, exact, or proxy")
  }

  if (value.proxyPolicy !== undefined) {
    if (value.type !== "proxy") {
      addIssue(issues, `${path}/proxyPolicy`, "is only allowed for proxy routes")
    } else {
      validateProxyPolicy(value.proxyPolicy, `${path}/proxyPolicy`, issues)
    }
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
