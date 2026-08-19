import type { AnalyticsSink } from "@nami/plugin-api"

import type { HttpAnalyticsSinkConfig } from "./config"
import { httpAnalyticsSinkManifest } from "./manifest"

const encoder = new TextEncoder()

export interface HttpAnalyticsEvent {
  eventKind: string
}

export interface HttpAnalyticsSinkContext {
  completedAt: number
  endpoint: string
  fetchImpl: typeof fetch
  writeKey?: string
}

export function createHttpAnalyticsSink<
  TEvent extends HttpAnalyticsEvent,
  TContext extends HttpAnalyticsSinkContext,
>(config: HttpAnalyticsSinkConfig): AnalyticsSink<TEvent, TContext> {
  let deliveryKeyCache:
    | {
        writeKey: string
        key: Promise<CryptoKey>
      }
    | undefined

  async function getDeliveryHmacKey(writeKey: string): Promise<CryptoKey> {
    if (deliveryKeyCache?.writeKey === writeKey) {
      return deliveryKeyCache.key
    }

    const key = globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(writeKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    deliveryKeyCache = { writeKey, key }
    void key.catch(() => {
      if (deliveryKeyCache?.key === key) {
        deliveryKeyCache = undefined
      }
    })
    return key
  }

  return {
    async emit(event, context) {
      if (!context.writeKey) {
        throw new Error("analytics write key is required for HTTP delivery")
      }

      const body = JSON.stringify(event)
      const timestamp = String(Math.floor(context.completedAt / 1000))
      const cryptoKey = await getDeliveryHmacKey(context.writeKey)
      const signature = await globalThis.crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        encoder.encode(`${timestamp}.${body}`),
      )
      const signatureHeader = `sha256=${toHex(signature)}`

      for (
        let attempt = 1;
        attempt <= config.maximumDeliveryAttempts;
        attempt += 1
      ) {
        let response: Response
        try {
          response = await fetchWithTimeout(
            context,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Analytics-Timestamp": timestamp,
                "X-Analytics-Signature": signatureHeader,
              },
              body,
              redirect: "manual",
            },
            config.requestTimeoutMs,
          )
        } catch (error) {
          if (attempt === config.maximumDeliveryAttempts) {
            throw error
          }
          continue
        }

        await discardResponse(response)
        if (response.ok) {
          return
        }
        if (
          attempt === config.maximumDeliveryAttempts ||
          !isRetryableStatus(response.status)
        ) {
          throw new Error(`collector responded with ${response.status}`)
        }
      }
    },
  }
}

export const httpAnalyticsSinkPlugin = {
  manifest: httpAnalyticsSinkManifest,
  create: createHttpAnalyticsSink,
}

async function fetchWithTimeout(
  context: HttpAnalyticsSinkContext,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await context.fetchImpl(context.endpoint, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status >= 500
}

function toHex(value: ArrayBuffer): string {
  return Array.from(
    new Uint8Array(value),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")
}
