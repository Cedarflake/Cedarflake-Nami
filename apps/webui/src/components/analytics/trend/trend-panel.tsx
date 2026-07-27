import { useTranslations } from "next-intl"

import { cardClassName } from "@/components/ui/surfaces/card"

import { AnalyticsTrendChart } from "./analytics-trend-chart"
import type {
  AnalyticsAutomationTrendPoint,
  AnalyticsRange,
  AnalyticsTrendPoint,
} from "../data/types"

interface TrendChartProps {
  points: AnalyticsTrendPoint[]
  locale: string
  range: AnalyticsRange
  chartId: string
  accessibleTitle?: string
  description?: string
  primaryLabel?: string
  secondaryLabel?: string
  title?: string
  timeZone: string
}

interface AutomationTrendChartProps {
  points: AnalyticsAutomationTrendPoint[]
  locale: string
  range: AnalyticsRange
  timeZone: string
}

export function AutomationTrendChart({
  points,
  locale,
  range,
  timeZone,
}: AutomationTrendChartProps) {
  const t = useTranslations("analytics")
  const chartPoints: AnalyticsTrendPoint[] = points.map((point) => ({
    timestamp: point.timestamp,
    estimatedNavigations: point.declaredBots.observed,
    estimatedEntryNavigations: point.declaredBots.observed,
    totalRequests: point.suspectedAutomation.observed,
    entryRequests: point.suspectedAutomation.observed,
  }))

  return (
    <TrendChart
      points={chartPoints}
      locale={locale}
      range={range}
      chartId="analytics-automation-trend"
      accessibleTitle={t("automation.trend.accessibleTitle")}
      title={t("automation.trend.title")}
      description={t("automation.trend.description")}
      primaryLabel={t("automation.metrics.declaredBots")}
      secondaryLabel={t("automation.metrics.suspectedAutomation")}
      timeZone={timeZone}
    />
  )
}

export function TrendChart({
  points,
  locale,
  range,
  chartId,
  accessibleTitle,
  description,
  primaryLabel,
  secondaryLabel,
  title,
  timeZone,
}: TrendChartProps) {
  const t = useTranslations("analytics")
  const resolvedPrimaryLabel = primaryLabel ?? t("metrics.effectiveVisits")
  const resolvedSecondaryLabel = secondaryLabel ?? t("metrics.totalRequests")
  const resolvedAccessibleTitle = accessibleTitle ?? t("trend.accessibleTitle")
  const isHourly = range === 1
  const chartData = points.map((point) => ({
    timestamp: point.timestamp,
    label: point.label,
    primaryValue: point.estimatedEntryNavigations,
    secondaryValue: point.totalRequests,
  }))

  return (
    <section className={cardClassName({ elevation: "flat", padding: "md", className: "sm:p-6" })}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title ?? t("trend.title")}</h2>
          <p className="mt-1 text-sm text-muted">
            {description ?? t("trend.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-medium text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full bg-accent" />
            {resolvedPrimaryLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full bg-line-strong" />
            {resolvedSecondaryLabel}
          </span>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="mt-6 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-line bg-panel-muted px-6 text-center text-sm text-muted">
          {t("trend.empty")}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <AnalyticsTrendChart
            data={chartData}
            locale={locale}
            chartId={chartId}
            accessibleTitle={resolvedAccessibleTitle}
            accessibleDescriptionTemplate={t("trend.accessibleDescription", {
              start: "{start}",
              end: "{end}",
            })}
            granularity={isHourly ? "hour" : "day"}
            primaryLabel={resolvedPrimaryLabel}
            secondaryLabel={resolvedSecondaryLabel}
            tableCaption={t("trend.tableCaption")}
            timeColumnLabel={t(isHourly ? "trend.time" : "trend.date")}
            timeZone={timeZone}
          />
        </div>
      )}
    </section>
  )
}
