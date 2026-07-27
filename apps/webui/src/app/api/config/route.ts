import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createWebUiAuthorizationErrorResponse,
  getWebUiManagementRequestAuthorization,
  getWebUiReadRequestAuthorization,
} from "@/auth/authorization";
import { getEffectiveDataConfig } from "@/lib/configuration/data-config";
import {
  APP_DATA_SNAPSHOT_CACHE_TAG,
  getRedirectsDocument,
  updateRedirectsDocument,
} from "@/lib/data/documents";
import { createDataRepositoryErrorResponse } from "@/lib/data/errors";
import { validateRedirectConfig } from "@/lib/redirects/config-validation";

export async function GET(request: NextRequest) {
  const authorization = await getWebUiReadRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }

  const sourceUrl = new URL(request.url).searchParams.get("sourceUrl") ?? undefined;
  if (authorization.isReadOnly && sourceUrl) {
    return NextResponse.json(
      { error: "Custom rules JSON URLs are unavailable in public read-only mode" },
      { status: 400 },
    );
  }

  const accessToken = authorization.isReadOnly
    ? undefined
    : authorization.accessToken;

  try {
    const config = await getRedirectsDocument(accessToken, { sourceUrl });
    const dataConfig = await getEffectiveDataConfig();
    return NextResponse.json({
      config,
      runtime: {
        canonicalOrigin: dataConfig.runtime.canonicalOrigin,
      },
    });
  } catch (error) {
    const repositoryResponse = createDataRepositoryErrorResponse(error);
    if (repositoryResponse) {
      return repositoryResponse;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const updateSchema = z.object({
  content: z.string().min(2, { message: "Config content is required" }),
  expectedRevision: z.string().min(1, { message: "Missing config revision" }),
  message: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().min(8).max(2048).optional()
});

export async function PUT(request: NextRequest) {
  const authorization = await getWebUiManagementRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let config: unknown;
  try {
    config = JSON.parse(parsed.data.content);
  } catch {
    return NextResponse.json({ error: "Config content must be valid JSON" }, { status: 400 });
  }

  const validation = validateRedirectConfig(config);
  if (validation.status === "unavailable") {
    console.error("Redirect config schema could not be loaded", validation.error);
    return NextResponse.json(
      { error: "Redirect config validation is unavailable" },
      { status: 500 },
    );
  }
  if (validation.status === "invalid") {
    const shownIssues = validation.issues
      .slice(0, 5)
      .map((issue) => `${issue.path}: ${issue.message}`);
    const remainingCount = validation.issues.length - shownIssues.length;
    const details = [
      ...shownIssues,
      ...(remainingCount > 0 ? [`and ${remainingCount} more`] : []),
    ].join("; ");
    return NextResponse.json(
      { error: `Redirect config schema validation failed: ${details}` },
      { status: 400 },
    );
  }

  try {
    const result = await updateRedirectsDocument(
      authorization.accessToken,
      {
        ...parsed.data,
        actorGitHubUserId: authorization.githubUserId,
      },
    );
    revalidateTag(APP_DATA_SNAPSHOT_CACHE_TAG, { expire: 0 });
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
