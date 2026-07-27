import "server-only";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { readInstanceSecret } from "@/lib/configuration/instance-secret";

import { resolveTokenGitHubUserId } from "./token-authorization";

export async function getSetupRequestGitHubUserId(
  request: NextRequest,
): Promise<string | null> {
  const secret = readInstanceSecret();
  if (!secret) {
    return null;
  }

  try {
    const token = await getToken({ req: request, secret });
    return resolveTokenGitHubUserId(token) ?? null;
  } catch {
    return null;
  }
}
