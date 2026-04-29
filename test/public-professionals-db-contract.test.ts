import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readDbPublicProfessionalsSource(): string {
  return readFileSync(
    resolve(process.cwd(), "server", "db-public-professionals.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(source.includes(expected), `expected source to contain: ${expected}`);
}

test("public professionals search requires recent histopathology activity", () => {
  const source = readDbPublicProfessionalsSource();

  assertContains(source, "RECENT_HISTOPATHOLOGY_REPORTS_SQL");
  assertContains(source, "FROM reports recent_histopathology_reports");
  assertContains(
    source,
    "recent_histopathology_reports.clinic_id = clinic_public_search.clinic_id",
  );
  assertContains(source, "recent_histopathology_reports.study_type");
  assertContains(source, "ILIKE '%histopat%'");
  assertContains(source, "recent_histopathology_reports.upload_date");
  assertContains(source, "recent_histopathology_reports.created_at");
  assertContains(source, "NOW() - INTERVAL '3 months'");
});

test("public professionals search keeps public profile eligibility filters", () => {
  const source = readDbPublicProfessionalsSource();

  assertContains(source, '"is_public = true"');
  assertContains(source, '"is_search_eligible = true"');
  assertContains(source, "RECENT_HISTOPATHOLOGY_REPORTS_SQL,");
});

test("public professional detail lookup shares the recent histopathology gate", () => {
  const source = readDbPublicProfessionalsSource();

  assertContains(source, "RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL");
  assertContains(
    source,
    "RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL,\n      ),",
  );
});
