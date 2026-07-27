import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiManagementRequestAuthorization,
} from "@/auth/authorization";
import {
  adoptDataConfigCache,
  parseDataConfig,
} from "@/lib/configuration/data-config";
import {
  APP_DATA_CONFIG_CACHE_TAG,
  APP_DATA_SNAPSHOT_CACHE_TAG,
} from "@/lib/data/documents";
import { createDataRepositoryErrorResponse } from "@/lib/data/errors";
import {
  parseDataDocumentKind,
  requireAppDataRepositoryManagement,
} from "@/lib/data/management";
import { validateRedirectConfig } from "@/lib/redirects/config-validation";

const restoreSchema = z.object({
  expectedRevision: z.string().regex(/^(?:0|[1-9]\d*)$/),
});

interface RestoreRouteContext {
  params: Promise<{
    kind: string;
    revision: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RestoreRouteContext,
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
  const parsed = restoreSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const management = await requireAppDataRepositoryManagement();
    const source = await management.readRevision({
      kind,
      revision: params.revision,
    });
    const restoredConfig = validateRestoredContent(kind, source.content);
    const result = await management.restore({
      actorGitHubUserId: authorization.githubUserId,
      expectedRevision: parsed.data.expectedRevision,
      kind,
      revision: params.revision,
    });
    revalidateTag(APP_DATA_SNAPSHOT_CACHE_TAG, { expire: 0 });
    if (kind === "config" && restoredConfig) {
      revalidateTag(APP_DATA_CONFIG_CACHE_TAG, { expire: 0 });
      adoptDataConfigCache(restoredConfig);
    }
    return NextResponse.json(result);
  } catch (error) {
    const repositoryResponse = createDataRepositoryErrorResponse(error);
    if (repositoryResponse) {
      return repositoryResponse;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function validateRestoredContent(
  kind: "config" | "redirects",
  content: string,
) {
  if (kind === "config") {
    return parseDataConfig(content);
  }
  const value = JSON.parse(content) as unknown;
  const result = validateRedirectConfig(value);
  if (result.status !== "valid") {
    throw new Error("The selected redirects revision is no longer valid");
  }
  return null;
}
