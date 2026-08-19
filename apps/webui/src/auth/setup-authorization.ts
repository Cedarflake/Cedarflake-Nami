import "server-only";

import type { NextRequest } from "next/server";

import { readInstanceSecret } from "@/lib/configuration/instance-secret";

import { authSessionCookie } from "./config";
import { getSetupTokenGitHubUserId } from "./setup-token-authorization";

export async function getSetupRequestGitHubUserId(
  request: NextRequest,
): Promise<string | null> {
  const secret = readInstanceSecret();
  if (!secret) {
    return null;
  }

  return getSetupTokenGitHubUserId(
    request,
    secret,
    authSessionCookie.name,
  );
}
