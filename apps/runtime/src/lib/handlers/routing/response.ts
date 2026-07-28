/**
 * @file response.ts
 * @description
 * [EN] Route response factory.
 * Dispatches normalized redirect and proxy actions and classifies proxy candidate failures.
 *
 * [CN] 路由响应工厂。
 * 分发规范化后的重定向与代理动作，并对代理候选失败进行分类。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { DEFAULT_STATUS, HSTS_HEADER_VALUE } from "../core/constants";
import type { NormalizedRule, ResolvedRuntime } from "../core/types";

import { resolveProxyPolicy } from "./proxy/policy";
import { proxyRequest } from "./proxy/request";

export type ProxyFailureReason = "not_found" | "unavailable";

export function classifyProxyFailure(
  response: Response
): ProxyFailureReason | null {
  if (response.status === 404) {
    return "not_found";
  }
  if (response.status >= 500) {
    return "unavailable";
  }
  return null;
}

export async function respondUsingRule(
  request: Request,
  rule: NormalizedRule,
  targetUrl: string,
  runtime: ResolvedRuntime,
  basePath?: string,
  signal?: AbortSignal
): Promise<Response> {
  if (rule.action.type === "proxy") {
    return proxyRequest(
      request,
      targetUrl,
      runtime,
      resolveProxyPolicy(rule.action.policy),
      basePath,
      signal
    );
  }

  return redirectResponse(targetUrl, rule.action.status);
}

function redirectResponse(location: string, status: number): Response {
  return new Response(null, {
    status: status || DEFAULT_STATUS,
    headers: {
      Location: location,
      "Strict-Transport-Security": HSTS_HEADER_VALUE
    }
  });
}
