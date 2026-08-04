import assert from "node:assert/strict"
import test from "node:test"

import { createD1RestDatabase } from "../src/rest"

test("executes prepared statements through the Cloudflare D1 REST API", async () => {
  const requests: Array<{ body: unknown; headers: Headers; url: string }> = []
  const database = createD1RestDatabase({
    accountId: "account-id",
    apiToken: "test-token",
    databaseId: "database-id",
    fetchImpl: async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: new Headers(init?.headers),
        url: String(input),
      })
      return Response.json({
        success: true,
        errors: [],
        result: [{
          success: true,
          results: [{ value: "ok" }],
          meta: { changes: 0, duration: 1.5 },
        }],
      })
    },
  })

  const result = await database.prepare("SELECT ? AS value").bind("ok").first<{
    value: string
  }>()

  assert.deepEqual(result, { value: "ok" })
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0]?.body, {
    sql: "SELECT ? AS value",
    params: ["ok"],
  })
  assert.equal(requests[0]?.headers.get("authorization"), "Bearer test-token")
  assert.match(requests[0]?.url ?? "", /accounts\/account-id\/d1\/database\/database-id\/query$/u)
})

test("sends D1 batches as one transactional REST query", async () => {
  let requestBody: unknown
  const database = createD1RestDatabase({
    accountId: "account-id",
    apiToken: "test-token",
    databaseId: "database-id",
    fetchImpl: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return Response.json({
        success: true,
        errors: [],
        result: [
          { success: true, results: [], meta: { changes: 1 } },
          { success: true, results: [], meta: { changes: 1 } },
        ],
      })
    },
  })

  const results = await database.batch([
    database.prepare("INSERT INTO example (id) VALUES (?)").bind("first"),
    database.prepare("INSERT INTO example (id) VALUES (?)").bind("second"),
  ])

  assert.equal(results.length, 2)
  assert.deepEqual(requestBody, {
    batch: [
      { sql: "INSERT INTO example (id) VALUES (?)", params: ["first"] },
      { sql: "INSERT INTO example (id) VALUES (?)", params: ["second"] },
    ],
  })
})

test("normalizes boolean bindings to SQLite integers", async () => {
  let requestBody: unknown
  const database = createD1RestDatabase({
    accountId: "account-id",
    apiToken: "test-token",
    databaseId: "database-id",
    fetchImpl: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return Response.json({
        success: true,
        errors: [],
        result: [{ success: true, results: [], meta: { changes: 1 } }],
      })
    },
  })

  await database.prepare("INSERT INTO example (enabled) VALUES (?)").bind(true).run()

  assert.deepEqual(requestBody, {
    sql: "INSERT INTO example (enabled) VALUES (?)",
    params: [1],
  })
})

test("surfaces Cloudflare API errors without exposing credentials", async () => {
  const database = createD1RestDatabase({
    accountId: "account-id",
    apiToken: "secret-token",
    databaseId: "database-id",
    fetchImpl: async () => Response.json({
      success: false,
      errors: [{ message: "database not found" }],
      result: [],
    }, { status: 404 }),
  })

  await assert.rejects(
    () => database.prepare("SELECT 1").all(),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /database not found/u)
      assert.doesNotMatch(error.message, /secret-token/u)
      return true
    },
  )
})
