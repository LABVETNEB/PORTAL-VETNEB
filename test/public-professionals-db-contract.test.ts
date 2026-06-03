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

  assertContains(source, "PROFESSIONAL_BANK_ELIGIBILITY_SQL");
  assertContains(source, "LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL");
  assertContains(source, "FROM report_status_history report_delivery_history");
  assertContains(source, "INNER JOIN reports professional_bank_reports");
  assertContains(
    source,
    "professional_bank_reports.clinic_id = clinic_public_search.clinic_id",
  );
  assertContains(source, "HISTOPATHOLOGY_REPORT_STUDY_TYPE");
  assertContains(source, "changed_by_admin_user_id IS NOT NULL");
  assertContains(source, "status_changed_at AS delivered_at");
  assertContains(source, "PROFESSIONAL_BANK_ELIGIBILITY_MONTHS");
});

test("public professionals search keeps public profile eligibility filters", () => {
  const source = readDbPublicProfessionalsSource();

  assertContains(source, '"is_public = true"');
  assertContains(source, '"is_search_eligible = true"');
  assertContains(source, "PROFESSIONAL_BANK_ELIGIBILITY_SQL,");
});

test("public professional detail lookup shares the recent histopathology gate", () => {
  const source = readDbPublicProfessionalsSource();

  assertContains(source, "PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL");
  assertContains(
    source,
    "PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL,\n      ),",
  );
});
