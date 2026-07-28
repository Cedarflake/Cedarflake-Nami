/**
 * @file headers.ts
 * @description
 * [EN] Proxy header and cookie policy.
 * Builds sanitized upstream request headers and applies response cookie, security-header, and
 * cache decisions without folding multiple Set-Cookie fields.
 *
 * [CN] 反向代理请求头与 Cookie 策略。
 * 构建净化后的上游请求头，并在不折叠多个 Set-Cookie 字段的前提下应用响应 Cookie、
 * 安全响应头与缓存决策。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { HSTS_HEADER_VALUE } from "../../core/constants";

import type { ResolvedProxyPolicy } from "./policy";

const SENSITIVE_FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "client-ip",
  "fastly-client-ip",
  "fly-client-ip",
  "forwarded",
  "forwarded-for",
  "proxy-authorization",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-envoy-external-address",
  "x-real-ip"
] as const;
const SENSITIVE_FORWARD_HEADER_PREFIXES = [
  "cf-",
  "x-forwarded-",
  "x-nf-",
  "x-vercel-"
] as const;
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
] as const;
const REQUEST_BODY_HEADERS = [
  "content-encoding",
  "content-language",
  "content-length",
  "content-location",
  "content-type"
] as const;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/i;

interface ExtendedHeaders {
  getAll?(name: string): string[];
  getSetCookie?(): string[];
}

interface BuildProxyRequestHeadersOptions {
  request: Request;
  originalUrl: URL;
  currentTarget: URL;
  initialTarget: URL;
  policy: ResolvedProxyPolicy;
  shouldDropBodyHeaders: boolean;
}

interface ApplyProxyResponseHeadersOptions {
  sourceHeaders: Headers;
  policy: ResolvedProxyPolicy;
  basePath: string;
  requestMethod: string;
  responseStatus: number;
  upstreamStatus: number;
  upstreamLocation: string | null;
  redirectsFollowed: number;
}

function filterCookieHeader(
  value: string | null,
  allowedNames: readonly string[]
): string | null {
  if (!value || allowedNames.length === 0) {
    return null;
  }
  const allowed = new Set(allowedNames);
  const cookies = value
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const separator = cookie.indexOf("=");
      const name = separator >= 0 ? cookie.slice(0, separator).trim() : cookie;
      return allowed.has(name);
    });
  return cookies.length > 0 ? cookies.join("; ") : null;
}

function applySourceHeader(
  headers: Headers,
  name: "origin" | "referer",
  mode: "strip" | "preserve" | "target",
  originalValue: string | null,
  currentTarget: URL
): void {
  headers.delete(name);
  if (mode === "preserve" && originalValue) {
    headers.set(name, originalValue);
  } else if (mode === "target") {
    headers.set(
      name,
      name === "origin" ? currentTarget.origin : currentTarget.toString()
    );
  }
}

export function buildProxyRequestHeaders({
  request,
  originalUrl,
  currentTarget,
  initialTarget,
  policy,
  shouldDropBodyHeaders
}: BuildProxyRequestHeadersOptions): Headers {
  const headers = new Headers(request.headers);
  const originalAuthorization = headers.get("authorization");
  const originalCookie = headers.get("cookie");
  const originalOrigin = headers.get("origin");
  const originalReferer = headers.get("referer") ?? headers.get("referrer");
  const connectionHeaders = headers.get("connection")
    ?.split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => HEADER_NAME_PATTERN.test(name)) ?? [];

  headers.delete("host");
  for (const name of SENSITIVE_FORWARD_HEADERS) {
    headers.delete(name);
  }
  for (const name of HOP_BY_HOP_HEADERS) {
    headers.delete(name);
  }
  for (const name of connectionHeaders) {
    headers.delete(name);
  }
  for (const name of [...headers.keys()]) {
    if (SENSITIVE_FORWARD_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      headers.delete(name);
    }
  }
  if (shouldDropBodyHeaders) {
    for (const name of REQUEST_BODY_HEADERS) {
      headers.delete(name);
    }
  }

  const canForwardCredentials = currentTarget.origin === initialTarget.origin;
  if (
    canForwardCredentials
    && policy.request.authorization === "preserve"
    && originalAuthorization
  ) {
    headers.set("authorization", originalAuthorization);
  }
  if (canForwardCredentials && policy.request.cookies.mode === "allowlist") {
    const cookie = filterCookieHeader(
      originalCookie,
      policy.request.cookies.names
    );
    if (cookie) {
      headers.set("cookie", cookie);
    }
  }

  applySourceHeader(
    headers,
    "origin",
    policy.request.origin,
    originalOrigin,
    currentTarget
  );
  applySourceHeader(
    headers,
    "referer",
    policy.request.referer,
    originalReferer,
    currentTarget
  );

  headers.set("x-forwarded-host", originalUrl.host);
  headers.set("x-forwarded-proto", originalUrl.protocol.slice(0, -1));
  return headers;
}

export function getSetCookieValues(headers: Headers): readonly string[] {
  const extended = headers as unknown as ExtendedHeaders;
  if (typeof extended.getSetCookie === "function") {
    return extended.getSetCookie();
  }
  if (typeof extended.getAll === "function") {
    return extended.getAll("Set-Cookie");
  }
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function getSetCookieName(value: string): string {
  const separator = value.indexOf("=");
  return separator >= 0 ? value.slice(0, separator).trim() : value.trim();
}

function rewriteCookieAttribute(
  value: string,
  attribute: "domain" | "path",
  replacement: string | null
): string {
  const pattern = new RegExp(`;\\s*${attribute}=[^;]*`, "ig");
  const stripped = value.replace(pattern, "");
  return replacement === null
    ? stripped
    : `${stripped}; ${attribute[0].toUpperCase()}${attribute.slice(1)}=${replacement}`;
}

function normalizeProxyBasePath(basePath: string): string {
  if (!basePath || basePath === "/") {
    return "/";
  }
  const normalized = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return normalized.replace(
    /[\u0000-\u0020;\u007f]/gu,
    (character) => encodeURIComponent(character)
  );
}

function applyResponseCookies(
  responseHeaders: Headers,
  sourceHeaders: Headers,
  policy: ResolvedProxyPolicy,
  basePath: string
): void {
  const sourceCookies = getSetCookieValues(sourceHeaders);
  responseHeaders.delete("set-cookie");
  if (policy.response.cookies.mode === "strip") {
    return;
  }

  const allowedNames = new Set(policy.response.cookies.names);
  for (const sourceCookie of sourceCookies) {
    if (
      allowedNames.size > 0
      && !allowedNames.has(getSetCookieName(sourceCookie))
    ) {
      continue;
    }

    let cookie = sourceCookie;
    if (policy.response.cookies.domain === "remove") {
      cookie = rewriteCookieAttribute(cookie, "domain", null);
    }
    if (policy.response.cookies.path === "remove") {
      cookie = rewriteCookieAttribute(cookie, "path", null);
    } else if (policy.response.cookies.path === "proxy-base") {
      cookie = rewriteCookieAttribute(
        cookie,
        "path",
        normalizeProxyBasePath(basePath)
      );
    }
    responseHeaders.append("set-cookie", cookie);
  }
}

function applyCachePolicy(
  responseHeaders: Headers,
  policy: ResolvedProxyPolicy,
  requestMethod: string,
  responseStatus: number
): void {
  if (policy.cache.mode === "upstream") {
    return;
  }
  if (policy.cache.mode === "bypass") {
    responseHeaders.set("cache-control", "private, no-store");
    return;
  }

  const forwardsCredentials = (
    policy.request.authorization === "preserve"
    || policy.request.cookies.mode === "allowlist"
  );
  const upstreamCacheControl = responseHeaders.get("cache-control") ?? "";
  const hasPrivateDirective = /(?:^|,)\s*(?:no-store|private)(?=\s*(?:=|,|$))/i.test(
    upstreamCacheControl
  );
  if (
    forwardsCredentials
    || (requestMethod !== "GET" && requestMethod !== "HEAD")
    || responseStatus < 200
    || responseStatus >= 300
    || responseHeaders.has("set-cookie")
    || hasPrivateDirective
  ) {
    responseHeaders.set("cache-control", "private, no-store");
    return;
  }

  responseHeaders.set(
    "cache-control",
    `public, max-age=${policy.cache.browserTtlSeconds}, s-maxage=${policy.cache.edgeTtlSeconds}`
  );
}

export function applyProxyResponseHeaders({
  sourceHeaders,
  policy,
  basePath,
  requestMethod,
  responseStatus,
  upstreamStatus,
  upstreamLocation,
  redirectsFollowed
}: ApplyProxyResponseHeadersOptions): Headers {
  const responseHeaders = new Headers(sourceHeaders);
  const connectionHeaders = responseHeaders.get("connection")
    ?.split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => HEADER_NAME_PATTERN.test(name)) ?? [];
  for (const name of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(name);
  }
  for (const name of connectionHeaders) {
    responseHeaders.delete(name);
  }

  if (policy.exposeDebugHeaders) {
    responseHeaders.set("x-upstream-status", String(upstreamStatus));
    responseHeaders.set("x-upstream-location", upstreamLocation ?? "");
    responseHeaders.set(
      "x-proxy-redirects-followed",
      String(redirectsFollowed)
    );
  } else {
    responseHeaders.delete("x-upstream-status");
    responseHeaders.delete("x-upstream-location");
    responseHeaders.delete("x-proxy-redirects-followed");
  }

  if (policy.response.securityHeaders === "strip") {
    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("content-security-policy-report-only");
    responseHeaders.delete("x-frame-options");
  }
  responseHeaders.set("strict-transport-security", HSTS_HEADER_VALUE);

  applyResponseCookies(responseHeaders, sourceHeaders, policy, basePath);
  applyCachePolicy(responseHeaders, policy, requestMethod, responseStatus);
  return responseHeaders;
}
