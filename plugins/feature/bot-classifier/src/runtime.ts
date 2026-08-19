import type {
  AnalyticsClassificationHookContext,
  AnalyticsRequestClassification,
} from "@nami/analytics-domain/classification"
import type {
  AnalyticsDeviceType,
  AnalyticsProbeCategory,
  AnalyticsResourceClass,
  AnalyticsTrafficClass,
  AnalyticsBotCategory,
  AnalyticsBotConfidence,
} from "@nami/analytics-domain/events"
import type { RuntimeFeatureRegistration } from "@nami/plugin-api"

import type { BotClassifierConfig } from "./config"
import { BOT_CLASSIFIER_PLUGIN_ID } from "./manifest"

interface AnalyticsTrafficClassification {
  trafficClass: AnalyticsTrafficClass
  botCategory: AnalyticsBotCategory
  botConfidence: AnalyticsBotConfidence
}

const SEARCH_BOT_PATTERN = /(googlebot|bingbot|duckduckbot|baiduspider|yandexbot|yahoo! slurp|applebot)/i
const AI_CRAWLER_PATTERN = /(gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|bytespider|google-extended|ccbot|cohere-ai)/i
const SOCIAL_PREVIEW_PATTERN = /(facebookexternalhit|facebot|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot|skypeuripreview|iframely|embedly|pinterestbot)/i
const MONITOR_PATTERN = /(uptimerobot|pingdom|statuscake|better\s?uptime|healthchecks|checkly|datadog synthetics|new relic synthetics|site24x7|zabbix|nagios|synthetic monitor)/i
const SECURITY_SCANNER_PATTERN = /(nuclei|nikto|sqlmap|masscan|zgrab|acunetix|nessus|openvas|wpscan|dirbuster|gobuster)/i
const AUTOMATION_PATTERN = /(headlesschrome|phantomjs|playwright|puppeteer|selenium|curl\/|wget\/|python-requests|python\/|okhttp|libwww-perl|apache-httpclient|go-http-client)/i
const GENERIC_BOT_PATTERN = /(bot\b|crawler|spider|scraper|scanner)/i
const TABLET_PATTERN = /(ipad|tablet|kindle|silk|playbook|android(?!.*mobile))/i
const MOBILE_PATTERN = /(mobile|iphone|ipod|android)/i
const DESKTOP_PATTERN = /(windows nt|macintosh|x11|cros|linux x86_64)/i
const ASSET_DESTINATIONS = new Set([
  "audio",
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "track",
  "video",
])

export function createBotClassifierFeature(
  config: BotClassifierConfig,
): RuntimeFeatureRegistration<AnalyticsClassificationHookContext> {
  return {
    id: BOT_CLASSIFIER_PLUGIN_ID,
    order: 100,
    timeoutMs: config.hookTimeoutMs,
    failurePolicy: "continue",
    hooks: {
      onAnalyticsEvent(context) {
        return {
          ...context,
          classification: classifyAnalyticsRequest(
            context.request,
            context.pathname,
          ),
        }
      },
    },
  }
}

export function classifyAnalyticsRequest(
  request: Request,
  pathname: string,
): AnalyticsRequestClassification {
  const probeCategory = classifyAnalyticsProbe(pathname)
  const traffic = classifyAnalyticsTraffic(request, probeCategory)
  return {
    ...traffic,
    probeCategory,
    resourceClass: classifyAnalyticsResource(request, pathname),
    deviceType: classifyAnalyticsDevice(request, traffic),
  }
}

export function classifyAnalyticsProbe(pathname: string): AnalyticsProbeCategory {
  const path = pathname.toLowerCase()
  if (/(?:^|\/)\.env(?:[./]|$)/.test(path)) return "env_file"
  if (/(?:^|\/)(?:\.git|\.hg|\.svn)(?:\/|$)/.test(path)) return "vcs"
  if (/(?:^|\/)\.\.(?:\/|$)|%2e%2e|%252e/i.test(path)) return "path_traversal"
  if (/(?:^|\/)(?:wp-admin|wp-content|wp-includes)(?:\/|$)|(?:^|\/)wp-login\.php$/.test(path)) return "wordpress"
  if (/(?:^|\/)(?:admin|administrator|phpmyadmin|adminer|manager|console)(?:\/|$)|(?:^|\/)(?:login|signin)\.php$/.test(path)) return "admin"
  if (/(?:^|\/)(?:xmlrpc\.php|cgi-bin|server-status|actuator|vendor\/phpunit|HNAP1)(?:\/|$)/i.test(path)) return "scanner"
  if (/(?:^|\/)(?:config|configuration|database|backup|dump|shell|webshell)(?:\.[a-z0-9._-]+)?$|\.(?:bak|old|orig|sql|sqlite|swp|tar|tgz|zip)$/.test(path)) return "other"
  return "none"
}

