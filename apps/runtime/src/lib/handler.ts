/**
 * @file handler.ts
 * @description
 * [EN] Core Logic Entry Point.
 * This module acts as the controller that coordinates config loading,
 * route matching (regex/prefix), and response handling. It is platform-agnostic.
 *
 * [CN] 核心逻辑入口。
 * 该模块作为控制器，负责协调配置加载、路由匹配（正则/前缀）以及响应处理。
 * 它与具体部署平台（Cloudflare/Vercel）解耦，通用性强。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import {
  ANALYTICS_ATTRIBUTION_QUERY_PARAM,
  clearAttributionCookie,
  finalizeMatchedAnalytics,
  finalizeRuntimeAnalytics,
  prepareAnalyticsRequest,
  readAttributionCookie
} from "@handlers/analytics";
import { HTTPS_REDIRECT_STATUS } from "@handlers/core/constants";
import { dispatchRouteRequest } from "@handlers/routing/dispatcher";
import { serveFavicon } from "@handlers/resources/favicon-serve";
import { interLatinVariableFontPath, serveInterFont } from "@handlers/resources/font-serve";
import {
  loadDataConfig,
  loadRedirects,
  resolveRuntimeOptions
} from "@handlers/configuration/loader";
import {
  flattenSlots,
  getCompiledList,
  getSlotSource
} from "@handlers/routing/matcher";
import { generateRobots, generateSitemapXml, isRobotsAllowed } from "@handlers/resources/seo";
import { notFoundPageHtml } from "@handlers/resources/templates";
import { createRuntimeFeaturePipeline } from "@/plugins/features";
import type { AnalyticsRequestContext } from "@handlers/analytics";
import type { HandlerOptions, RouteValueEntry } from "@handlers/core/types";
import { inferEffectivePath, isLikelyStaticAssetPath, normalisePath, safeDecode } from "@handlers/core/utils";

export async function handleRedirectRequest(request: Request, options: HandlerOptions = {}): Promise<Response> {
  let runtime = resolveRuntimeOptions(options);
  const startedAt = runtime.now();
  let analytics: AnalyticsRequestContext | undefined;
  let effectivePath = "/";

  try {
    const initialUrl = new URL(request.url);

    if (initialUrl.protocol !== "https:") {
      const containsAttributionToken = initialUrl.searchParams.has(ANALYTICS_ATTRIBUTION_QUERY_PARAM);
      const destination = `https://${initialUrl.host}${initialUrl.pathname}${initialUrl.search}`;
      return createCanonicalRedirect(destination, containsAttributionToken);
    }

    const initialPath = normalisePath(initialUrl.pathname);
    if (!initialUrl.searchParams.has(ANALYTICS_ATTRIBUTION_QUERY_PARAM)) {
      const hasAttributionCookie = Boolean(readAttributionCookie(request));
      if (initialPath === "/favicon.ico") {
        return clearAttributionCookie(serveFavicon(), hasAttributionCookie);
      }
      if (initialPath === interLatinVariableFontPath) {
        return clearAttributionCookie(serveInterFont(), hasAttributionCookie);
      }
    }
    const needsRedirects = initialPath !== "/favicon.ico" && initialPath !== interLatinVariableFontPath;
    const [dataConfig, redirectsConfig] = await Promise.all([
      loadDataConfig(runtime),
      needsRedirects ? loadRedirects(runtime) : Promise.resolve(null)
    ]);
    runtime = {
      ...runtime,
      dataConfig,
      featurePipeline: createRuntimeFeaturePipeline(
        dataConfig,
        {
          platformPluginId: runtime.platformPluginId,
          pluginInstallations: runtime.pluginInstallations,
          runtimePlatformManifests: runtime.runtimePlatformManifests
        },
        runtime.runtimeFeatures
      )
    };

    analytics = await prepareAnalyticsRequest(request, runtime);
    if (analytics.cleanupResponse) {
      return analytics.cleanupResponse;
    }

    const url = analytics.sanitizedUrl;
    const path = normalisePath(url.pathname);
    effectivePath = safeDecode(path);

    if (path === "/favicon.ico") {
      return clearAttributionCookie(serveFavicon(), analytics.hasAttributionCookie);
    }

    if (path === interLatinVariableFontPath) {
      return clearAttributionCookie(serveInterFont(), analytics.hasAttributionCookie);
    }

    const slotSource = getSlotSource(redirectsConfig);

    if (!slotSource) {
      console.warn("[Handler] No slots configured.");
      const response = new Response("503 No Slots configured", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
      return finalizeRuntimeAnalytics({
        request,
        response,
        outcome: "config_unavailable",
        effectivePath,
        startedAt,
        runtime,
        analytics
      });
    }

    if (path === "/robots.txt" || path === "/sitemap.xml") {
      const rawRules: Record<string, RouteValueEntry> = {};
      flattenSlots(slotSource, rawRules);
      const origin = url.origin;

      if (path === "/robots.txt") {
        const robots = generateRobots(origin, runtime.dataConfig.runtime.robotsPolicy);
        const response = new Response(robots, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" }
        });
        return clearAttributionCookie(response, analytics.hasAttributionCookie);
      }

      if (!isRobotsAllowed(runtime.dataConfig.runtime.robotsPolicy)) {
        const response = new Response("Sitemap disabled", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" }
        });
        return clearAttributionCookie(response, analytics.hasAttributionCookie);
      }

      const sitemap = generateSitemapXml(origin, rawRules);
      const response = new Response(sitemap, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }
      });
      return clearAttributionCookie(response, analytics.hasAttributionCookie);
    }

    const compiledList = getCompiledList(slotSource);
    const decodedPath = safeDecode(path);

    effectivePath = inferEffectivePath(decodedPath, request.headers, url.origin, compiledList);
    const isStaticAssetPath = isLikelyStaticAssetPath(effectivePath);
    const dispatch = await dispatchRouteRequest({
      request,
      runtime,
      compiledList,
      effectivePath,
      search: url.search,
      isStaticAssetPath
    });

    if (dispatch.match) {
      return await finalizeMatchedAnalytics({
        request,
        response: dispatch.match.response,
        rule: dispatch.match.rule,
        routePath: dispatch.match.routePath,
        matchKind: dispatch.match.matchKind,
        effectivePath,
        startedAt,
        runtime,
        analytics
      });
    }

    const isProxyUnavailable = dispatch.proxyFailureReason === "unavailable";
    const response = isProxyUnavailable
      ? new Response("Bad Gateway: All upstream proxies failed.", {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      })
      : new Response(notFoundPageHtml, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60"
        }
      });
    return finalizeRuntimeAnalytics({
      request,
      response,
      outcome: isProxyUnavailable ? "proxy_exhausted" : "not_found",
      effectivePath,
      startedAt,
      runtime,
      analytics
    });
  } catch (error) {
    console.error("[Handler Critical Error]", error);
    const response = new Response("Internal Server Error", { status: 500 });
    return analytics
      ? finalizeRuntimeAnalytics({
        request,
        response,
        outcome: "internal_error",
        effectivePath,
        startedAt,
        runtime,
        analytics
      })
      : response;
  }
}

function createCanonicalRedirect(destination: string, containsAttributionToken: boolean): Response {
  if (!containsAttributionToken) {
    return Response.redirect(destination, HTTPS_REDIRECT_STATUS);
  }

  return new Response(null, {
    status: HTTPS_REDIRECT_STATUS,
    headers: {
      "Cache-Control": "private, no-store",
      Location: destination,
      "Referrer-Policy": "no-referrer"
    }
  });
}

export {
  DEFAULT_CONFIG_URL,
  DEFAULT_DATA_CONFIG_URL,
  DEFAULT_REDIRECTS_CONFIG_URL
} from "@handlers/configuration/config";
export type { RedirectsConfig, RouteConfig, HandlerOptions } from "@handlers/core/types";
