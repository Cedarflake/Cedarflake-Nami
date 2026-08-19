/**
 * @file proxy-options.ts
 * @description
 * [EN] Runtime proxy option normalization and enforcement helpers.
 * Resolves shared defaults, applies safe header overrides, combines abort signals, and enforces
 * the optional request-body limit without coupling routing code to editor representations.
 *
 * [CN] Runtime 代理选项规范化与执行辅助模块。
 * 负责解析共享默认值、应用安全的请求头覆盖、合并中止信号，并执行可选请求体限制，
 * 避免路由代码与编辑器表示形式耦合。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import {
  defaultProxyOptions,
  isConfigurableProxyHeaderName,
  proxyOptionLimits,
  type ProxyCookieMode,
  type ProxyHeaderDirection,
  type ProxyHeaderOverrides,
  type ProxyOptions,
  type ProxyRedirectMode
} from "@nami/config";

export interface ResolvedProxyOptions {
  cookieMode: ProxyCookieMode;
  maxRedirectHops: number;
  maxRequestBodyBytes?: number;
  redirectMode: ProxyRedirectMode;
  requestHeaders: ProxyHeaderOverrides;
  responseHeaders: ProxyHeaderOverrides;
  timeoutMilliseconds?: number;
}

export interface ProxyAbortContext {
  cleanup(): void;
  didTimeout(): boolean;
  signal: AbortSignal;
  timeoutPromise?: Promise<never>;
}

export class ProxyRequestBodyTooLargeError extends Error {
  constructor() {
    super("Proxy request body exceeds the configured limit");
    this.name = "ProxyRequestBodyTooLargeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveHeaderOverrides(
  value: unknown,
  direction: ProxyHeaderDirection
): ProxyHeaderOverrides {
  if (!isRecord(value)) {
    return {};
  }

  const overrides: ProxyHeaderOverrides = {};
  const normalizedNames = new Set<string>();
  for (const [name, headerValue] of Object.entries(value)) {
    const normalizedName = name.trim().toLowerCase();
    if (
      isConfigurableProxyHeaderName(name, direction)
      && (typeof headerValue === "string" || headerValue === null)
      && (
        headerValue === null
        || (
          headerValue.length <= proxyOptionLimits.maximumHeaderValueLength
          && !/[\u0000\r\n]/u.test(headerValue)
        )
      )
      && !normalizedNames.has(normalizedName)
    ) {
      overrides[name] = headerValue;
      normalizedNames.add(normalizedName);
    }
  }
  return overrides;
}

export function resolveProxyOptions(value: ProxyOptions | undefined): ResolvedProxyOptions {
  const timeoutSeconds = typeof value?.timeoutSeconds === "number"
    && Number.isInteger(value.timeoutSeconds)
    && value.timeoutSeconds >= 1
    && value.timeoutSeconds <= proxyOptionLimits.maximumTimeoutSeconds
    ? value.timeoutSeconds
    : undefined;
  const maxRequestBodyMegabytes = typeof value?.maxRequestBodyMegabytes === "number"
    && Number.isFinite(value.maxRequestBodyMegabytes)
    && value.maxRequestBodyMegabytes > 0
    && value.maxRequestBodyMegabytes <= proxyOptionLimits.maximumRequestBodyMegabytes
    ? value.maxRequestBodyMegabytes
    : undefined;
  const redirectMode = value?.redirects?.mode === "passthrough"
    ? "passthrough"
    : defaultProxyOptions.redirects.mode;
  const maxRedirectHops = Number.isInteger(value?.redirects?.maxHops)
    && typeof value?.redirects?.maxHops === "number"
    && value.redirects.maxHops >= 0
    && value.redirects.maxHops <= proxyOptionLimits.maximumRedirectHops
    ? value.redirects.maxHops
    : defaultProxyOptions.redirects.maxHops;
  const cookieMode = value?.cookies?.mode === "preserve" || value?.cookies?.mode === "strip"
    ? value.cookies.mode
    : defaultProxyOptions.cookies.mode;

  return {
    cookieMode,
    maxRedirectHops,
    maxRequestBodyBytes: maxRequestBodyMegabytes === undefined
      ? undefined
      : Math.floor(maxRequestBodyMegabytes * 1024 * 1024),
    redirectMode,
    requestHeaders: resolveHeaderOverrides(value?.requestHeaders, "request"),
    responseHeaders: resolveHeaderOverrides(value?.responseHeaders, "response"),
    timeoutMilliseconds: timeoutSeconds === undefined
      ? undefined
      : Math.floor(timeoutSeconds * 1000)
  };
}

export function applyProxyHeaderOverrides(
  headers: Headers,
  overrides: ProxyHeaderOverrides
): void {
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) {
      headers.delete(name);
    } else {
      headers.set(name, value);
    }
  }
}

export function createProxyAbortContext(
  parentSignal: AbortSignal,
  timeoutMilliseconds: number | undefined
): ProxyAbortContext {
  if (timeoutMilliseconds === undefined) {
    return {
      cleanup: () => undefined,
      didTimeout: () => false,
      signal: parentSignal,
      timeoutPromise: undefined
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal.reason);

  if (parentSignal.aborted) {
    abortFromParent();
  } else {
    parentSignal.addEventListener("abort", abortFromParent, { once: true });
  }

  let rejectTimeout: ((reason: Error) => void) | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    const error = new Error("Proxy request timed out");
    timedOut = true;
    controller.abort(error);
    rejectTimeout?.(error);
  }, timeoutMilliseconds);

  return {
    cleanup: () => {
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", abortFromParent);
    },
    didTimeout: () => timedOut,
    signal: controller.signal,
    timeoutPromise
  };
}

export async function readProxyRequestBody(
  request: Request,
  maximumBytes: number | undefined
): Promise<ArrayBuffer> {
  if (maximumBytes !== undefined) {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const declaredBytes = Number(contentLength);
      if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
        throw new ProxyRequestBodyTooLargeError();
      }
    }
  }

  const body = await request.arrayBuffer();
  if (maximumBytes !== undefined && body.byteLength > maximumBytes) {
    throw new ProxyRequestBodyTooLargeError();
  }
  return body;
}
