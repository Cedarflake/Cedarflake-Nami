import "server-only";

import {
  readAnalyticsIngestSecret,
  readAnalyticsSourceId,
} from "./configuration";

const ATTRIBUTION_PARAMETER = "_nami_via";
const ATTRIBUTION_KEY_CONTEXT = "nami/analytics-attribution/v1";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CAMPAIGN_LIFETIME_SECONDS = 365 * 24 * 60 * 60;

interface CampaignTokenPayload {
  v: 1;
  kind: "campaign";
  campaignId: string;
  sourceId: string;
  analyticsId: string;
  audHost: string;
  audPath: string;
  iat: number;
  exp: number;
}

export interface CreateCampaignUrlInput {
  url: string;
  analyticsId: string;
  campaignId: string;
  lifetimeSeconds: number;
  nowSeconds?: number;
}

export class AnalyticsAttributionError extends Error {
  constructor(
    message: string,
    readonly kind: "configuration" | "validation"
  ) {
    super(message);
    this.name = "AnalyticsAttributionError";
  }
}

export async function createCampaignUrl(input: CreateCampaignUrlInput): Promise<string> {
  const sourceId = await readAnalyticsSourceId();
  const ingestSecret = readAnalyticsIngestSecret();
  if (!sourceId || !ingestSecret) {
    throw new AnalyticsAttributionError(
      "Campaign attribution is not configured",
      "configuration"
    );
  }

  if (!IDENTIFIER_PATTERN.test(input.analyticsId)) {
    throw new AnalyticsAttributionError("Invalid analytics ID", "validation");
  }
  if (!IDENTIFIER_PATTERN.test(input.campaignId)) {
    throw new AnalyticsAttributionError("Invalid campaign ID", "validation");
  }
  if (
    !Number.isInteger(input.lifetimeSeconds)
    || input.lifetimeSeconds < 1
    || input.lifetimeSeconds > MAX_CAMPAIGN_LIFETIME_SECONDS
  ) {
    throw new AnalyticsAttributionError("Invalid campaign lifetime", "validation");
  }

  const target = parseCampaignTarget(input.url);
  const hostname = normalizeHostname(target.hostname);
  if (!isAnalyticsNamespaceHostname(hostname, sourceId)) {
    throw new AnalyticsAttributionError("Campaign URL host is not allowed", "validation");
  }

  const issuedAt = Math.floor(input.nowSeconds ?? Date.now() / 1000);
  const payload: CampaignTokenPayload = {
    v: 1,
    kind: "campaign",
    campaignId: input.campaignId,
    sourceId,
    analyticsId: input.analyticsId,
    audHost: hostname,
    audPath: normalizeAudiencePath(target.pathname),
    iat: issuedAt,
    exp: issuedAt + input.lifetimeSeconds
  };
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const attributionKey = await deriveAttributionKey(ingestSecret);
  const signatureSegment = await createSignature(attributionKey, payloadSegment);

  target.searchParams.delete(ATTRIBUTION_PARAMETER);
  target.searchParams.set(ATTRIBUTION_PARAMETER, `${payloadSegment}.${signatureSegment}`);
  return target.toString();
}

function parseCampaignTarget(value: string): URL {
  try {
    const target = new URL(value);
    const isLocalHttp = target.protocol === "http:" && isLoopbackHost(target.hostname);
    if (
      (target.protocol !== "https:" && !isLocalHttp)
      || target.username
      || target.password
    ) {
      throw new Error("unsupported target URL");
    }
    return target;
  } catch {
    throw new AnalyticsAttributionError("Invalid campaign URL", "validation");
  }
}

function normalizeAudiencePath(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Keep malformed percent sequences unchanged so the Runtime can apply the same fallback.
  }

  let normalized = decoded.replace(/\/{2,}/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || "/";
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function isLoopbackHost(value: string): boolean {
  const hostname = normalizeHostname(value);
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]"
    || hostname === "::1";
}

function isAnalyticsNamespaceHostname(hostname: string, sourceId: string): boolean {
  const normalizedSourceId = normalizeHostname(sourceId);
  if (!isValidHostname(normalizedSourceId)) {
    return false;
  }
  return hostname === normalizedSourceId || hostname.endsWith(`.${normalizedSourceId}`);
}

function isValidHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) {
    return false;
  }
  return value.split(".").every((label) => (
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ));
}

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function deriveAttributionKey(secret: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(ATTRIBUTION_KEY_CONTEXT)
  );
}

async function createSignature(key: ArrayBuffer, payloadSegment: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payloadSegment));
  return encodeBase64Url(signature);
}
