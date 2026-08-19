import assert from "node:assert/strict"
import test from "node:test"

import type { JsonObject } from "@nami/plugin-api"

import { definePluginConfiguration } from "../src/configuration"

interface RetryConfig {
  attempts: number
}

const retrySchema: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["attempts"],
  properties: {
    attempts: {
      type: "integer",
      minimum: 1,
      maximum: 5,
    },
  },
}

test("defines and validates plugin configuration", () => {
  const configuration = definePluginConfiguration<RetryConfig>({
    version: 1,
    schema: retrySchema,
    defaults: { attempts: 2 },
    resolve(value) {
      return {
        attempts: typeof value?.attempts === "number"
          ? value.attempts
          : 2,
      }
    },
  })

  assert.deepEqual(configuration.manifest, {
    version: 1,
    schema: retrySchema,
  })
  assert.deepEqual(configuration.resolve({ attempts: 4 }), { attempts: 4 })
  assert.deepEqual(configuration.resolve(undefined), { attempts: 2 })
})

test("rejects defaults and resolved values outside the Schema", () => {
  assert.throws(() => definePluginConfiguration<RetryConfig>({
    version: 1,
    schema: retrySchema,
    defaults: { attempts: 0 },
    resolve: () => ({ attempts: 2 }),
  }), /Plugin configuration defaults/)

  const configuration = definePluginConfiguration<RetryConfig>({
    version: 1,
    schema: retrySchema,
    resolve: () => ({ attempts: 6 }),
  })

  assert.throws(
    () => configuration.resolve(undefined),
    /Resolved plugin configuration/,
  )
})
