import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(): string {
  return readFileSync(
    resolve(process.cwd(), "server", "db-public-professionals.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(source.includes(expected), `expected source to contain: ${expected}`);
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

test("histopathology public-search gate is based on reports activity only", () => {
  const source = readSource();

  assertContains(source, "FROM reports recent_histopathology_reports");
  assertContains(
    source,
    "recent_histopathology_reports.clinic_id = clinic_public_search.clinic_id",
  );
  assertContains(source, "recent_histopathology_reports.study_type");
  assertContains(source, "ILIKE '%histopat%'");

  assert.equal(
    countOccurrences(source, "recent_histopathology_reports.study_type"),
    2,
    "search and detail gates must both depend on report study_type",
  );
});

test("histopathology public-search gate uses the required 3 month activity window", () => {
  const source = readSource();

  assertContains(source, "COALESCE(");
  assertContains(source, "recent_histopathology_reports.upload_date");
  assertContains(source, "recent_histopathology_reports.created_at");
  assertContains(source, "NOW() - INTERVAL '3 months'");

  assert.equal(
    countOccurrences(source, "NOW() - INTERVAL '3 months'"),
    2,
    "search and detail gates must both use the same 3 month window",
  );
});

test("search result query and count query share the histopathology eligibility WHERE", () => {
  const source = readSource();

  assertContains(
    source,
    'const whereSql = `WHERE ${conditions.join(" AND ")}`;',
  );
  assertContains(source, "RECENT_HISTOPATHOLOGY_REPORTS_SQL,");
  assertContains(source, "FROM clinic_public_search\n      ${whereSql}");
  assertContains(
    source,
    "SELECT count(*)::int AS total\n      FROM clinic_public_search\n      ${whereSql}",
  );
});

test("public detail lookup uses the Drizzle histopathology gate", () => {
  const source = readSource();

  assertContains(source, "RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL");
  assertContains(
    source,
    "eq(clinicPublicSearch.isSearchEligible, true),\n        RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL,",
  );
});