export function classifyAnalyticsTraffic(
  request: Request,
  probeCategory: AnalyticsProbeCategory,
): AnalyticsTrafficClassification {
  const userAgent = request.headers.get("user-agent") ?? ""
  if (SEARCH_BOT_PATTERN.test(userAgent)) return declaredBot("search")
  if (AI_CRAWLER_PATTERN.test(userAgent)) return declaredBot("ai_crawler")
  if (SOCIAL_PREVIEW_PATTERN.test(userAgent)) return declaredBot("social_preview")
  if (MONITOR_PATTERN.test(userAgent)) return declaredBot("monitor")
  if (SECURITY_SCANNER_PATTERN.test(userAgent)) {
    return suspectedAutomation("security_probe", "high")
  }
  if (AUTOMATION_PATTERN.test(userAgent)) {
    return suspectedAutomation("automation", "medium")
  }
  if (GENERIC_BOT_PATTERN.test(userAgent)) {
    return suspectedAutomation("unknown", "medium")
  }
  if (probeCategory !== "none") {
    return suspectedAutomation("security_probe", "medium")
  }
  const method = request.method.toUpperCase()
  const fetchMode = request.headers.get("sec-fetch-mode")
  const fetchDestination = request.headers.get("sec-fetch-dest")
  const accept = request.headers.get("accept") ?? ""
  if (
    method === "GET"
    && (
      fetchMode === "navigate"
      || fetchDestination === "document"
      || accept.includes("text/html")
    )
  ) {
    return {
      trafficClass: "browser_like",
      botCategory: "none",
      botConfidence: "none",
    }
  }
  return {
    trafficClass: "unknown",
    botCategory: "none",
    botConfidence: "none",
  }
}

export function classifyAnalyticsResource(
  request: Request,
  pathname: string,
): AnalyticsResourceClass {
  const fetchDestination = request.headers.get("sec-fetch-dest")?.toLowerCase() ?? ""
  const fetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase() ?? ""
  const accept = request.headers.get("accept")?.toLowerCase() ?? ""
  if (
    /(?:^|\/)(_next|_nuxt)(?:\/|$)/.test(pathname)
    || /(?:^|\/)(assets|static|images|img|fonts)(?:\/|$)/i.test(pathname)
    || /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot)$/i.test(pathname)
    || ASSET_DESTINATIONS.has(fetchDestination)
  ) return "asset"
  if (
    fetchDestination === "document"
    || fetchDestination === "iframe"
    || fetchMode === "navigate"
    || accept.includes("text/html")
  ) return "document"
  if (
    pathname === "/api"
    || pathname.startsWith("/api/")
    || accept.includes("application/json")
    || request.headers.get("content-type")?.toLowerCase().includes("application/json")
  ) return "api"
  if (fetchDestination || !["GET", "HEAD"].includes(request.method.toUpperCase())) {
    return "other"
  }
  return "unknown"
}

export function classifyAnalyticsDevice(
  request: Request,
  traffic: AnalyticsTrafficClassification,
): AnalyticsDeviceType {
  if (
    traffic.trafficClass === "declared_bot"
    || traffic.trafficClass === "suspected_automation"
  ) return "bot"
  const clientHint = request.headers.get("sec-ch-ua-mobile")?.trim()
  if (clientHint === "?1") return "mobile"
  if (clientHint === "?0") return "desktop"
  const userAgent = request.headers.get("user-agent") ?? ""
  if (TABLET_PATTERN.test(userAgent)) return "tablet"
  if (MOBILE_PATTERN.test(userAgent)) return "mobile"
  if (DESKTOP_PATTERN.test(userAgent)) return "desktop"
  return "unknown"
}

function declaredBot(botCategory: AnalyticsBotCategory): AnalyticsTrafficClassification {
  return { trafficClass: "declared_bot", botCategory, botConfidence: "high" }
}

function suspectedAutomation(
  botCategory: AnalyticsBotCategory,
  botConfidence: AnalyticsBotConfidence,
): AnalyticsTrafficClassification {
  return { trafficClass: "suspected_automation", botCategory, botConfidence }
}
