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
import { requireAppDataRepositoryManagement } from "@/lib/data/management";
import { validateRedirectConfig } from "@/lib/redirects/config-validation";

const maximumDocumentSize = 1_000_000;
const importSchema = z.object({
  configContent: z.string().min(2).max(maximumDocumentSize),
  expectedConfigRevision: z.string().regex(/^[1-9]\d*$/),
  expectedRedirectsRevision: z.string().regex(/^[1-9]\d*$/),
  redirectsContent: z.string().min(2).max(maximumDocumentSize),
});

export async function POST(request: NextRequest) {
  const authorization = await getWebUiManagementRequestAuthorization(request);
  if (authorization.status !== "authorized") {
    return createWebUiAuthorizationErrorResponse(authorization.status);
  }
  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const config = parseDataConfig(parsed.data.configContent);
    validateRedirectsContent(parsed.data.redirectsContent);
    const management = await requireAppDataRepositoryManagement();
    const snapshot = await management.importSnapshot({
      actorGitHubUserId: authorization.githubUserId,
      ...parsed.data,
    });
    revalidateTag(APP_DATA_CONFIG_CACHE_TAG, { expire: 0 });
    revalidateTag(APP_DATA_SNAPSHOT_CACHE_TAG, { expire: 0 });
    adoptDataConfigCache(config);
    return NextResponse.json({
      revisions: {
        config: snapshot.config.revision,
        redirects: snapshot.redirects.revision,
      },
    });
  } catch (error) {
    const repositoryResponse = createDataRepositoryErrorResponse(error);
    if (repositoryResponse) {
      return repositoryResponse;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function validateRedirectsContent(content: string): void {
  const value = JSON.parse(content) as unknown;
  const result = validateRedirectConfig(value);
  if (result.status === "unavailable") {
    throw new Error("Redirect validation is unavailable");
  }
  if (result.status === "invalid") {
    throw new Error(
      result.issues
        .slice(0, 5)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; "),
    );
  }
}
