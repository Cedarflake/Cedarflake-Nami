export type RouteMode = "string" | "object" | "array";
export type DestinationKey = "target" | "to" | "url";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeStatus(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

export function normalizePriority(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

export function getMode(value: unknown): RouteMode {
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  return "string";
}

export function getRouteDescription(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isRecord(candidate) ? asString(candidate.description).trim() : "";
}

export function getTargetFaviconUrl(target: string): string | null {
  try {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return `https://unavatar.webp.se/${encodeURIComponent(url.hostname)}?fallback=false`;
  } catch {
    return null;
  }
}

export function stripRetiredProxyPolicy(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripRetiredProxyPolicy);
  }
  if (!isRecord(value)) {
    return value;
  }

  const next = { ...value };
  delete next.proxyPolicy;
  return next;
}

export function setRouteDescription(
  value: unknown,
  description: string,
): unknown {
  const normalizedDescription = description.trim();

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return normalizedDescription
        ? [setRouteDescription("", normalizedDescription)]
        : value;
    }
    const [first, ...remaining] = value;
    const nextFirst = setRouteDescription(first, normalizedDescription);
    return [nextFirst, ...remaining];
  }

  if (isRecord(value)) {
    const next = { ...value };
    if (normalizedDescription) {
      next.description = normalizedDescription;
    } else {
      delete next.description;
    }
    return next;
  }

  if (!normalizedDescription) {
    return value;
  }

  return {
    ...setExclusiveDestination(
      createEmptyConfig(),
      "target",
      asString(value).trim(),
    ),
    description: normalizedDescription,
  };
}

export function createAnalyticsId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "00000000-0000-4000-8000-000000000000".replace(/[08]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const digit = Number(character);
    return (digit ^ (randomValue & (15 >> (digit / 4)))).toString(16);
  });
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function createDeterministicAnalyticsId(seed: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    throw new Error("Web Crypto is required to generate stable analytics IDs");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(seed),
  );
  const bytes = new Uint8Array(digest.slice(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}

export async function ensureAnalyticsId(
  config: Record<string, unknown>,
  identitySeed: string,
): Promise<Record<string, unknown>> {
  if (typeof config.analyticsId === "string" && config.analyticsId.trim() !== "") {
    return config;
  }

  return {
    ...config,
    analyticsId: await createDeterministicAnalyticsId(identitySeed),
  };
}

export function createEmptyConfig(): Record<string, unknown> {
  return {
    analyticsId: createAnalyticsId(),
    type: "prefix",
    target: "",
    appendPath: true,
  };
}

export function getDestinationKey(config: Record<string, unknown>): DestinationKey {
  if (typeof config.target === "string") return "target";
  if (typeof config.to === "string") return "to";
  if (typeof config.url === "string") return "url";
  return "target";
}

export function setExclusiveDestination(
  config: Record<string, unknown>,
  key: DestinationKey,
  value: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...config };
  delete next.target;
  delete next.to;
  delete next.url;
  next[key] = value;
  return next;
}
