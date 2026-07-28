import assert from "node:assert/strict"
import test from "node:test"

import {
  ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS,
  ANALYTICS_RAW_EVENT_RETENTION_DAYS,
  resolveAnalyticsEntryDomainCutoff,
} from "../src/store"

test("keeps the entry-domain window inside raw-event retention", () => {
  assert.ok(
    ANALYTICS_ENTRY_DOMAIN_LOOKBACK_DAYS < ANALYTICS_RAW_EVENT_RETENTION_DAYS,
  )
  assert.equal(
    resolveAnalyticsEntryDomainCutoff(new Date("2026-07-22T10:30:00.000Z")),
    "2026-04-24T00:00:00.000Z",
  )
})
