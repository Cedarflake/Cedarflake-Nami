import Link from "next/link"
import { useTranslations } from "next-intl"

import type { AnalyticsTrendComparison } from "@nami/analytics-domain/types"

import { cardClassName } from "@/components/ui/surfaces/card"

import { formatChangeRate, formatCount } from "../formatting/format"
import { buildAnalyticsHref } from "../navigation/links"
import type {
  AnalyticsAutomationLink,
  AnalyticsRange,
  AnalyticsRankedLink,
} from "../data/types"

interface LinkRankingProps {
  links: AnalyticsRankedLink[]
  locale: string
  range: AnalyticsRange
  detailBasePath: string
  entryDomain: string
}

interface AutomationLinkRankingProps {
  links: AnalyticsAutomationLink[]
  locale: string
  range: AnalyticsRange
  detailBasePath: string
  entryDomain: string
}

function TrendChange({
  comparison,
  locale,
}: {
  comparison: AnalyticsTrendComparison
  locale: string
}) {
  const t = useTranslations("analytics")
  const isPositive = comparison.status === "started"
    || (comparison.status === "percentage" && comparison.percent > 0)
  const isNegative = comparison.status === "percentage" && comparison.percent < 0

  let content: string
  switch (comparison.status) {
    case "percentage":
      content = t("ranking.changeCompared", {
        value: formatChangeRate(comparison.percent / 100, locale),
      })
      break
    case "started":
      content = t("ranking.started", {
        count: formatCount(comparison.currentValue, locale),
      })
      break
    case "unchanged":
      content = t("ranking.unchanged")
      break
    default:
      content = t("ranking.noComparison")
  }

  return (
    <span
      className={`text-xs font-medium tabular-nums ${
        isPositive ? "text-emerald-700" : isNegative ? "text-rose-700" : "text-muted"
      }`}
    >
      {content}
    </span>
  )
}

function LinkKindBadge({ kind }: { kind?: string }) {
  const t = useTranslations("analytics")
  const labels: Record<string, string> = {
    redirect: t("labels.linkTypes.redirect"),
    proxy: t("labels.linkTypes.proxy"),
  }

  return (
    <span className="inline-flex rounded-full border border-line bg-panel-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
      {kind ? labels[kind] ?? kind : t("detail.linkKind")}
    </span>
  )
}

export function LinkRanking({
  links,
  locale,
  range,
  detailBasePath,
  entryDomain,
}: LinkRankingProps) {
  const t = useTranslations("analytics")

  return (
    <section className={cardClassName({ elevation: "flat", padding: "none" })}>
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("ranking.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("ranking.description")}</p>
      </div>

      {links.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted">
          {t("ranking.empty")}
        </div>
      ) : (
        <>
          <div className="divide-y divide-line md:hidden">
            {links.map((link, index) => (
              <article key={link.analyticsId} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted">#{index + 1}</span>
                      <LinkKindBadge kind={link.kind} />
                    </div>
                    <Link
                      href={buildAnalyticsHref(
                        `${detailBasePath}/${encodeURIComponent(link.analyticsId)}`,
                        { entryDomain, range },
                      )}
                      className="mt-2 block truncate font-mono text-sm font-semibold text-ink hover:text-accent hover:underline"
                    >
                      {link.path}
                    </Link>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tabular-nums text-ink">
                      {formatCount(link.estimatedEntryNavigations, locale)}
                    </p>
                    <p className="text-xs text-muted">{t("metrics.effectiveVisits")}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-xs text-muted">
                    {t("ranking.requestCount", {
                      count: formatCount(link.totalRequests, locale),
                    })}
                  </span>
                  <TrendChange comparison={link.trend} locale={locale} />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] text-left">
              <caption className="sr-only">{t("ranking.tableCaption")}</caption>
              <thead className="bg-panel-muted text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="w-16 px-6 py-3">{t("ranking.rank")}</th>
                  <th scope="col" className="px-3 py-3">{t("ranking.shortLink")}</th>
                  <th scope="col" className="px-3 py-3">{t("ranking.type")}</th>
                  <th scope="col" className="px-3 py-3 text-right">{t("metrics.effectiveVisits")}</th>
                  <th scope="col" className="px-3 py-3 text-right">{t("metrics.totalRequests")}</th>
                  <th scope="col" className="px-6 py-3 text-right">{t("ranking.change")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {links.map((link, index) => (
                  <tr key={link.analyticsId} className="transition hover:bg-panel-muted/70">
                    <td className="px-6 py-4 text-sm font-medium text-muted">{index + 1}</td>
                    <th scope="row" className="px-3 py-4 font-normal">
                      <Link
                        href={buildAnalyticsHref(
                          `${detailBasePath}/${encodeURIComponent(link.analyticsId)}`,
                          { entryDomain, range },
                        )}
                        className="block truncate font-mono text-sm font-semibold text-ink hover:text-accent hover:underline"
                      >
                        {link.path}
                      </Link>
                    </th>
                    <td className="px-3 py-4"><LinkKindBadge kind={link.kind} /></td>
                    <td className="px-3 py-4 text-right text-sm font-semibold tabular-nums text-ink">
                      {formatCount(link.estimatedEntryNavigations, locale)}
                    </td>
                    <td className="px-3 py-4 text-right text-sm tabular-nums text-muted">
                      {formatCount(link.totalRequests, locale)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <TrendChange comparison={link.trend} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export function AutomationLinkRanking({
  links,
  locale,
  range,
  detailBasePath,
  entryDomain,
}: AutomationLinkRankingProps) {
  const t = useTranslations("analytics")

  return (
    <section className={cardClassName({ elevation: "flat", padding: "none" })}>
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("automation.ranking.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("automation.ranking.description")}</p>
      </div>
      {links.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted">
          {t("automation.ranking.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">{t("automation.ranking.tableCaption")}</caption>
            <thead className="bg-panel-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-6 py-3">{t("ranking.shortLink")}</th>
                <th scope="col" className="px-3 py-3 text-right">
                  {t("automation.observed")}
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  {t("automation.estimated")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {links.map((link) => (
                <tr key={link.analyticsId}>
                  <th scope="row" className="px-6 py-4 font-normal">
                    <Link
                      href={buildAnalyticsHref(
                        `${detailBasePath}/${encodeURIComponent(link.analyticsId)}`,
                        { entryDomain, range },
                      )}
                      className="font-mono text-sm font-semibold text-ink hover:text-accent hover:underline"
                    >
                      {link.path}
                    </Link>
                  </th>
                  <td className="px-3 py-4 text-right text-sm font-semibold tabular-nums text-ink">
                    {formatCount(link.observedRequests, locale)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums text-muted">
                    {t("automation.estimatedValue", {
                      count: formatCount(link.estimatedRequests, locale),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
