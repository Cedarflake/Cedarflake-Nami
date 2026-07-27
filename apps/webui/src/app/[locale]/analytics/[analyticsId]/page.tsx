import { redirect } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { getWebUiReadSessionAuthorization } from "@/auth/authorization"
import { toQueryRange } from "@/components/analytics/data/adapters/common"
import { toDetailViewModel } from "@/components/analytics/data/adapters/traffic"
import { AnalyticsDetailDashboard } from "@/components/analytics/dashboard/analytics-dashboard"
import { parseAnalyticsRange } from "@/components/analytics/formatting/format"
import { buildAnalyticsHref } from "@/components/analytics/navigation/links"
import { AnalyticsPageHeader } from "@/components/analytics/navigation/analytics-page-header"
import { AnalyticsRouteNavigation } from "@/components/analytics/navigation/analytics-route-navigation"
import { AnalyticsShell } from "@/components/analytics/shell/analytics-shell"
import { AnalyticsStatePanel } from "@/components/analytics/shell/analytics-state-panel"
import { SignInPanel } from "@/components/ui/feedback/sign-in-panel"
import {
  getAnalyticsDetail,
  getAnalyticsScope,
  isAnalyticsConfigured,
} from "@/lib/analytics/queries"
import { getRequestAnalyticsTimeZone } from "@/lib/analytics/request-time-zone"

interface AnalyticsDetailPageProps {
  params: Promise<{ locale: string; analyticsId: string }>
  searchParams: Promise<{
    entryDomain?: string | string[]
    range?: string | string[]
  }>
}

export const dynamic = "force-dynamic"

export default async function AnalyticsDetailPage({
  params,
  searchParams,
}: AnalyticsDetailPageProps) {
  const authorization = await getWebUiReadSessionAuthorization()

  if (authorization.status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <SignInPanel />
      </main>
    )
  }

  if (authorization.status === "forbidden") {
    redirect("/access-denied")
  }

  const [{ locale, analyticsId }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "analytics" })
  const range = parseAnalyticsRange(query.range)
  const entryDomain = Array.isArray(query.entryDomain)
    ? query.entryDomain[0] ?? "all"
    : query.entryDomain ?? "all"
  const timeZone = await getRequestAnalyticsTimeZone()
  const overviewPath = `/${locale}/analytics`
  const detailPath = `${overviewPath}/${encodeURIComponent(analyticsId)}`
  const requestedOverviewHref = buildAnalyticsHref(overviewPath, {
    entryDomain,
    range,
  })

  if (!await isAnalyticsConfigured()) {
    return (
      <AnalyticsShell>
        <AnalyticsPageHeader
          backAction={{ href: requestedOverviewHref, label: t("detail.back") }}
          entryDomain={entryDomain}
          range={range}
          rangeBasePath={detailPath}
          showRefresh={false}
        />
        <AnalyticsStatePanel
          title={t("states.unconfiguredTitle")}
          description={t("states.unconfiguredDescription")}
        />
      </AnalyticsShell>
    )
  }

  const queryScope = { range: toQueryRange(range), entryDomain, timeZone }
  const result = await getAnalyticsDetail(analyticsId, queryScope)
  const scope = result?.scope ?? await getAnalyticsScope(queryScope)
  const navigationScope = {
    entryDomain: scope.entryDomain,
    availableEntryDomains: scope.availableEntryDomains.map((option) => ({
      value: option.value,
    })),
  }
  const routeNavigation = (
    <AnalyticsRouteNavigation
      basePath={overviewPath}
      range={range}
      scope={navigationScope}
    />
  )
  const overviewActionHref = buildAnalyticsHref(overviewPath, {
    entryDomain: scope.entryDomain,
    range,
  })

  if (!result) {
    return (
      <AnalyticsShell navigation={routeNavigation}>
        <AnalyticsPageHeader
          backAction={{ href: overviewActionHref, label: t("detail.back") }}
          entryDomain={navigationScope.entryDomain}
          range={range}
          rangeBasePath={detailPath}
          showRefresh={!authorization.isReadOnly}
        />
        <AnalyticsStatePanel
          title={t("states.notFoundTitle")}
          description={t("states.notFoundDescription")}
        />
      </AnalyticsShell>
    )
  }

  const detail = toDetailViewModel(result)

  return (
    <AnalyticsShell navigation={routeNavigation}>
      <AnalyticsPageHeader
        backAction={{ href: overviewActionHref, label: t("detail.back") }}
        entryDomain={detail.scope.entryDomain}
        range={range}
        rangeBasePath={detailPath}
        showRefresh={!authorization.isReadOnly}
      />
      {detail.hasData ? (
        <AnalyticsDetailDashboard
          data={detail}
          locale={locale}
          range={range}
          timeZone={timeZone}
        />
      ) : (
        <AnalyticsStatePanel
          title={t("states.linkEmptyTitle")}
          description={t("states.linkEmptyDescription")}
        />
      )}
    </AnalyticsShell>
  )
}
