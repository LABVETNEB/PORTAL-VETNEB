export const DEFAULT_TIME_WINDOW_TIMEZONE = "UTC";
export const TIME_WINDOW_TIMEZONE_MAX_LENGTH = 64;

export function isValidTimeWindowRange(
  windowStart: Date,
  windowEnd: Date,
): boolean {
  return (
    windowStart instanceof Date &&
    windowEnd instanceof Date &&
    Number.isFinite(windowStart.getTime()) &&
    Number.isFinite(windowEnd.getTime()) &&
    windowStart.getTime() < windowEnd.getTime()
  );
}

export function normalizeTimeWindowTimezone(
  timezone: string | null | undefined,
): string {
  const normalized = timezone?.trim();

  if (!normalized) {
    return DEFAULT_TIME_WINDOW_TIMEZONE;
  }

  if (normalized.length > TIME_WINDOW_TIMEZONE_MAX_LENGTH) {
    return normalized.slice(0, TIME_WINDOW_TIMEZONE_MAX_LENGTH);
  }

  return normalized;
}

export function assertValidTimeWindowRange(
  windowStart: Date,
  windowEnd: Date,
): void {
  if (!isValidTimeWindowRange(windowStart, windowEnd)) {
    throw new Error("windowStart must be earlier than windowEnd");
  }
}
