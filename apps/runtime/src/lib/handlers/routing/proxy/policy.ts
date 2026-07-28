/**
 * @file policy.ts
 * @description
 * [EN] Proxy policy resolution.
 * Resolves explicit proxy profiles into immutable runtime decisions while preserving a dedicated
 * compatibility policy for legacy rules that do not declare proxyPolicy.
 *
 * [CN] 反向代理策略解析。
 * 将显式代理预设解析为不可变的运行时决策，同时为未声明 proxyPolicy 的旧规则保留独立兼容策略。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import type {
  ProxyCacheMode,
  ProxyCookieMode,
  ProxyCredentialMode,
  ProxyPolicy,
  ProxyProfile,
  ProxyRedirectMode,
  ProxyResponseCookieAttributeMode,
  ProxyResponseCookiePathMode,
  ProxySecurityHeadersMode,
  ProxySourceHeaderMode
} from "@i0c/config";

interface ResolvedProxyCookiePolicy {
  mode: ProxyCookieMode;
  names: readonly string[];
}

interface ResolvedProxyRequestPolicy {
  methods: readonly string[] | null;
  cookies: ResolvedProxyCookiePolicy;
  authorization: ProxyCredentialMode;
  origin: ProxySourceHeaderMode;
  referer: ProxySourceHeaderMode;
  clientIp: "strip";
}

interface ResolvedProxyResponseCookiePolicy extends ResolvedProxyCookiePolicy {
  domain: ProxyResponseCookieAttributeMode;
  path: ProxyResponseCookiePathMode;
}

interface ResolvedProxyResponsePolicy {
  cookies: ResolvedProxyResponseCookiePolicy;
  securityHeaders: ProxySecurityHeadersMode | "strip";
}

interface ResolvedProxyCachePolicy {
  mode: ProxyCacheMode | "upstream";
  edgeTtlSeconds: number;
  browserTtlSeconds: number;
}

interface ResolvedProxyRedirectPolicy {
  mode: ProxyRedirectMode;
  maxHops: number;
  allowedOrigins: readonly string[] | null;
}

interface ResolvedProxyLimitPolicy {
  timeoutMs: number | null;
  maxRequestBodyBytes: number | null;
}

export interface ResolvedProxyPolicy {
  profile: ProxyProfile | "legacy";
  isLegacy: boolean;
  request: ResolvedProxyRequestPolicy;
  response: ResolvedProxyResponsePolicy;
  cache: ResolvedProxyCachePolicy;
  redirects: ResolvedProxyRedirectPolicy;
  limits: ResolvedProxyLimitPolicy;
  exposeDebugHeaders: boolean;
  rewriteHtml: boolean;
}

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"] as const;
const API_METHODS = [
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
] as const;

const profileDefaults: Record<ProxyProfile, ResolvedProxyPolicy> = {
  isolated: {
    profile: "isolated",
    isLegacy: false,
    request: {
      methods: SAFE_METHODS,
      cookies: { mode: "strip", names: [] },
      authorization: "strip",
      origin: "strip",
      referer: "strip",
      clientIp: "strip"
    },
    response: {
      cookies: {
        mode: "strip",
        names: [],
        domain: "remove",
        path: "proxy-base"
      },
      securityHeaders: "preserve"
    },
    cache: {
      mode: "bypass",
      edgeTtlSeconds: 0,
      browserTtlSeconds: 0
    },
    redirects: {
      mode: "follow",
      maxHops: 5,
      allowedOrigins: []
    },
    limits: {
      timeoutMs: 10_000,
      maxRequestBodyBytes: 1_048_576
    },
    exposeDebugHeaders: false,
    rewriteHtml: false
  },
  asset: {
    profile: "asset",
    isLegacy: false,
    request: {
      methods: SAFE_METHODS,
      cookies: { mode: "strip", names: [] },
      authorization: "strip",
      origin: "strip",
      referer: "strip",
      clientIp: "strip"
    },
    response: {
      cookies: {
        mode: "strip",
        names: [],
        domain: "remove",
        path: "remove"
      },
      securityHeaders: "preserve"
    },
    cache: {
      mode: "public",
      edgeTtlSeconds: 86_400,
      browserTtlSeconds: 3_600
    },
    redirects: {
      mode: "follow",
      maxHops: 5,
      allowedOrigins: []
    },
    limits: {
      timeoutMs: 10_000,
      maxRequestBodyBytes: 0
    },
    exposeDebugHeaders: false,
    rewriteHtml: false
  },
  "trusted-api": {
    profile: "trusted-api",
    isLegacy: false,
    request: {
      methods: API_METHODS,
      cookies: { mode: "strip", names: [] },
      authorization: "strip",
      origin: "preserve",
      referer: "strip",
      clientIp: "strip"
    },
    response: {
      cookies: {
        mode: "strip",
        names: [],
        domain: "remove",
        path: "proxy-base"
      },
      securityHeaders: "preserve"
    },
    cache: {
      mode: "bypass",
      edgeTtlSeconds: 0,
      browserTtlSeconds: 0
    },
    redirects: {
      mode: "follow",
      maxHops: 5,
      allowedOrigins: []
    },
    limits: {
      timeoutMs: 10_000,
      maxRequestBodyBytes: 1_048_576
    },
    exposeDebugHeaders: false,
    rewriteHtml: false
  }
};

const legacyPolicy: ResolvedProxyPolicy = {
  profile: "legacy",
  isLegacy: true,
  request: {
    methods: null,
    cookies: { mode: "strip", names: [] },
    authorization: "strip",
    origin: "target",
    referer: "target",
    clientIp: "strip"
  },
  response: {
    cookies: {
      mode: "allowlist",
      names: [],
      domain: "remove",
      path: "preserve"
    },
    securityHeaders: "strip"
  },
  cache: {
    mode: "upstream",
    edgeTtlSeconds: 0,
    browserTtlSeconds: 0
  },
  redirects: {
    mode: "follow",
    maxHops: 5,
    allowedOrigins: null
  },
  limits: {
    timeoutMs: null,
    maxRequestBodyBytes: null
  },
  exposeDebugHeaders: true,
  rewriteHtml: true
};

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function normalizeOrigins(values: readonly string[]): readonly string[] {
  return unique(values.map((value) => new URL(value).origin));
}

export function resolveProxyPolicy(policy: ProxyPolicy | undefined): ResolvedProxyPolicy {
  if (!policy) {
    return legacyPolicy;
  }

  const defaults = profileDefaults[policy.profile];
  const requestCookies = policy.request?.cookies;
  const responseCookies = policy.response?.cookies;

  return {
    ...defaults,
    request: {
      ...defaults.request,
      ...policy.request,
      methods: policy.request?.methods
        ? unique(policy.request.methods.map((method) => method.toUpperCase()))
        : defaults.request.methods,
      cookies: requestCookies
        ? {
            mode: requestCookies.mode,
            names: unique(requestCookies.names ?? [])
          }
        : defaults.request.cookies
    },
    response: {
      ...defaults.response,
      ...policy.response,
      cookies: responseCookies
        ? {
            ...defaults.response.cookies,
            ...responseCookies,
            names: unique(responseCookies.names ?? [])
          }
        : defaults.response.cookies
    },
    cache: {
      ...defaults.cache,
      ...policy.cache
    },
    redirects: {
      ...defaults.redirects,
      ...policy.redirects,
      allowedOrigins: policy.redirects?.allowedOrigins
        ? normalizeOrigins(policy.redirects.allowedOrigins)
        : defaults.redirects.allowedOrigins
    },
    limits: {
      ...defaults.limits,
      ...policy.limits
    }
  };
}
