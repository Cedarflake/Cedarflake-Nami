import type { JWT } from "next-auth/jwt";

import type { WebUiAccessMode } from "@nami/config";

const githubUserIdPattern = /^[1-9]\d*$/;

export type AuthorizedWebUiToken = JWT & { accessToken: string };

export function isValidGitHubUserId(
  githubUserId: string | null | undefined,
): githubUserId is string {
  return Boolean(githubUserId && githubUserIdPattern.test(githubUserId));
}

export function resolveTokenGitHubUserId(
  token: JWT | null,
): string | undefined {
  if (isValidGitHubUserId(token?.githubUserId)) {
    return token.githubUserId;
  }

  // NextAuth's JWT strategy stored the GitHub profile ID in sub before githubUserId existed.
  return isValidGitHubUserId(token?.sub) ? token.sub : undefined;
}

export function migrateTokenGitHubUserId(token: JWT): void {
  const githubUserId = resolveTokenGitHubUserId(token);
  if (githubUserId) {
    token.githubUserId = githubUserId;
  }
}

export function hasWebUiAccessToken(
  token: JWT | null,
): token is AuthorizedWebUiToken {
  return typeof token?.accessToken === "string" && token.accessToken.length > 0;
}

export function canGitHubUserSignInForAccessMode(
  githubUserId: string | null | undefined,
  mode: WebUiAccessMode,
  managerGitHubUserIds: ReadonlySet<string>,
  blockedGitHubUserIds: ReadonlySet<string>,
): boolean {
  if (!isValidGitHubUserId(githubUserId)) {
    return false;
  }

  if (
    mode !== "allowlist"
    && blockedGitHubUserIds.has(githubUserId)
  ) {
    return false;
  }

  return mode === "authenticated"
    || mode === "public-readonly"
    || managerGitHubUserIds.has(githubUserId);
}

export function isGitHubUserManagerForAccessMode(
  githubUserId: string | null | undefined,
  mode: WebUiAccessMode,
  managerGitHubUserIds: ReadonlySet<string>,
  blockedGitHubUserIds: ReadonlySet<string>,
): boolean {
  if (!isValidGitHubUserId(githubUserId)) {
    return false;
  }

  if (
    mode !== "allowlist"
    && blockedGitHubUserIds.has(githubUserId)
  ) {
    return false;
  }

  return mode === "authenticated" || managerGitHubUserIds.has(githubUserId);
}

export function isTokenBlockedForAccessMode(
  token: JWT | null,
  mode: WebUiAccessMode,
  blockedGitHubUserIds: ReadonlySet<string>,
): boolean {
  const githubUserId = resolveTokenGitHubUserId(token);
  return mode !== "allowlist"
    && githubUserId !== undefined
    && blockedGitHubUserIds.has(githubUserId);
}

export function isTokenAuthorizedForAccessMode(
  token: JWT | null,
  mode: WebUiAccessMode,
  managerGitHubUserIds: ReadonlySet<string>,
  blockedGitHubUserIds: ReadonlySet<string>,
): token is AuthorizedWebUiToken {
  if (!hasWebUiAccessToken(token)) {
    return false;
  }

  if (isTokenBlockedForAccessMode(token, mode, blockedGitHubUserIds)) {
    return false;
  }

  if (mode === "authenticated") {
    return resolveTokenGitHubUserId(token) !== undefined;
  }

  return isGitHubUserManagerForAccessMode(
    resolveTokenGitHubUserId(token),
    mode,
    managerGitHubUserIds,
    blockedGitHubUserIds,
  );
}

export function applyWebUiTokenAuthorization(
  token: JWT,
  mode: WebUiAccessMode,
  managerGitHubUserIds: ReadonlySet<string>,
  blockedGitHubUserIds: ReadonlySet<string>,
): boolean {
  migrateTokenGitHubUserId(token);
  const isAuthorized = isTokenAuthorizedForAccessMode(
    token,
    mode,
    managerGitHubUserIds,
    blockedGitHubUserIds,
  );

  if (!isAuthorized) {
    delete token.accessToken;
  }

  return isAuthorized;
}
