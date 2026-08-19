import "server-only";

export const instanceSecretEnvironmentKey = "NAMI_SECRET";

export function readInstanceSecret(): string | null {
  const secret = process.env[instanceSecretEnvironmentKey]?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function requireInstanceSecret(): string {
  const secret = readInstanceSecret();
  if (!secret) {
    throw new Error(
      `${instanceSecretEnvironmentKey} must contain at least 32 characters`,
    );
  }
  return secret;
}
