import { type NextRequest, NextResponse } from "next/server";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiReadRequestAuthorization,
} from "@/auth/authorization";
import { createPrivateAnalyticsJsonResponse } from "@/lib/analytics/api-response";
import { parseAnalyticsQueryScope } from "@/lib/analytics/query-input";
import { getAnalyticsDetail, isAnalyticsConfigured } from "@/lib/analytics/queries";
import { analyticsTimeZoneCookieName } from "@/lib/analytics/time-zone-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ analyticsId: string }>;
}

function isValidAnalyticsId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

export async function GET(request: NextRequest, context: RouteContext) {
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

  const { analyticsId } = await context.params;
  if (!isValidAnalyticsId(analyticsId)) {
    return NextResponse.json({ error: "Invalid analytics ID" }, { status: 400 });
  }

  if (!await isAnalyticsConfigured()) {
    return NextResponse.json({ error: "Analytics is not configured" }, { status: 503 });
  }

  try {
    const detail = await getAnalyticsDetail(analyticsId, scope);
    if (!detail) {
      return NextResponse.json({ error: "Analytics link was not found" }, { status: 404 });
    }

    return createPrivateAnalyticsJsonResponse(detail);
  } catch (error) {
    console.error("Failed to query analytics detail", error);
    return NextResponse.json({ error: "Analytics detail could not be loaded" }, { status: 500 });
  }
}
