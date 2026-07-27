import { type NextRequest, NextResponse } from "next/server";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiManagementRequestAuthorization,
} from "@/auth/authorization";
import {
  parseDataDocumentKind,
  requireAppDataRepositoryManagement,
} from "@/lib/data/management";

interface HistoryRouteContext {
  params: Promise<{
    kind: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: HistoryRouteContext,
) {
  const authorization = await getWebUiManagementRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }
  const kind = parseDataDocumentKind((await context.params).kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown data document kind" }, { status: 404 });
  }
  const beforeRevision =
    new URL(request.url).searchParams.get("beforeRevision") ?? undefined;

  try {
    const management = await requireAppDataRepositoryManagement();
    const revisions = await management.listRevisions({
      beforeRevision,
      kind,
      limit: 50,
    });
    return NextResponse.json(
      { revisions },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
