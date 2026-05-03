import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { timeWindows } from "../drizzle/schema.ts";
import {
  DEFAULT_TIME_WINDOW_TIMEZONE,
  TIME_WINDOW_TIMEZONE_MAX_LENGTH,
  assertValidTimeWindowRange,
  isValidTimeWindowRange,
  normalizeTimeWindowTimezone,
} from "../server/lib/logistics/time-window.ts";

test("logistics schema exports time windows table", () => {
  assert.equal(typeof timeWindows, "object");
});

test("isValidTimeWindowRange accepts start before end", () => {
  assert.equal(
    isValidTimeWindowRange(
      new Date("2026-05-03T10:00:00.000Z"),
      new Date("2026-05-03T11:00:00.000Z"),
    ),
    true,
  );
});

test("isValidTimeWindowRange rejects equal inverted or invalid dates", () => {
  assert.equal(
    isValidTimeWindowRange(
      new Date("2026-05-03T10:00:00.000Z"),
      new Date("2026-05-03T10:00:00.000Z"),
    ),
    false,
  );

  assert.equal(
    isValidTimeWindowRange(
      new Date("2026-05-03T11:00:00.000Z"),
      new Date("2026-05-03T10:00:00.000Z"),
    ),
    false,
  );

  assert.equal(
    isValidTimeWindowRange(
      new Date("invalid"),
      new Date("2026-05-03T10:00:00.000Z"),
    ),
    false,
  );
});

test("assertValidTimeWindowRange throws for invalid ranges", () => {
  assert.doesNotThrow(() => {
    assertValidTimeWindowRange(
      new Date("2026-05-03T10:00:00.000Z"),
      new Date("2026-05-03T11:00:00.000Z"),
    );
  });

  assert.throws(
    () => {
      assertValidTimeWindowRange(
        new Date("2026-05-03T10:00:00.000Z"),
        new Date("2026-05-03T10:00:00.000Z"),
      );
    },
    /windowStart must be earlier than windowEnd/,
  );
});

test("normalizeTimeWindowTimezone applies explicit UTC default and trims", () => {
  assert.equal(DEFAULT_TIME_WINDOW_TIMEZONE, "UTC");
  assert.equal(normalizeTimeWindowTimezone(undefined), "UTC");
  assert.equal(normalizeTimeWindowTimezone(null), "UTC");
  assert.equal(normalizeTimeWindowTimezone("   "), "UTC");
  assert.equal(normalizeTimeWindowTimezone(" America/Argentina/Cordoba "), "America/Argentina/Cordoba");
});

test("normalizeTimeWindowTimezone caps timezone length", () => {
  const longTimezone = "A".repeat(TIME_WINDOW_TIMEZONE_MAX_LENGTH + 20);
  const normalized = normalizeTimeWindowTimezone(longTimezone);

  assert.equal(normalized.length, TIME_WINDOW_TIMEZONE_MAX_LENGTH);
});

test("logistics time windows migration creates validation and indexes", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0018_logistics_time_windows.sql",
    ),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "time_windows"/);
  assert.match(migration, /"field_visit_id" integer NOT NULL/);
  assert.match(migration, /"window_start" timestamp NOT NULL/);
  assert.match(migration, /"window_end" timestamp NOT NULL/);
  assert.match(migration, /"timezone" varchar\(64\) DEFAULT 'UTC' NOT NULL/);
  assert.match(migration, /"is_hard" boolean DEFAULT true NOT NULL/);
  assert.match(migration, /CHECK \("window_start" < "window_end"\)/);
  assert.match(migration, /time_windows_field_visit_id_idx/);
  assert.match(migration, /time_windows_window_start_idx/);
  assert.match(migration, /time_windows_window_end_idx/);
  assert.match(migration, /time_windows_field_visit_window_start_idx/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE NO ACTION/);
});

test("logistics time windows migration is registered in drizzle journal", () => {
  const journal = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "meta",
      "_journal.json",
    ),
    "utf8",
  );

  const parsed = JSON.parse(journal) as {
    entries?: Array<{ idx?: number; tag?: string }>;
  };

  const entry = parsed.entries?.find(
    (item) => item.tag === "0018_logistics_time_windows",
  );

  assert.ok(entry, "journal debe registrar 0018_logistics_time_windows");
  assert.equal(entry?.idx, 18);
});
