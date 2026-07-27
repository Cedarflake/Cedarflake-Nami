import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiManagementRequestAuthorization,
  getWebUiReadRequestAuthorization,
} from "@/auth/authorization";
import {
  adoptDataConfigCache,
  parseDataConfig,
  readRawDataConfigDocument,
} from "@/lib/configuration/data-config";
import {
  APP_DATA_CONFIG_CACHE_TAG,
  APP_DATA_SNAPSHOT_CACHE_TAG,
  updateAppDataConfigDocument,
} from "@/lib/data/documents";
import { createDataRepositoryErrorResponse } from "@/lib/data/errors";

const updateSchema = z.object({
  content: z.string().min(2, { message: "Config content is required" }),
  expectedRevision: z.string().min(1, { message: "Missing config revision" }),
  message: z.string().min(1).max(200).optional(),
});

export async function GET(request: NextRequest) {
  const authorization = await getWebUiReadRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }

  const accessToken = authorization.isReadOnly
    ? undefined
    : authorization.accessToken;

  try {
    const document = await readRawDataConfigDocument(accessToken);
    return NextResponse.json({ document });
  } catch (error) {
    const repositoryResponse = createDataRepositoryErrorResponse(error);
    if (repositoryResponse) {
      return repositoryResponse;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authorization = await getWebUiManagementRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let config: ReturnType<typeof parseDataConfig>;
  try {
    config = parseDataConfig(parsed.data.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid instance config";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await updateAppDataConfigDocument(
      authorization.accessToken,
      {
        ...parsed.data,
        actorGitHubUserId: authorization.githubUserId,
      },
    );
    revalidateTag(APP_DATA_CONFIG_CACHE_TAG, { expire: 0 });
    revalidateTag(APP_DATA_SNAPSHOT_CACHE_TAG, { expire: 0 });
    adoptDataConfigCache(config);
    return NextResponse.json(result);
  } catch (error) {
    const repositoryResponse = createDataRepositoryErrorResponse(error);
    if (repositoryResponse) {
      return repositoryResponse;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
