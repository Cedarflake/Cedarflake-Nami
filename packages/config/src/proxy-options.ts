export const proxyRedirectModes = ["follow", "passthrough"] as const
export type ProxyRedirectMode = (typeof proxyRedirectModes)[number]

export const proxyCookieModes = ["rewrite-domain", "preserve", "strip"] as const
export type ProxyCookieMode = (typeof proxyCookieModes)[number]

export type ProxyHeaderDirection = "request" | "response"

export interface ProxyHeaderOverrides {
  [name: string]: string | null
}

export interface ProxyRedirectOptions {
  mode?: ProxyRedirectMode
  maxHops?: number
}

export interface ProxyCookieOptions {
  mode?: ProxyCookieMode
}

export interface ProxyOptions {
  timeoutSeconds?: number
  maxRequestBodyMegabytes?: number
  requestHeaders?: ProxyHeaderOverrides
  responseHeaders?: ProxyHeaderOverrides
  redirects?: ProxyRedirectOptions
  cookies?: ProxyCookieOptions
}

export const defaultProxyOptions = {
  redirects: {
    mode: "follow",
    maxHops: 5,
  },
  cookies: {
    mode: "rewrite-domain",
  },
} as const

export const proxyOptionLimits = {
  maximumHeaderCount: 32,
  maximumHeaderValueLength: 8_192,
  maximumRedirectHops: 10,
  maximumRequestBodyMegabytes: 100,
  maximumTimeoutSeconds: 120,
} as const

const proxyHeaderNamePattern = /^[!#$%&'*+.^_`|~0-9a-z-]+$/i
const forbiddenProxyHeaders = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])
const forbiddenRequestHeaders = new Set([
  "host",
  "x-forwarded-host",
  "x-forwarded-proto",
])
const forbiddenResponseHeaders = new Set(["set-cookie"])

export function isConfigurableProxyHeaderName(
  name: string,
  direction: ProxyHeaderDirection,
): boolean {
  const normalizedName = name.trim().toLowerCase()
  if (
    name !== name.trim()
    || !proxyHeaderNamePattern.test(normalizedName)
    || forbiddenProxyHeaders.has(normalizedName)
  ) {
    return false
  }

  return direction === "request"
    ? !forbiddenRequestHeaders.has(normalizedName)
    : !forbiddenResponseHeaders.has(normalizedName)
}
