import { WebUiPluginSlot } from "@/components/plugins/plugin-slot"

import { BotBreakdownGrid, BreakdownGrid } from "./breakdown-grid"
import { DataQualityPanel } from "./data-quality-panel"
import { AutomationLinkRanking, LinkRanking } from "./link-ranking"
import { AutomationMetricCards, MetricCards } from "./metric-cards"
import { AutomationTrendChart, TrendChart } from "../trend/trend-panel"
import type {
  AnalyticsAutomationViewModel,
  AnalyticsDetailViewModel,
  AnalyticsOverviewViewModel,
  AnalyticsRange,
} from "../data/types"

interface AnalyticsOverviewDashboardProps {
  data: AnalyticsOverviewViewModel
  detailBasePath: string
  locale: string
  range: AnalyticsRange
  timeZone: string
}

interface AnalyticsDetailDashboardProps {
  data: AnalyticsDetailViewModel
  locale: string
  range: AnalyticsRange
  timeZone: string
}

interface AnalyticsAutomationDashboardProps {
  data: AnalyticsAutomationViewModel
  detailBasePath: string
  locale: string
  range: AnalyticsRange
  timeZone: string
}

export function AnalyticsOverviewDashboard({
  data,
  detailBasePath,
  locale,
  range,
  timeZone,
}: AnalyticsOverviewDashboardProps) {
  return (
    <div className="space-y-6">
      <MetricCards metrics={data.metrics} locale={locale} />
      <WebUiPluginSlot name="analytics.overview.cards" context={data} />
      <TrendChart
        points={data.trend}
        locale={locale}
        range={range}
        chartId="analytics-overview-trend"
        timeZone={timeZone}
      />
      <LinkRanking
        links={data.links.slice(0, 10)}
        locale={locale}
        range={range}
        detailBasePath={detailBasePath}
        entryDomain={data.scope.entryDomain}
      />
      <BreakdownGrid breakdowns={data.breakdowns} locale={locale} />
      <DataQualityPanel quality={data.quality} locale={locale} />
    </div>
  )
}

export function AnalyticsDetailDashboard({
  data,
  locale,
  range,
  timeZone,
}: AnalyticsDetailDashboardProps) {
  return (
    <div className="space-y-6">
      <MetricCards metrics={data.metrics} locale={locale} />
      <TrendChart
        points={data.trend}
        locale={locale}
        range={range}
        chartId="analytics-detail-trend"
        timeZone={timeZone}
      />
      <BreakdownGrid breakdowns={data.breakdowns} locale={locale} />
      <WebUiPluginSlot name="analytics.detail.sections" context={data} />
      <DataQualityPanel quality={data.quality} locale={locale} />
    </div>
  )
}

export function AnalyticsAutomationDashboard({
  data,
  detailBasePath,
  locale,
  range,
  timeZone,
}: AnalyticsAutomationDashboardProps) {
  return (
    <div className="space-y-6">
      <AutomationMetricCards metrics={data.metrics} locale={locale} />
      <AutomationTrendChart
        points={data.trend}
        locale={locale}
        range={range}
        timeZone={timeZone}
      />
      <BotBreakdownGrid breakdowns={data.breakdowns} locale={locale} />
      <AutomationLinkRanking
        links={data.links.slice(0, 10)}
        locale={locale}
        range={range}
        detailBasePath={detailBasePath}
        entryDomain={data.scope.entryDomain}
      />
      <DataQualityPanel quality={data.quality} locale={locale} />
    </div>
  )
}
