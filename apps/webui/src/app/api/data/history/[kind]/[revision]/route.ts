import { type NextRequest, NextResponse } from "next/server";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiManagementRequestAuthorization,
} from "@/auth/authorization";
import {
  parseDataDocumentKind,
  requireAppDataRepositoryManagement,
} from "@/lib/data/management";

interface RevisionRouteContext {
  params: Promise<{
    kind: string;
    revision: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RevisionRouteContext,
) {
  const authorization = await getWebUiManagementRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }
  const params = await context.params;
  const kind = parseDataDocumentKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown data document kind" }, { status: 404 });
  }

  try {
    const management = await requireAppDataRepositoryManagement();
    const revision = await management.readRevision({
      kind,
      revision: params.revision,
    });
    return NextResponse.json(
      { revision },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
