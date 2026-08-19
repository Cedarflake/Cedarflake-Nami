import assert from "node:assert/strict"
import test from "node:test"

import {
  assertAnalyticsSinkContract,
  assertPluginManifest,
} from "@nami/plugin-testkit"

import {
  defaultHttpAnalyticsSinkConfig,
  resolveHttpAnalyticsSinkConfig,
} from "../src/config"
import { httpAnalyticsSinkManifest } from "../src/manifest"
import { createHttpAnalyticsSink } from "../src/runtime"

test("declares a valid HTTP sink manifest", () => {
  assertPluginManifest(httpAnalyticsSinkManifest)
})

test("bounds delivery attempts and timeouts when resolving direct input", () => {
  assert.deepEqual(resolveHttpAnalyticsSinkConfig({
    maximumDeliveryAttempts: 6,
    requestTimeoutMs: 5_001,
  }), defaultHttpAnalyticsSinkConfig)
})

test("signs and delivers an analytics event", async () => {
  let received = false
  const sink = createHttpAnalyticsSink<{ eventKind: string; eventId: string }, {
    completedAt: number
    endpoint: string
    fetchImpl: typeof fetch
    writeKey?: string
  }>({ maximumDeliveryAttempts: 2, requestTimeoutMs: 5_000 })

  await assertAnalyticsSinkContract({
    sink,
    event: { eventKind: "link", eventId: "event-1" },
    context: {
      completedAt: 1_000,
      endpoint: "https://collector.example/events",
      writeKey: "0123456789abcdef0123456789abcdef",
      async fetchImpl(input, init) {
        assert.equal(String(input), "https://collector.example/events")
        assert.equal(init?.redirect, "manual")
        assert.match(
          new Headers(init?.headers).get("x-analytics-signature") ?? "",
          /^sha256=[a-f0-9]{64}$/,
        )
        received = true
        return new Response(null, { status: 204 })
      },
    },
    verify() {
      assert.equal(received, true)
    },
  })
})

test("retries only transient collector failures", async () => {
  let attempts = 0
  const sink = createHttpAnalyticsSink({
    maximumDeliveryAttempts: 2,
    requestTimeoutMs: 5_000,
  })

  await sink.emit(
    { eventKind: "runtime" },
    {
      completedAt: 1_000,
      endpoint: "https://collector.example/events",
      writeKey: "0123456789abcdef0123456789abcdef",
      async fetchImpl() {
        attempts += 1
        return new Response(null, { status: attempts === 1 ? 503 : 204 })
      },
    },
  )

  assert.equal(attempts, 2)
})

test("aborts a stalled collector request after the configured timeout", async () => {
  const sink = createHttpAnalyticsSink({
    maximumDeliveryAttempts: 1,
    requestTimeoutMs: 100,
  })

  await assert.rejects(() => sink.emit(
    { eventKind: "runtime" },
    {
      completedAt: 1_000,
      endpoint: "https://collector.example/events",
      writeKey: "0123456789abcdef0123456789abcdef",
      fetchImpl(_input, init) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"))
          }, { once: true })
        })
      },
    },
  ), { name: "AbortError" })
})
