import type {
  ProxyCacheMode,
  ProxyCookieMode,
  ProxyCredentialMode,
  ProxyProfile,
  ProxyRedirectMode,
  ProxyResponseCookieAttributeMode,
  ProxyResponseCookiePathMode,
  ProxySecurityHeadersMode,
  ProxySourceHeaderMode,
} from "./types"

export const proxyProfiles = [
  "isolated",
  "asset",
  "trusted-api",
] as const satisfies readonly ProxyProfile[]

export const proxyCookieModes = [
  "strip",
  "allowlist",
] as const satisfies readonly ProxyCookieMode[]

export const proxyCredentialModes = [
  "strip",
  "preserve",
] as const satisfies readonly ProxyCredentialMode[]

export const proxySourceHeaderModes = [
  "strip",
  "preserve",
  "target",
] as const satisfies readonly ProxySourceHeaderMode[]

export const proxyResponseCookieAttributeModes = [
  "remove",
  "preserve",
] as const satisfies readonly ProxyResponseCookieAttributeMode[]

export const proxyResponseCookiePathModes = [
  "remove",
  "preserve",
  "proxy-base",
] as const satisfies readonly ProxyResponseCookiePathMode[]

export const proxySecurityHeadersModes = [
  "preserve",
] as const satisfies readonly ProxySecurityHeadersMode[]

export const proxyCacheModes = [
  "bypass",
  "public",
] as const satisfies readonly ProxyCacheMode[]

export const proxyRedirectModes = [
  "manual",
  "follow",
] as const satisfies readonly ProxyRedirectMode[]
