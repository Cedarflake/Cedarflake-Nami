import { createHmac, timingSafeEqual } from "node:crypto";

import {
  analyticsEventSchema,
  type AnalyticsWireEvent,
} from "@nami/analytics-domain/events";

const maximumBodyBytes = 16 * 1024;
const signatureWindowSeconds = 5 * 60;

class BodyTooLargeError extends Error {}

export type AnalyticsIngestRequestResult =
  | {
      event: AnalyticsWireEvent;
      status: "accepted";
    }
  | {
      error: string;
      httpStatus: number;
      status: "rejected";
    };

export async function parseAnalyticsIngestRequest(
  request: Request,
  secret: string,
  now = Date.now(),
): Promise<AnalyticsIngestRequestResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    return reject(415, "Content-Type must be application/json");
  }

  const timestampHeader = request.headers.get("x-analytics-timestamp");
  const timestamp = parseTimestamp(timestampHeader);
  if (timestamp === null || !isCurrentTimestamp(timestamp, now)) {
    return reject(401, "Invalid analytics signature");
  }

  let body: Uint8Array;
  try {
    body = await readLimitedBody(request);
  } catch (error) {
    return error instanceof BodyTooLargeError
      ? reject(413, "Request body is too large")
      : reject(400, "Invalid request body");
  }

  if (!hasValidSignature(
    secret,
    timestampHeader ?? "",
    body,
    request.headers.get("x-analytics-signature"),
  )) {
    return reject(401, "Invalid analytics signature");
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return reject(400, "Invalid JSON payload");
  }

  const parsed = analyticsEventSchema.safeParse(json);
  if (!parsed.success) {
    return reject(400, "Invalid analytics event");
  }
  if (!isEventTimestampValid(parsed.data.occurredAt, timestamp)) {
    return reject(400, "Analytics event timestamp is outside the allowed window");
  }

  return { event: parsed.data, status: "accepted" };
}

async function readLimitedBody(request: Request): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBodyBytes) {
    throw new BodyTooLargeError("Request body is too large");
  }

  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maximumBodyBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError("Request body is too large");
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

function parseTimestamp(value: string | null): number | null {
  if (!value || !/^\d{1,12}$/.test(value)) {
    return null;
  }

  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function isCurrentTimestamp(timestamp: number, now: number): boolean {
  const currentTimestamp = Math.floor(now / 1000);
  return Math.abs(currentTimestamp - timestamp) <= signatureWindowSeconds;
}

function hasValidSignature(
  secret: string,
  timestampHeader: string,
  body: Uint8Array,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader || !/^sha256=[0-9a-f]{64}$/i.test(signatureHeader)) {
    return false;
  }

  const supplied = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}.`)
    .update(body)
    .digest();

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function isEventTimestampValid(occurredAt: string, signedTimestamp: number): boolean {
  const eventTimestamp = Date.parse(occurredAt);
  return (
    Number.isFinite(eventTimestamp) &&
    Math.abs(eventTimestamp - signedTimestamp * 1000) <= signatureWindowSeconds * 1000
  );
}

function reject(httpStatus: number, error: string): AnalyticsIngestRequestResult {
  return { error, httpStatus, status: "rejected" };
}
