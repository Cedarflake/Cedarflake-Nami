import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSetupRequestGitHubUserId } from "@/auth/setup-authorization";
import { adoptDataConfigCache } from "@/lib/configuration/data-config";
import {
  APP_DATA_CONFIG_CACHE_TAG,
  APP_DATA_SNAPSHOT_CACHE_TAG,
} from "@/lib/data/documents";
import { createDataRepositoryErrorResponse } from "@/lib/data/errors";
import {
  createInitialDocuments,
  runtimeProviders,
} from "@/lib/setup/initial-documents";
import {
  getAppSetupState,
  getDataRepositoryManagement,
} from "@/lib/setup/setup-state";
import { verifySetupSecret } from "@/lib/setup/setup-secret";

const initializeSchema = z.object({
  analyticsEnabled: z.boolean(),
  analyticsSourceId: z.string().max(253),
  runtimeOrigin: z.url(),
  runtimeProviders: z.array(z.enum(runtimeProviders)).min(1),
  setupSecret: z.string().min(32).max(1024),
  webUiOrigin: z.url(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = initializeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const githubUserId = await getSetupRequestGitHubUserId(request);
  if (!githubUserId) {
    return NextResponse.json(
      { error: "GitHub authentication is required" },
      { status: 401 },
    );
  }
  if (!verifySetupSecret(parsed.data.setupSecret)) {
    return NextResponse.json({ error: "Invalid setup secret" }, { status: 403 });
  }

  const setupState = await getAppSetupState();
  if (setupState.state !== "empty") {
    return NextResponse.json(
      { error: `Setup is unavailable while repository state is ${setupState.state}` },
      { status: 409 },
    );
  }
  const management = await getDataRepositoryManagement();
  if (!management) {
    return NextResponse.json(
      { error: "The selected data repository does not support setup" },
      { status: 501 },
    );
  }

  try {
    const documents = createInitialDocuments({
      analyticsEnabled: parsed.data.analyticsEnabled,
      analyticsSourceId: parsed.data.analyticsSourceId,
      managerGitHubUserId: githubUserId,
      runtimeOrigin: parsed.data.runtimeOrigin,
      runtimeProviders: parsed.data.runtimeProviders,
      webUiOrigin: parsed.data.webUiOrigin,
    });
    const snapshot = await management.initialize({
      actorGitHubUserId: githubUserId,
      configContent: documents.configContent,
      redirectsContent: documents.redirectsContent,
    });
    revalidateTag(APP_DATA_CONFIG_CACHE_TAG, { expire: 0 });
    revalidateTag(APP_DATA_SNAPSHOT_CACHE_TAG, { expire: 0 });
    adoptDataConfigCache(documents.config);
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
