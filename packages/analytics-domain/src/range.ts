import type { AnalyticsDateRange, AnalyticsRange } from "./types"

export interface QueryRange {
  publicRange: AnalyticsDateRange;
  start: Date;
  end: Date;
  seriesStart: Date;
  seriesEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  startDay: string;
  endDay: string;
}

export interface SeriesBucket {
  unit: "hour" | "day";
  step: "1 hour" | "1 day";
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const millisecondsPerHour = 60 * 60 * 1000;
const defaultTimeZone = "UTC";
const maximumTimeZoneLength = 64;

const rangeDays: Record<AnalyticsRange, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dateTimeFormatters.get(timeZone);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

function getZonedDateTimeParts(value: Date, timeZone: string): ZonedDateTimeParts {
  const parts = getDateTimeFormatter(timeZone).formatToParts(value);
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.get("year") ?? value.getUTCFullYear(),
    month: values.get("month") ?? value.getUTCMonth() + 1,
    day: values.get("day") ?? value.getUTCDate(),
    hour: values.get("hour") ?? value.getUTCHours(),
    minute: values.get("minute") ?? value.getUTCMinutes(),
    second: values.get("second") ?? value.getUTCSeconds(),
    millisecond: value.getUTCMilliseconds(),
  };
}

function toWallClockMilliseconds(parts: ZonedDateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

function toZonedInstant(parts: ZonedDateTimeParts, timeZone: string): Date {
  const targetWallClock = toWallClockMilliseconds(parts);
  let instant = targetWallClock;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actualWallClock = toWallClockMilliseconds(
      getZonedDateTimeParts(new Date(instant), timeZone),
    );
    const adjustment = targetWallClock - actualWallClock;
    if (adjustment === 0) {
      break;
    }
    instant += adjustment;
  }

  return new Date(instant);
}

function shiftCalendarDays(
  parts: ZonedDateTimeParts,
  days: number,
): ZonedDateTimeParts {
  const shifted = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day + days,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  ));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
}

function startOfZonedDay(value: Date, timeZone: string, dayOffset = 0): Date {
  const shifted = shiftCalendarDays(getZonedDateTimeParts(value, timeZone), dayOffset);
  return toZonedInstant({
    ...shifted,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  }, timeZone);
}

function shiftZonedDateTime(value: Date, timeZone: string, days: number): Date {
  return toZonedInstant(
    shiftCalendarDays(getZonedDateTimeParts(value, timeZone), days),
    timeZone,
  );
}

function ceilToUtcHour(value: Date) {
  const hourStart = Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    value.getUTCHours(),
  );
  const isAligned = value.getTime() === hourStart;

  return new Date(hourStart + (isAligned ? 0 : millisecondsPerHour));
}

function floorToUtcHour(value: Date) {
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    value.getUTCHours(),
  ));
}

export function normalizeAnalyticsTimeZone(
  value: string | null | undefined,
): string {
  const candidate = value?.trim();
  if (!candidate || candidate.length > maximumTimeZoneLength) {
    return defaultTimeZone;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    }).resolvedOptions().timeZone;
  } catch {
    return defaultTimeZone;
  }
}

export function resolveQueryRange(
  range: AnalyticsRange,
  now = new Date(),
  requestedTimeZone = defaultTimeZone,
): QueryRange {
  const timeZone = normalizeAnalyticsTimeZone(requestedTimeZone);
  const days = rangeDays[range];
  const end = new Date(now);
  const start = range === "1d"
    ? new Date(end.getTime() - millisecondsPerDay)
    : startOfZonedDay(end, timeZone, -(days - 1));

  const seriesStart = range === "1d" ? ceilToUtcHour(start) : new Date(start);
  const seriesEndSource = new Date(end.getTime() - 1);
  const seriesEnd = range === "1d"
    ? floorToUtcHour(seriesEndSource)
    : startOfZonedDay(seriesEndSource, timeZone);

  const previousStart = range === "1d"
    ? new Date(start.getTime() - millisecondsPerDay)
    : shiftZonedDateTime(start, timeZone, -days);
  const previousEnd = range === "1d"
    ? new Date(end.getTime() - millisecondsPerDay)
    : shiftZonedDateTime(end, timeZone, -days);
  const startDay = startOfZonedDay(start, timeZone).toISOString().slice(0, 10);
  const endDay = startOfZonedDay(end, timeZone, 1).toISOString().slice(0, 10);

  return {
    publicRange: {
      key: range,
      start: start.toISOString(),
      end: end.toISOString(),
      timeZone,
    },
    start,
    end,
    seriesStart,
    seriesEnd,
    previousStart,
    previousEnd,
    startDay,
    endDay,
  };
}

export function resolveSeriesBucket(range: AnalyticsRange): SeriesBucket {
  return range === "1d"
    ? { unit: "hour", step: "1 hour" }
    : { unit: "day", step: "1 day" };
}

export function createSeriesBucketDates(range: QueryRange): Date[] {
  const unit = resolveSeriesBucket(range.publicRange.key).unit;
  const dates: Date[] = [];
  let cursor = new Date(range.seriesStart);

  while (cursor.getTime() <= range.seriesEnd.getTime()) {
    dates.push(cursor);
    cursor = unit === "hour"
      ? new Date(cursor.getTime() + millisecondsPerHour)
      : shiftZonedDateTime(cursor, range.publicRange.timeZone, 1);
  }

  return dates;
}

export function resolveSeriesBucketStart(
  value: Date,
  range: QueryRange,
): Date {
  return resolveSeriesBucket(range.publicRange.key).unit === "hour"
    ? floorToUtcHour(value)
    : startOfZonedDay(value, range.publicRange.timeZone);
}
