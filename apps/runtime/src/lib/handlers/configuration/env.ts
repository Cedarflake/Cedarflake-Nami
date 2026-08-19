/**
 * @file env.ts
 * @description
 * [EN] Runtime secret binding abstraction.
 * Reads secret values safely across Node.js and edge platform bindings.
 *
 * [CN] Runtime 密钥绑定抽象层。
 * 在 Node.js 与边缘平台绑定中安全读取密钥值。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

declare const process: undefined | { env?: Record<string, string | undefined> };

export function readEnvVar(key: string): string | undefined {
  if (typeof process !== "undefined" && process?.env) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  if (typeof globalThis === "object" && globalThis) {
    const raw = (globalThis as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.length > 0) {
      return raw;
    }
  }

  return undefined;
}

export function readBindingVar(bindings: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!bindings) {
    return undefined;
  }
  const raw = bindings[key];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export function readRuntimeSecret(
  bindings: Record<string, unknown> | undefined,
  key: string,
  readEnvironment?: (name: string) => unknown
): string | undefined {
  const platformValue = readEnvironment?.(key);
  return readBindingVar(bindings, key)
    ?? (typeof platformValue === "string" && platformValue.length > 0
      ? platformValue
      : undefined)
    ?? readEnvVar(key);
}
