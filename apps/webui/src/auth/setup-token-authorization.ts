import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { resolveTokenGitHubUserId } from "./token-authorization";

export async function getSetupTokenGitHubUserId(
  request: NextRequest,
  secret: string,
  cookieName: string,
): Promise<string | null> {
  try {
    const token = await getToken({
      req: request,
      secret,
      cookieName,
    });
    return resolveTokenGitHubUserId(token) ?? null;
  } catch {
    return null;
  }
}
