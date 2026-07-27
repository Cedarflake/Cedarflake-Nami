import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { readInstanceSecret } from "@/lib/configuration/instance-secret";

const minimumSetupSecretLength = 32;

export function isSetupSecretConfigured(): boolean {
  return readSetupSecret() !== null;
}

export function verifySetupSecret(candidate: string): boolean {
  const expected = readSetupSecret();
  if (!expected || candidate.length < minimumSetupSecretLength) {
    return false;
  }
  return timingSafeEqual(hashSecret(candidate), hashSecret(expected));
}

function readSetupSecret(): string | null {
  return readInstanceSecret();
}

function hashSecret(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
