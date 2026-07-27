import { redirect } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { getWebUiReadSessionAuthorization } from "@/auth/authorization"
import { AnalyticsOverviewDashboard } from "@/components/analytics/dashboard/analytics-dashboard"
import { toQueryRange } from "@/components/analytics/data/adapters/common"
import { toOverviewViewModel } from "@/components/analytics/data/adapters/traffic"
import { parseAnalyticsRange } from "@/components/analytics/formatting/format"
import { AnalyticsPageHeader } from "@/components/analytics/navigation/analytics-page-header"
import { AnalyticsRouteNavigation } from "@/components/analytics/navigation/analytics-route-navigation"
import { AnalyticsShell } from "@/components/analytics/shell/analytics-shell"
import { AnalyticsStatePanel } from "@/components/analytics/shell/analytics-state-panel"
import { SignInPanel } from "@/components/ui/feedback/sign-in-panel"
import { getAnalyticsOverview, isAnalyticsConfigured } from "@/lib/analytics/queries"
import { getRequestAnalyticsTimeZone } from "@/lib/analytics/request-time-zone"

interface AnalyticsPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    entryDomain?: string | string[]
    range?: string | string[]
  }>
}

export const dynamic = "force-dynamic"

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
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

  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "analytics" })
  const range = parseAnalyticsRange(query.range)
  const entryDomain = Array.isArray(query.entryDomain)
    ? query.entryDomain[0] ?? "all"
    : query.entryDomain ?? "all"
  const timeZone = await getRequestAnalyticsTimeZone()
  const basePath = `/${locale}/analytics`

  if (!await isAnalyticsConfigured()) {
    return (
      <AnalyticsShell>
        <AnalyticsPageHeader
          range={range}
          rangeBasePath={basePath}
          showRefresh={false}
        />
        <AnalyticsStatePanel
          title={t("states.unconfiguredTitle")}
          description={t("states.unconfiguredDescription")}
          action={{ href: `/${locale}`, label: t("states.backToRules") }}
        />
      </AnalyticsShell>
    )
  }

  const overview = toOverviewViewModel(await getAnalyticsOverview({
    range: toQueryRange(range),
    entryDomain,
    timeZone,
  }))

  return (
    <AnalyticsShell
      navigation={
        <AnalyticsRouteNavigation
          basePath={basePath}
          range={range}
          scope={overview.scope}
        />
      }
    >
      <AnalyticsPageHeader
        entryDomain={overview.scope.entryDomain}
        range={range}
        rangeBasePath={basePath}
        showRefresh={!authorization.isReadOnly}
      />
      {overview.hasData ? (
        <AnalyticsOverviewDashboard
          data={overview}
          detailBasePath={basePath}
          locale={locale}
          range={range}
          timeZone={timeZone}
        />
      ) : (
        <AnalyticsStatePanel
          title={t("states.emptyTitle")}
          description={t("states.emptyDescription")}
          action={{ href: `/${locale}`, label: t("states.backToRules") }}
        />
      )}
    </AnalyticsShell>
  )
}
