/**
 * @file attribution.ts
 * @description
 * [EN] Signed campaign and upstream attribution for short-link requests.
 * Verifies bounded HMAC tokens, sanitizes reserved query parameters, and manages the short-lived handoff cookie.
 *
 * [CN] 短链接请求的签名渠道与上游归因。
 * 负责验证受限的 HMAC token、清理保留查询参数，并管理短期归因交接 Cookie。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { analyticsProviderSchema } from "@nami/analytics-domain";

import { normalisePath, safeDecode } from "../core/utils";
import type { AnalyticsProvider } from "../core/types";

export const ANALYTICS_ATTRIBUTION_QUERY_PARAM = "_nami_via";
export const ANALYTICS_ATTRIBUTION_COOKIE = "__Host-nami-attribution";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_TOKEN_LENGTH = 4096;
const CLOCK_SKEW_SECONDS = 60;
const COOKIE_MAX_AGE_SECONDS = 300;
const MAX_CAMPAIGN_LIFETIME_SECONDS = 365 * 24 * 60 * 60;
const MAX_UPSTREAM_LIFETIME_SECONDS = 5 * 60;
const ATTRIBUTION_KEY_CONTEXT = "nami/analytics-attribution/v1";

const importedAttributionKeys = new WeakMap<ArrayBuffer, Promise<CryptoKey>>();

interface AttributionTokenBase {
  v: 1;
  iat: number;
  exp: number;
  audHost: string;
  audPath: string;
  sourceId: string;
}

export interface CampaignAttributionToken extends AttributionTokenBase {
  kind: "campaign";
  campaignId: string;
  analyticsId: string;
}

export interface UpstreamAttributionToken extends AttributionTokenBase {
  kind: "upstream";
  upstreamEventId: string;
  upstreamAnalyticsId: string;
  upstreamEntryDomain: string;
  upstreamProvider: AnalyticsProvider;
}

export type VerifiedAttributionToken = CampaignAttributionToken | UpstreamAttributionToken;

export interface ExtractedAttributionQuery {
  sanitizedUrl: URL;
  rawToken?: string;
  hasAttributionParameter: boolean;
}

export interface UpstreamTokenInput {
  upstreamEventId: string;
  sourceId: string;
  upstreamAnalyticsId: string;
  upstreamEntryDomain: string;
  upstreamProvider: AnalyticsProvider;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actualKeys.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isProvider(value: unknown): value is AnalyticsProvider {
  return analyticsProviderSchema.safeParse(value).success;
}

function isEntryDomain(value: unknown): value is string {
  return value === "unknown" || (typeof value === "string" && value.length <= 253 && HOSTNAME_PATTERN.test(value));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - base64.length % 4) % 4)}`;
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importHmacKey(key: BufferSource): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function importAttributionKey(key: ArrayBuffer): Promise<CryptoKey> {
  const cachedKey = importedAttributionKeys.get(key);
  if (cachedKey) {
    return cachedKey;
  }

  const importedKey = importHmacKey(key);
  importedAttributionKeys.set(key, importedKey);
  void importedKey.catch(() => {
    if (importedAttributionKeys.get(key) === importedKey) {
      importedAttributionKeys.delete(key);
    }
  });
  return importedKey;
}

async function signPayloadSegment(key: ArrayBuffer, payloadSegment: string): Promise<string> {
  const cryptoKey = await importAttributionKey(key);
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(payloadSegment)
  );
  return toBase64Url(new Uint8Array(signature));
}

async function hasValidTokenSignature(
  key: ArrayBuffer,
  payloadSegment: string,
  signatureSegment: string
): Promise<boolean> {
  const signature = fromBase64Url(signatureSegment);
  if (!signature || signature.byteLength !== 32) {
    return false;
  }

  const cryptoKey = await importAttributionKey(key);
  return globalThis.crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    signature,
    new TextEncoder().encode(payloadSegment)
  );
}

function parseTokenPayload(value: unknown): VerifiedAttributionToken | null {
  if (!isRecord(value) || value.v !== 1 || !isInteger(value.iat) || !isInteger(value.exp)) {
    return null;
  }
  if (
    !isIdentifier(value.sourceId) ||
    typeof value.audHost !== "string" ||
    typeof value.audPath !== "string" ||
    normalizeAnalyticsHostname(value.audHost) !== value.audHost ||
    normalizeAnalyticsAudiencePath(value.audPath) !== value.audPath
  ) {
    return null;
  }

  if (value.kind === "campaign") {
    if (
      !hasExactKeys(value, [
        "v",
        "kind",
        "campaignId",
        "sourceId",
        "analyticsId",
        "audHost",
        "audPath",
        "iat",
        "exp"
      ]) ||
      !isIdentifier(value.campaignId) ||
      !isIdentifier(value.analyticsId)
    ) {
      return null;
    }
    return {
      v: 1,
      kind: "campaign",
      campaignId: value.campaignId,
      sourceId: value.sourceId,
      analyticsId: value.analyticsId,
      audHost: value.audHost,
      audPath: value.audPath,
      iat: value.iat,
      exp: value.exp
    };
  }

  if (value.kind === "upstream") {
    if (
      !hasExactKeys(value, [
        "v",
        "kind",
        "upstreamEventId",
        "sourceId",
        "upstreamAnalyticsId",
        "upstreamEntryDomain",
        "upstreamProvider",
        "audHost",
        "audPath",
        "iat",
        "exp"
      ]) ||
      typeof value.upstreamEventId !== "string" ||
      !UUID_PATTERN.test(value.upstreamEventId) ||
      !isIdentifier(value.upstreamAnalyticsId) ||
      !isEntryDomain(value.upstreamEntryDomain) ||
      !isProvider(value.upstreamProvider)
    ) {
      return null;
    }
    return {
      v: 1,
      kind: "upstream",
      upstreamEventId: value.upstreamEventId.toLowerCase(),
      sourceId: value.sourceId,
      upstreamAnalyticsId: value.upstreamAnalyticsId,
      upstreamEntryDomain: value.upstreamEntryDomain,
      upstreamProvider: value.upstreamProvider,
      audHost: value.audHost,
      audPath: value.audPath,
      iat: value.iat,
      exp: value.exp
    };
  }

  return null;
}

export function normalizeAnalyticsHostname(value: string): string | null {
  const candidate = value.trim().toLowerCase().replace(/\.+$/, "");
  if (!candidate || candidate.length > 253 || candidate.includes("/") || candidate.includes("@")) {
    return null;
  }

  try {
    const parsed = new URL(`https://${candidate}`);
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    if (parsed.port || parsed.pathname !== "/" || !HOSTNAME_PATTERN.test(hostname)) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

export function normalizeAnalyticsAudiencePath(value: string): string | null {
  if (!value.startsWith("/") || value.length > 2048) {
    return null;
  }
  return normalisePath(safeDecode(value));
}

export function resolveAnalyticsEntryDomain(url: URL): string {
  return normalizeAnalyticsHostname(url.hostname) ?? "unknown";
}

export async function deriveAttributionHmacKey(writeKey: string): Promise<ArrayBuffer> {
  const derivationKey = await importHmacKey(new TextEncoder().encode(writeKey));
  return globalThis.crypto.subtle.sign(
    "HMAC",
    derivationKey,
    new TextEncoder().encode(ATTRIBUTION_KEY_CONTEXT)
  );
}

export function extractAttributionQuery(url: URL): ExtractedAttributionQuery {
  const sanitizedUrl = new URL(url.toString());
  const values = sanitizedUrl.searchParams.getAll(ANALYTICS_ATTRIBUTION_QUERY_PARAM);
  sanitizedUrl.searchParams.delete(ANALYTICS_ATTRIBUTION_QUERY_PARAM);
  return {
    sanitizedUrl,
    ...(values.length === 1 ? { rawToken: values[0] } : {}),
    hasAttributionParameter: values.length > 0
  };
}

export function readAttributionCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === ANALYTICS_ATTRIBUTION_COOKIE) {
      const value = part.slice(separator + 1).trim();
      return value || undefined;
    }
  }
  return undefined;
}

export async function verifyAttributionToken(
  rawToken: string,
  key: ArrayBuffer,
  expectedSourceId: string,
  requestUrl: URL,
  nowMilliseconds: number
): Promise<VerifiedAttributionToken | null> {
  if (rawToken.length > MAX_TOKEN_LENGTH || !TOKEN_PATTERN.test(rawToken)) {
    return null;
  }

  const [payloadSegment, signatureSegment] = rawToken.split(".");
  if (!payloadSegment || !signatureSegment || !await hasValidTokenSignature(key, payloadSegment, signatureSegment)) {
    return null;
  }

  const payloadBytes = fromBase64Url(payloadSegment);
  if (!payloadBytes) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes));
  } catch {
    return null;
  }

  const payload = parseTokenPayload(parsed);
  const requestHost = normalizeAnalyticsHostname(requestUrl.hostname);
  const requestPath = normalizeAnalyticsAudiencePath(requestUrl.pathname);
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  const maximumLifetime = payload?.kind === "campaign"
    ? MAX_CAMPAIGN_LIFETIME_SECONDS
    : MAX_UPSTREAM_LIFETIME_SECONDS;
  if (
    !payload ||
    payload.sourceId !== expectedSourceId ||
    payload.audHost !== requestHost ||
    payload.audPath !== requestPath ||
    payload.iat > nowSeconds + CLOCK_SKEW_SECONDS ||
    payload.exp <= nowSeconds ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > maximumLifetime
  ) {
    return null;
  }

  return payload;
}

export async function createAttributionToken(
  payload: CampaignAttributionToken | UpstreamAttributionToken,
  key: ArrayBuffer
): Promise<string> {
  const payloadSegment = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signatureSegment = await signPayloadSegment(key, payloadSegment);
  return `${payloadSegment}.${signatureSegment}`;
}

export function createAttributionCleanupResponse(
  sanitizedUrl: URL,
  rawToken: string | undefined,
  token: VerifiedAttributionToken | null,
  nowMilliseconds: number
): Response {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Location: sanitizedUrl.toString(),
    "Referrer-Policy": "no-referrer"
  });
  if (rawToken && token) {
    const nowSeconds = Math.floor(nowMilliseconds / 1000);
    const maxAge = Math.max(1, Math.min(COOKIE_MAX_AGE_SECONDS, token.exp - nowSeconds));
    headers.append(
      "Set-Cookie",
      `${ANALYTICS_ATTRIBUTION_COOKIE}=${rawToken}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  } else {
    headers.append("Set-Cookie", createAttributionCookieDeletion());
  }
  return new Response(null, { status: 302, headers });
}

export function clearAttributionCookie(response: Response, shouldClear: boolean): Response {
  if (!shouldClear) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", createAttributionCookieDeletion());
  const hasNullBody = response.status === 101 || response.status === 204 || response.status === 205 || response.status === 304;
  return new Response(hasNullBody ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function attachUpstreamAttribution(
  response: Response,
  requestUrl: URL,
  sourceHostname: string,
  key: ArrayBuffer,
  input: UpstreamTokenInput,
  nowMilliseconds: number
): Promise<Response> {
  if (response.status < 300 || response.status >= 400 || response.status === 304) {
    return response;
  }

  const location = response.headers.get("location");
  if (!location) {
    return response;
  }

  let destination: URL;
  try {
    destination = new URL(location, requestUrl);
  } catch {
    return response;
  }

  const destinationHost = normalizeAnalyticsHostname(destination.hostname);
  const destinationPath = normalizeAnalyticsAudiencePath(destination.pathname);
  const isInternalDestination = destinationHost === sourceHostname
    || destinationHost?.endsWith(`.${sourceHostname}`) === true;
  if (
    destination.protocol !== "https:"
    || !destinationHost
    || !destinationPath
    || !isInternalDestination
  ) {
    return response;
  }

  const issuedAt = Math.floor(nowMilliseconds / 1000);
  const token = await createAttributionToken({
    v: 1,
    kind: "upstream",
    upstreamEventId: input.upstreamEventId,
    sourceId: input.sourceId,
    upstreamAnalyticsId: input.upstreamAnalyticsId,
    upstreamEntryDomain: input.upstreamEntryDomain,
    upstreamProvider: input.upstreamProvider,
    audHost: destinationHost,
    audPath: destinationPath,
    iat: issuedAt,
    exp: issuedAt + 120
  }, key);
  destination.searchParams.set(ANALYTICS_ATTRIBUTION_QUERY_PARAM, token);

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Location", destination.toString());
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function createAttributionCookieDeletion(): string {
  return `${ANALYTICS_ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
