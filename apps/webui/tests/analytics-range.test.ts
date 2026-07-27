import assert from "node:assert/strict";
import test from "node:test";

import {
  createSeriesBucketDates,
  normalizeAnalyticsTimeZone,
  resolveQueryRange,
  resolveSeriesBucketStart,
  resolveSeriesBucket,
} from "../src/lib/analytics/queries/range";

const now = new Date("2026-07-21T08:34:56.000Z");

test("uses a rolling 24-hour range with aligned hourly series buckets", () => {
  const range = resolveQueryRange("1d", now);

  assert.equal(range.start.toISOString(), "2026-07-20T08:34:56.000Z");
  assert.equal(range.end.toISOString(), now.toISOString());
  assert.equal(range.seriesStart.toISOString(), "2026-07-20T09:00:00.000Z");
  assert.equal(range.seriesEnd.toISOString(), "2026-07-21T08:00:00.000Z");
  assert.equal(
    (range.seriesEnd.getTime() - range.seriesStart.getTime()) / (60 * 60 * 1000) + 1,
    24,
  );
  assert.equal(range.previousStart.toISOString(), "2026-07-19T08:34:56.000Z");
  assert.equal(range.previousEnd.toISOString(), "2026-07-20T08:34:56.000Z");
});

test("does not add an empty future bucket when the one-day range ends on the hour", () => {
  const range = resolveQueryRange("1d", new Date("2026-07-21T08:00:00.000Z"));

  assert.equal(range.seriesStart.toISOString(), "2026-07-20T08:00:00.000Z");
  assert.equal(range.seriesEnd.toISOString(), "2026-07-21T07:00:00.000Z");
});

test("aligns the previous 30-day period to the same UTC boundaries", () => {
  const range = resolveQueryRange("30d", now);

  assert.equal(range.start.toISOString(), "2026-06-22T00:00:00.000Z");
  assert.equal(range.seriesStart.toISOString(), "2026-06-22T00:00:00.000Z");
  assert.equal(range.seriesEnd.toISOString(), "2026-07-21T00:00:00.000Z");
  assert.equal(range.previousStart.toISOString(), "2026-05-23T00:00:00.000Z");
  assert.equal(range.previousEnd.toISOString(), "2026-06-21T08:34:56.000Z");
});

test("uses hourly buckets only for the one-day range", () => {
  assert.deepEqual(resolveSeriesBucket("1d"), { unit: "hour", step: "1 hour" });
  assert.deepEqual(resolveSeriesBucket("7d"), { unit: "day", step: "1 day" });
});

test("aligns daily ranges and buckets to the requested device time zone", () => {
  const range = resolveQueryRange(
    "7d",
    new Date("2026-07-27T02:46:00.000Z"),
    "Asia/Shanghai",
  );

  assert.equal(range.publicRange.timeZone, "Asia/Shanghai");
  assert.equal(range.start.toISOString(), "2026-07-20T16:00:00.000Z");
  assert.equal(range.seriesEnd.toISOString(), "2026-07-26T16:00:00.000Z");
  assert.equal(range.previousStart.toISOString(), "2026-07-13T16:00:00.000Z");
  assert.equal(range.previousEnd.toISOString(), "2026-07-20T02:46:00.000Z");
  assert.deepEqual(
    createSeriesBucketDates(range).map((date) => date.toISOString()),
    [
      "2026-07-20T16:00:00.000Z",
      "2026-07-21T16:00:00.000Z",
      "2026-07-22T16:00:00.000Z",
      "2026-07-23T16:00:00.000Z",
      "2026-07-24T16:00:00.000Z",
      "2026-07-25T16:00:00.000Z",
      "2026-07-26T16:00:00.000Z",
    ],
  );
  assert.equal(
    resolveSeriesBucketStart(
      new Date("2026-07-26T16:30:00.000Z"),
      range,
    ).toISOString(),
    "2026-07-26T16:00:00.000Z",
  );
});

test("keeps local daily buckets aligned across daylight-saving changes", () => {
  const range = resolveQueryRange(
    "7d",
    new Date("2026-03-10T16:00:00.000Z"),
    "America/New_York",
  );
  const buckets = createSeriesBucketDates(range);
  const steps = buckets.slice(1).map(
    (date, index) => date.getTime() - (buckets[index]?.getTime() ?? 0),
  );

  assert.equal(buckets.length, 7);
  assert.ok(steps.includes(23 * 60 * 60 * 1000));
});

test("falls back to UTC for invalid time zones", () => {
  assert.equal(normalizeAnalyticsTimeZone("not/a-time-zone"), "UTC");
});
