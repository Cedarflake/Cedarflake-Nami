import assert from "node:assert/strict"
import test from "node:test"

import { parseAnalyticsQueryScope } from "../src/lib/analytics/query-input"

test("uses the device time-zone fallback for analytics queries", () => {
  assert.deepEqual(
    parseAnalyticsQueryScope(
      new URLSearchParams({ range: "7d", entryDomain: "api.i0c.cc" }),
      "Asia/Shanghai",
    ),
    {
      range: "7d",
      entryDomain: "api.i0c.cc",
      timeZone: "Asia/Shanghai",
    },
  )
})

test("lets API clients provide a validated time zone explicitly", () => {
  assert.equal(
    parseAnalyticsQueryScope(
      new URLSearchParams({ range: "30d", timeZone: "America/New_York" }),
      "Asia/Shanghai",
    )?.timeZone,
    "America/New_York",
  )
  assert.equal(
    parseAnalyticsQueryScope(
      new URLSearchParams({ range: "30d", timeZone: "invalid/time-zone" }),
    )?.timeZone,
    "UTC",
  )
})
