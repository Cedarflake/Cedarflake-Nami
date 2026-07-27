import "server-only";

import type { JWT } from "next-auth/jwt";

import type { DataConfig, WebUiAccessMode } from "@i0c/config";

import { getAuthoritativeDataConfig } from "@/lib/configuration/data-config";
import { getAppSetupState } from "@/lib/setup/setup-state";

import {
  applyWebUiTokenAuthorization as applyTokenAuthorization,
  canGitHubUserSignInForAccessMode,
  isGitHubUserManagerForAccessMode,
  isTokenBlockedForAccessMode,
  isTokenAuthorizedForAccessMode,
  isValidGitHubUserId,
  migrateTokenGitHubUserId,
} from "./token-authorization";

export { hasWebUiAccessToken } from "./token-authorization";

interface WebUiAccessPolicy {
  mode: WebUiAccessMode;
  managerGitHubUserIds: ReadonlySet<string>;
  blockedGitHubUserIds: ReadonlySet<string>;
}

function parseGitHubUserIds(
  values: readonly string[],
  configPath: string,
): ReadonlySet<string> {
  if (values.some((value) => !isValidGitHubUserId(value))) {
    throw new Error(
      `config.json ${configPath} must contain GitHub numeric user IDs`,
    );
  }

  return new Set(values);
}

async function readWebUiAccessPolicy(): Promise<WebUiAccessPolicy | null> {
  let config: DataConfig;
  try {
    config = await getAuthoritativeDataConfig();
  } catch (error) {
    const setupState = await getAppSetupState();
    if (
      setupState.state !== "initialized"
      && setupState.state !== "unsupported"
    ) {
      return null;
    }
    throw error;
  }
  const mode: WebUiAccessMode = config.webui.access.mode;
  const managerGitHubUserIds = parseGitHubUserIds(
    config.webui.access.managerGitHubUserIds,
    "webui.access.managerGitHubUserIds",
  );
  const blockedGitHubUserIds = parseGitHubUserIds(
    config.webui.access.blockedGitHubUserIds ?? [],
    "webui.access.blockedGitHubUserIds",
  );

  if (mode === "allowlist" && managerGitHubUserIds.size === 0) {
    throw new Error(
      "config.json webui.access.managerGitHubUserIds is required in allowlist mode",
    );
  }

  return {
    mode,
    managerGitHubUserIds,
    blockedGitHubUserIds,
  };
}

export async function isWebUiPublicReadOnly(): Promise<boolean> {
  const accessPolicy = await readWebUiAccessPolicy();
  return accessPolicy?.mode === "public-readonly";
}

export async function canGitHubUserSignIn(
  githubUserId: string | null | undefined,
): Promise<boolean> {
  const accessPolicy = await readWebUiAccessPolicy();
  if (!accessPolicy) {
    return isValidGitHubUserId(githubUserId);
  }
  return canGitHubUserSignInForAccessMode(
    githubUserId,
    accessPolicy.mode,
    accessPolicy.managerGitHubUserIds,
    accessPolicy.blockedGitHubUserIds,
  );
}

export async function isGitHubUserManager(
  githubUserId: string | null | undefined,
): Promise<boolean> {
  const accessPolicy = await readWebUiAccessPolicy();
  if (!accessPolicy) {
    return false;
  }
  return isGitHubUserManagerForAccessMode(
    githubUserId,
    accessPolicy.mode,
    accessPolicy.managerGitHubUserIds,
    accessPolicy.blockedGitHubUserIds,
  );
}

export interface WebUiTokenAuthorization {
  isAuthorized: boolean;
  isBlocked: boolean;
}

export async function getWebUiTokenAuthorization(
  token: JWT | null,
): Promise<WebUiTokenAuthorization> {
  const accessPolicy = await readWebUiAccessPolicy();
  if (!accessPolicy) {
    return {
      isAuthorized: false,
      isBlocked: false,
    };
  }
  return {
    isAuthorized: isTokenAuthorizedForAccessMode(
      token,
      accessPolicy.mode,
      accessPolicy.managerGitHubUserIds,
      accessPolicy.blockedGitHubUserIds,
    ),
    isBlocked: isTokenBlockedForAccessMode(
      token,
      accessPolicy.mode,
      accessPolicy.blockedGitHubUserIds,
    ),
  };
}

export async function applyWebUiTokenAuthorization(token: JWT): Promise<boolean> {
  const accessPolicy = await readWebUiAccessPolicy();
  if (!accessPolicy) {
    migrateTokenGitHubUserId(token);
    return false;
  }
  return applyTokenAuthorization(
    token,
    accessPolicy.mode,
    accessPolicy.managerGitHubUserIds,
    accessPolicy.blockedGitHubUserIds,
  );
}
