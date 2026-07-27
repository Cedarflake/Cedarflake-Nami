import { type NextRequest, NextResponse } from "next/server";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiManagementRequestAuthorization,
} from "@/auth/authorization";
import {
  getAppDataConfigDocument,
  getRedirectsDocument,
} from "@/lib/data/documents";
import { parseDataDocumentKind } from "@/lib/data/management";

interface ExportRouteContext {
  params: Promise<{
    kind: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: ExportRouteContext,
) {
  const authorization = await getWebUiManagementRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }
  const kind = parseDataDocumentKind((await context.params).kind);
  if (!kind) {
    return NextResponse.json({ error: "Unknown data document kind" }, { status: 404 });
  }

  try {
    const document = kind === "config"
      ? await getAppDataConfigDocument(authorization.accessToken)
      : await getRedirectsDocument(authorization.accessToken);
    return new NextResponse(document.content, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${kind}.json"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
