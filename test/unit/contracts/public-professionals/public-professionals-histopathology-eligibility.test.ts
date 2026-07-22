import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// M22: el SQL de elegibilidad se movió a la capa infrastructure (repository
// canónico); el path legacy quedó como shim de un solo re-export.
function readSource(): string {
  return readFileSync(
    resolve(
      process.cwd(),
      "server",
      "features",
      "public-professionals",
      "infrastructure",
      "public-professionals-repository.ts",
    ),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(source.includes(expected), `expected source to contain: ${expected}`);
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function extractTemplateConstant(source: string, constantName: string): string {
  const assignmentStart = source.indexOf(`const ${constantName} =`);

  assert.notEqual(
    assignmentStart,
    -1,
    `${constantName}: falta la constante esperada`,
  );

  const templateStart = source.indexOf("`", assignmentStart);

  assert.notEqual(
    templateStart,
    -1,
    `${constantName}: falta el inicio del template literal`,
  );

  const templateEnd = source.indexOf("`;", templateStart + 1);

  assert.notEqual(
    templateEnd,
    -1,
    `${constantName}: falta el cierre del template literal`,
  );

  return source.slice(templateStart + 1, templateEnd).trim();
}

test("histopathology public-search gate is based on admin report delivery", () => {
  const source = readSource();
  const deliverySql = extractTemplateConstant(
    source,
    "LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL",
  );

  assertContains(deliverySql, "FROM report_status_history report_delivery_history");
  assertContains(deliverySql, "INNER JOIN reports professional_bank_reports");
  assertContains(
    deliverySql,
    "professional_bank_reports.clinic_id = clinic_public_search.clinic_id",
  );
  assertContains(
    deliverySql,
    "professional_bank_reports.study_type = '${HISTOPATHOLOGY_REPORT_STUDY_TYPE}'",
  );
  assertContains(
    deliverySql,
    "report_delivery_history.changed_by_admin_user_id IS NOT NULL",
  );
  assertContains(
    deliverySql,
    "professional_bank_reports.status_changed_by_admin_user_id IS NOT NULL",
  );

  assert.equal(
    countOccurrences(deliverySql, "professional_bank_reports.study_type"),
    2,
    "history and compatibility fallback must both depend on report study_type",
  );
});

test("histopathology public-search gate uses the required 3 month delivery window", () => {
  const source = readSource();
  const eligibilitySql = extractTemplateConstant(
    source,
    "PROFESSIONAL_BANK_ELIGIBILITY_SQL",
  );

  assertContains(
    eligibilitySql,
    "LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL",
  );
  assertContains(
    eligibilitySql,
    "NOW() - INTERVAL '${PROFESSIONAL_BANK_ELIGIBILITY_MONTHS} months'",
  );

  assert.equal(
    countOccurrences(source, "NOW() - INTERVAL"),
    1,
    "search and detail gates must share the same derived 3 month expression",
  );
});

test("search result query and count query share the histopathology eligibility WHERE", () => {
  const source = readSource();

  assertContains(
    source,
    'const whereSql = `WHERE ${conditions.join(" AND ")}`;',
  );
  assertContains(source, "PROFESSIONAL_BANK_ELIGIBILITY_SQL,");
  assertContains(source, "FROM clinic_public_search\n      ${whereSql}");
  assertContains(
    source,
    "SELECT count(*)::int AS total\n      FROM clinic_public_search\n      ${whereSql}",
  );
});

test("public detail lookup uses the Drizzle histopathology gate", () => {
  const source = readSource();

  assertContains(source, "PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL");
  assertContains(source, "sql.raw(\n  PROFESSIONAL_BANK_ELIGIBILITY_SQL,");
  assertContains(
    source,
    "eq(clinicPublicSearch.isSearchEligible, true),\n        PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL,",
  );
});
