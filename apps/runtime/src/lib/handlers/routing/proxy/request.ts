/**
 * @file request.ts
 * @description
 * [EN] Proxy request execution.
 * Enforces resolved policy decisions across upstream requests, redirect hops, response headers,
 * body limits, timeouts, and legacy HTML path rewriting.
 *
 * [CN] 反向代理请求执行。
 * 在上游请求、跳转链、响应头、请求体限制、超时和旧版 HTML 路径改写中执行已解析的策略决策。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import type { ResolvedRuntime } from "../../core/types";

import {
  applyProxyResponseHeaders,
  buildProxyRequestHeaders
} from "./headers";
import type { ResolvedProxyPolicy } from "./policy";
import {
  assertSafeProxyUrl,
  isAllowedRedirectOrigin
} from "./safety";

interface ProxyAbortContext {
  cleanup(): void;
  didTimeout(): boolean;
  signal: AbortSignal;
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
  }
}

function shouldSwitchRedirectToGet(status: number, method: string): boolean {
  return (
    ((status === 301 || status === 302) && method === "POST")
    || (status === 303 && method !== "GET" && method !== "HEAD")
  );
}

function prependProxyBasePath(pathname: string, basePath: string): string {
  if (!basePath || basePath === "/") {
    return pathname;
  }

  const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return pathname === "/" ? `${prefix}/` : `${prefix}${pathname}`;
}

function createProxyAbortContext(
  parentSignal: AbortSignal,
  timeoutMs: number | null
): ProxyAbortContext {
  if (timeoutMs === null) {
    return {
      signal: parentSignal,
      didTimeout: () => false,
      cleanup: () => undefined
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
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Proxy request timed out"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", abortFromParent);
    }
  };
}

async function readRequestBody(
  request: Request,
  maximumBytes: number | null
): Promise<ArrayBuffer | undefined | Response> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || !request.body) {
    return undefined;
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader === null
    ? null
    : Number(contentLengthHeader);
  if (
    maximumBytes !== null
    && contentLength !== null
    && Number.isFinite(contentLength)
    && contentLength > maximumBytes
  ) {
    return new Response("Payload Too Large", { status: 413 });
  }

  if (maximumBytes === null) {
    return request.arrayBuffer();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        return new Response("Payload Too Large", { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function rewriteResponseLocation(
  responseHeaders: Headers,
  originalUrl: URL,
  initialTarget: URL,
  currentTarget: string,
  basePath: string
): void {
  const location = responseHeaders.get("location");
  if (!location) {
    return;
  }

  let finalLocation = location;
  try {
    const locationUrl = new URL(location, currentTarget);
    if (locationUrl.origin === initialTarget.origin && originalUrl.host) {
      const rewrittenUrl = new URL(originalUrl.origin);
      rewrittenUrl.pathname = prependProxyBasePath(
        locationUrl.pathname,
        basePath
      );
      rewrittenUrl.search = locationUrl.search;
      rewrittenUrl.hash = locationUrl.hash;
      const rewritten = rewrittenUrl.toString();
      finalLocation = rewritten !== originalUrl.href
        ? rewritten
        : locationUrl.toString();
    } else {
      finalLocation = locationUrl.toString();
    }
  } catch {
  }

  responseHeaders.set("location", finalLocation);
}

function rewriteHtmlPaths(html: string, basePath: string): string {
  return html
    .replace(
      /(href|src|action)="\/((?!\/|#|\.\/|\.\.\/)[^"]*)"/g,
      (_, attribute: string, pathPart: string) => {
        return `${attribute}="${basePath}/${pathPart}"`;
      }
    )
    .replace(/<base\s+href="\/"\s*>/gi, `<base href="${basePath}/">`);
}

export async function proxyRequest(
  request: Request,
  targetUrl: string,
  runtime: ResolvedRuntime,
  policy: ResolvedProxyPolicy,
  basePath: string = "",
  parentSignal: AbortSignal = request.signal
): Promise<Response> {
  const originalMethod = request.method.toUpperCase();
  if (
    policy.request.methods
    && !policy.request.methods.includes(originalMethod)
  ) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: policy.request.methods.join(", ") }
    });
  }

  const originalUrl = new URL(request.url);
  const initialTarget = new URL(targetUrl);
  try {
    assertSafeProxyUrl(initialTarget);
  } catch (error) {
    console.error("Unsafe proxy target:", error);
    return new Response("Bad Request: Unsafe proxy target.", { status: 400 });
  }

  const bodyResult = await readRequestBody(
    request,
    policy.limits.maxRequestBodyBytes
  );
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const abortContext = createProxyAbortContext(
    parentSignal,
    policy.limits.timeoutMs
  );
  let currentTarget = targetUrl;
  let redirectCount = 0;
  let lastResponse: Response | null = null;
  let effectiveMethod = originalMethod;
  let shouldDropBodyHeaders = false;

  try {
    while (true) {
      const currentTargetUrl = new URL(currentTarget);
      try {
        assertSafeProxyUrl(currentTargetUrl);
      } catch (error) {
        console.error("Unsafe proxy redirect target:", error);
        return new Response(
          "Bad Gateway: Upstream redirect blocked.",
          { status: 502 }
        );
      }

      const headers = buildProxyRequestHeaders({
        request,
        originalUrl,
        currentTarget: currentTargetUrl,
        initialTarget,
        policy,
        shouldDropBodyHeaders
      });
      const forwardBody = effectiveMethod !== "GET"
        && effectiveMethod !== "HEAD"
        ? bodyResult ?? null
        : null;
      const forwarded = new Request(currentTarget, {
        method: effectiveMethod,
        headers,
        body: forwardBody,
        redirect: "manual",
        signal: abortContext.signal
      });

      try {
        lastResponse = await runtime.fetchImpl(forwarded);
      } catch (error) {
        if (abortContext.didTimeout()) {
          return new Response(
            "Gateway Timeout: Upstream request timed out.",
            { status: 504 }
          );
        }
        if (!parentSignal.aborted) {
          console.error(`Proxy fetch failed for ${currentTarget}:`, error);
        }
        return new Response(
          "Bad Gateway: Upstream fetch failed.",
          { status: 502 }
        );
      }

      const status = lastResponse.status;
      const location = lastResponse.headers.get("location");
      if (
        status < 300
        || status >= 400
        || !location
        || policy.redirects.mode === "manual"
        || redirectCount >= policy.redirects.maxHops
      ) {
        break;
      }

      let nextTarget: URL;
      try {
        nextTarget = new URL(location, currentTargetUrl);
        assertSafeProxyUrl(nextTarget);
      } catch (error) {
        console.error("Blocked unsafe upstream redirect:", error);
        await discardResponseBody(lastResponse);
        return new Response(
          "Bad Gateway: Unsafe upstream redirect.",
          { status: 502 }
        );
      }
      if (
        !isAllowedRedirectOrigin(
          nextTarget,
          initialTarget,
          policy.redirects.allowedOrigins
        )
      ) {
        await discardResponseBody(lastResponse);
        return new Response(
          "Bad Gateway: Upstream redirect origin is not allowed.",
          { status: 502 }
        );
      }

      if (shouldSwitchRedirectToGet(status, effectiveMethod)) {
        effectiveMethod = "GET";
        shouldDropBodyHeaders = true;
      }

      await discardResponseBody(lastResponse);
      currentTarget = nextTarget.toString();
      redirectCount += 1;
    }
  } finally {
    abortContext.cleanup();
  }

  if (!lastResponse) {
    return new Response("Gateway Timeout", { status: 504 });
  }

  const responseHeaders = applyProxyResponseHeaders({
    sourceHeaders: lastResponse.headers,
    policy,
    basePath,
    requestMethod: originalMethod,
    responseStatus: lastResponse.status,
    upstreamStatus: lastResponse.status,
    upstreamLocation: lastResponse.headers.get("location"),
    redirectsFollowed: redirectCount
  });
  rewriteResponseLocation(
    responseHeaders,
    originalUrl,
    initialTarget,
    currentTarget,
    basePath
  );

  const contentType = responseHeaders.get("content-type") ?? "";
  const shouldRewriteHtml = (
    policy.rewriteHtml
    && Boolean(basePath)
    && basePath !== "/"
    && contentType.includes("text/html")
  );
  if (!shouldRewriteHtml) {
    return new Response(lastResponse.body, {
      status: lastResponse.status,
      headers: responseHeaders
    });
  }

  const html = await lastResponse.text();
  responseHeaders.delete("content-length");
  return new Response(rewriteHtmlPaths(html, basePath), {
    status: lastResponse.status,
    headers: responseHeaders
  });
}
