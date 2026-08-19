/**
 * @file seo.ts
 * @description
 * [EN] SEO Utilities.
 * Provides helpers to generate `robots.txt` and `sitemap.xml` based on compiled route rules.
 *
 * [CN] SEO 工具集。
 * 基于已编译的路由规则生成 `robots.txt` 和 `sitemap.xml`。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { defaultDataConfig } from "@nami/config";
import type { RobotsPolicy } from "@nami/config";

import { buildCompiledList } from "../routing/matcher";
import type { RouteValueEntry } from "../core/types";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

export function isRobotsAllowed(
  policy: RobotsPolicy = defaultDataConfig.runtime.robotsPolicy
): boolean {
  return policy === "allow";
}

export function generateRobots(
  origin: string,
  policy: RobotsPolicy = defaultDataConfig.runtime.robotsPolicy
): string {
  const sitemapUrl = `${origin.replace(/\/$/, "")}/sitemap.xml`;
  const allowAll = isRobotsAllowed(policy);

  const lines = ["User-agent: *", allowAll ? "Allow: /" : "Disallow: /"];
  if (allowAll) {
    lines.push(`Sitemap: ${sitemapUrl}`);
  }

  return lines.join("\n") + "\n";
}

export function generateSitemapXml(origin: string, rulesIn: Record<string, RouteValueEntry>): string {
  const compiled = buildCompiledList(rulesIn);
  const urls = new Set<string>();
  const nowIso = new Date().toISOString();

  for (const item of compiled) {
    if (item.isParam) continue;

    const path = item.base === "/" ? "/" : item.base;
    urls.add(`${origin.replace(/\/$/, "")}${path}`);
  }

  const urlEntries = Array.from(urls)
    .map((u) => {
      const isRoot = u.endsWith("/");
      const changefreq = isRoot ? "daily" : "weekly";
      const priority = isRoot ? "1.0" : "0.5";

      return `  <url>\n    <loc>${escapeXml(u)}</loc>\n    <lastmod>${nowIso}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;
}
