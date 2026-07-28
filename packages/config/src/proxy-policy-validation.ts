import {
  proxyCacheModes,
  proxyCookieModes,
  proxyCredentialModes,
  proxyProfiles,
  proxyRedirectModes,
  proxyResponseCookieAttributeModes,
  proxyResponseCookiePathModes,
  proxySecurityHeadersModes,
  proxySourceHeaderModes,
} from "./proxy-policy"

interface ValidationIssue {
  message: string
  path: string
}

const proxyPolicyKeys = new Set([
  "profile",
  "request",
  "response",
  "cache",
  "redirects",
  "limits",
])
const proxyRequestKeys = new Set([
  "methods",
  "cookies",
  "authorization",
  "origin",
  "referer",
  "clientIp",
])
const proxyResponseKeys = new Set(["cookies", "securityHeaders"])
const proxyCookieKeys = new Set(["mode", "names"])
const proxyResponseCookieKeys = new Set([
  "mode",
  "names",
  "domain",
  "path",
])
const proxyCacheKeys = new Set([
  "mode",
  "edgeTtlSeconds",
  "browserTtlSeconds",
])
const proxyRedirectKeys = new Set([
  "mode",
  "maxHops",
  "allowedOrigins",
])
const proxyLimitKeys = new Set(["timeoutMs", "maxRequestBodyBytes"])
const httpTokenPattern = /^[!#$%&'*+.^_`|~0-9a-z-]+$/i
const forbiddenFetchMethods = new Set(["CONNECT", "TRACE", "TRACK"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1")
}

function addIssue(
  issues: ValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message })
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      addIssue(issues, `${path}/${escapeJsonPointerSegment(key)}`, "property is not allowed")
    }
  }
}

function validateEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  path: string,
  issues: ValidationIssue[],
): value is string {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    addIssue(issues, path, `must be one of ${allowedValues.join(", ")}`)
    return false
  }
  return true
}

function validateBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
  issues: ValidationIssue[],
): void {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    addIssue(issues, path, `must be an integer from ${minimum} to ${maximum}`)
  }
}

function validateUniqueStringArray(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  itemValidator: (item: string) => boolean,
  itemMessage: string,
): value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, path, "must be a non-empty array")
    return false
  }

  const seen = new Set<string>()
  value.forEach((item, index) => {
    const itemPath = `${path}/${index}`
    if (typeof item !== "string" || !itemValidator(item)) {
      addIssue(issues, itemPath, itemMessage)
      return
    }
    if (seen.has(item)) {
      addIssue(issues, itemPath, "must be unique")
      return
    }
    seen.add(item)
  })
  return true
}

function isAbsoluteHttpOrigin(value: string): boolean {
  if (!/^https?:\/\//iu.test(value)) {
    return false
  }

  try {
    const url = new URL(value)
    return (
      (url.protocol === "http:" || url.protocol === "https:")
      && !url.username
      && !url.password
      && url.pathname === "/"
      && !url.search
      && !url.hash
    )
  } catch {
    return false
  }
}

function validateProxyCookiePolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  isResponse: boolean,
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(
    value,
    isResponse ? proxyResponseCookieKeys : proxyCookieKeys,
    path,
    issues,
  )

  const modeIsValid = validateEnumValue(
    value.mode,
    proxyCookieModes,
    `${path}/mode`,
    issues,
  )
  if (value.names !== undefined) {
    validateUniqueStringArray(
      value.names,
      `${path}/names`,
      issues,
      (item) => httpTokenPattern.test(item),
      "must be a valid cookie name",
    )
  }
  if (modeIsValid && value.mode === "allowlist" && value.names === undefined) {
    addIssue(issues, `${path}/names`, "is required when mode is allowlist")
  }
  if (modeIsValid && value.mode === "strip" && value.names !== undefined) {
    addIssue(issues, `${path}/names`, "is not allowed when mode is strip")
  }
  if (
    isResponse
    && modeIsValid
    && value.mode === "strip"
    && (value.domain !== undefined || value.path !== undefined)
  ) {
    addIssue(
      issues,
      path,
      "domain and path are not allowed when response cookies are stripped",
    )
  }

  if (!isResponse) {
    return
  }
  if (value.domain !== undefined) {
    validateEnumValue(
      value.domain,
      proxyResponseCookieAttributeModes,
      `${path}/domain`,
      issues,
    )
  }
  if (value.path !== undefined) {
    validateEnumValue(
      value.path,
      proxyResponseCookiePathModes,
      `${path}/path`,
      issues,
    )
  }
}

function validateProxyRequestPolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(value, proxyRequestKeys, path, issues)

  if (value.methods !== undefined) {
    validateUniqueStringArray(
      value.methods,
      `${path}/methods`,
      issues,
      (item) => (
        httpTokenPattern.test(item)
        && item === item.toUpperCase()
        && !forbiddenFetchMethods.has(item)
      ),
      "must be an uppercase Fetch-compatible HTTP method token",
    )
  }
  if (value.cookies !== undefined) {
    validateProxyCookiePolicy(value.cookies, `${path}/cookies`, issues, false)
  }
  if (value.authorization !== undefined) {
    validateEnumValue(
      value.authorization,
      proxyCredentialModes,
      `${path}/authorization`,
      issues,
    )
  }
  if (value.origin !== undefined) {
    validateEnumValue(
      value.origin,
      proxySourceHeaderModes,
      `${path}/origin`,
      issues,
    )
  }
  if (value.referer !== undefined) {
    validateEnumValue(
      value.referer,
      proxySourceHeaderModes,
      `${path}/referer`,
      issues,
    )
  }
  if (value.clientIp !== undefined && value.clientIp !== "strip") {
    addIssue(issues, `${path}/clientIp`, "must be strip")
  }
}

function validateProxyResponsePolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(value, proxyResponseKeys, path, issues)

  if (value.cookies !== undefined) {
    validateProxyCookiePolicy(value.cookies, `${path}/cookies`, issues, true)
  }
  if (value.securityHeaders !== undefined) {
    validateEnumValue(
      value.securityHeaders,
      proxySecurityHeadersModes,
      `${path}/securityHeaders`,
      issues,
    )
  }
}

function validateProxyCachePolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(value, proxyCacheKeys, path, issues)

  const modeIsValid = validateEnumValue(
    value.mode,
    proxyCacheModes,
    `${path}/mode`,
    issues,
  )
  for (const key of ["edgeTtlSeconds", "browserTtlSeconds"] as const) {
    if (value[key] !== undefined) {
      validateBoundedInteger(
        value[key],
        0,
        31_536_000,
        `${path}/${key}`,
        issues,
      )
    }
  }
  if (
    modeIsValid
    && value.mode === "bypass"
    && (value.edgeTtlSeconds !== undefined || value.browserTtlSeconds !== undefined)
  ) {
    addIssue(issues, path, "cache TTLs are not allowed when mode is bypass")
  }
}

function validateProxyRedirectPolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(value, proxyRedirectKeys, path, issues)

  const modeIsValid = validateEnumValue(
    value.mode,
    proxyRedirectModes,
    `${path}/mode`,
    issues,
  )
  if (value.maxHops !== undefined) {
    validateBoundedInteger(value.maxHops, 0, 10, `${path}/maxHops`, issues)
  }
  if (value.allowedOrigins !== undefined) {
    validateUniqueStringArray(
      value.allowedOrigins,
      `${path}/allowedOrigins`,
      issues,
      isAbsoluteHttpOrigin,
      "must be an absolute HTTP(S) origin without credentials, path, query, or fragment",
    )
  }
  if (
    modeIsValid
    && value.mode === "manual"
    && (value.maxHops !== undefined || value.allowedOrigins !== undefined)
  ) {
    addIssue(
      issues,
      path,
      "maxHops and allowedOrigins are not allowed when mode is manual",
    )
  }
}

function validateProxyLimitPolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(value, proxyLimitKeys, path, issues)

  if (value.timeoutMs !== undefined) {
    validateBoundedInteger(value.timeoutMs, 100, 60_000, `${path}/timeoutMs`, issues)
  }
  if (value.maxRequestBodyBytes !== undefined) {
    validateBoundedInteger(
      value.maxRequestBodyBytes,
      0,
      10_485_760,
      `${path}/maxRequestBodyBytes`,
      issues,
    )
  }
}

export function validateProxyPolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object")
    return
  }
  validateAllowedKeys(value, proxyPolicyKeys, path, issues)
  validateEnumValue(value.profile, proxyProfiles, `${path}/profile`, issues)

  if (value.request !== undefined) {
    validateProxyRequestPolicy(value.request, `${path}/request`, issues)
  }
  if (value.response !== undefined) {
    validateProxyResponsePolicy(value.response, `${path}/response`, issues)
  }
  if (value.cache !== undefined) {
    validateProxyCachePolicy(value.cache, `${path}/cache`, issues)
  }
  if (value.redirects !== undefined) {
    validateProxyRedirectPolicy(value.redirects, `${path}/redirects`, issues)
  }
  if (value.limits !== undefined) {
    validateProxyLimitPolicy(value.limits, `${path}/limits`, issues)
  }

  const request = isRecord(value.request) ? value.request : null
  const requestCookies = request && isRecord(request.cookies)
    ? request.cookies
    : null
  const cache = isRecord(value.cache) ? value.cache : null
  if (
    cache?.mode === "public"
    && (
      request?.authorization === "preserve"
      || requestCookies?.mode === "allowlist"
    )
  ) {
    addIssue(
      issues,
      `${path}/cache/mode`,
      "public cache requires request cookies and authorization to remain stripped",
    )
  }
}
