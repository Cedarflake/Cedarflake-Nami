import { redirect } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { getWebUiReadSessionAuthorization } from "@/auth/authorization"
import { toAutomationViewModel } from "@/components/analytics/data/adapters/automation"
import { toQueryRange } from "@/components/analytics/data/adapters/common"
import { AnalyticsAutomationDashboard } from "@/components/analytics/dashboard/analytics-dashboard"
import { parseAnalyticsRange } from "@/components/analytics/formatting/format"
import { buildAnalyticsHref } from "@/components/analytics/navigation/links"
import { AnalyticsPageHeader } from "@/components/analytics/navigation/analytics-page-header"
import { AnalyticsRouteNavigation } from "@/components/analytics/navigation/analytics-route-navigation"
import { AnalyticsShell } from "@/components/analytics/shell/analytics-shell"
import { AnalyticsStatePanel } from "@/components/analytics/shell/analytics-state-panel"
import { SignInPanel } from "@/components/ui/feedback/sign-in-panel"
import { getAnalyticsAutomationOverview, isAnalyticsConfigured } from "@/lib/analytics/queries"
import { getRequestAnalyticsTimeZone } from "@/lib/analytics/request-time-zone"

interface AnalyticsAutomationPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    entryDomain?: string | string[]
    range?: string | string[]
  }>
}

export const dynamic = "force-dynamic"

export default async function AnalyticsAutomationPage({
  params,
  searchParams,
}: AnalyticsAutomationPageProps) {
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
  const automationPath = `${basePath}/automation`

  if (!await isAnalyticsConfigured()) {
    return (
      <AnalyticsShell>
        <AnalyticsPageHeader
          range={range}
          rangeBasePath={automationPath}
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

  const queryScope = { range: toQueryRange(range), entryDomain, timeZone }
  const automation = toAutomationViewModel(await getAnalyticsAutomationOverview(queryScope))

  return (
    <AnalyticsShell
      navigation={
        <AnalyticsRouteNavigation
          basePath={basePath}
          range={range}
          scope={automation.scope}
          isAutomationActive
        />
      }
    >
      <AnalyticsPageHeader
        entryDomain={automation.scope.entryDomain}
        range={range}
        rangeBasePath={automationPath}
        showRefresh={!authorization.isReadOnly}
      />
      {automation.hasData ? (
        <AnalyticsAutomationDashboard
          data={automation}
          detailBasePath={basePath}
          locale={locale}
          range={range}
          timeZone={timeZone}
        />
      ) : (
        <AnalyticsStatePanel
          title={t("automation.states.emptyTitle")}
          description={t("automation.states.emptyDescription")}
          action={{
            href: buildAnalyticsHref(basePath, {
              entryDomain: automation.scope.entryDomain,
              range,
            }),
            label: t("navigation.overview"),
          }}
        />
      )}
    </AnalyticsShell>
  )
}
