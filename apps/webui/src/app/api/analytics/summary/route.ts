import { type NextRequest, NextResponse } from "next/server";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiReadRequestAuthorization,
} from "@/auth/authorization";
import { createPrivateAnalyticsJsonResponse } from "@/lib/analytics/api-response";
import { parseAnalyticsQueryScope } from "@/lib/analytics/query-input";
import { getAnalyticsOverview, isAnalyticsConfigured } from "@/lib/analytics/queries";
import { analyticsTimeZoneCookieName } from "@/lib/analytics/time-zone-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await getWebUiReadRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }

  const scope = parseAnalyticsQueryScope(
    request.nextUrl.searchParams,
    request.cookies.get(analyticsTimeZoneCookieName)?.value,
  );
  if (!scope) {
    return NextResponse.json({ error: "Range must be one of 1d, 7d, 30d, or 90d" }, { status: 400 });
  }

  if (!await isAnalyticsConfigured()) {
    return NextResponse.json({ error: "Analytics is not configured" }, { status: 503 });
  }

  try {
    return createPrivateAnalyticsJsonResponse(await getAnalyticsOverview(scope));
  } catch (error) {
    console.error("Failed to query analytics summary", error);
    return NextResponse.json({ error: "Analytics summary could not be loaded" }, { status: 500 });
  }
}
