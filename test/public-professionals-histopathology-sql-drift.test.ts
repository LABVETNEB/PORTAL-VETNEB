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

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function getRawGate(source: string): string {
  return extractTemplateConstant(source, "RECENT_HISTOPATHOLOGY_REPORTS_SQL");
}

function getDrizzleGate(source: string): string {
  return extractTemplateConstant(
    source,
    "RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL",
  );
}

test("raw SQL and Drizzle histopathology gates stay equivalent", () => {
  const source = readSource();
  const rawGate = normalizeSql(getRawGate(source));
  const drizzleGate = normalizeSql(getDrizzleGate(source));

  assert.equal(
    rawGate,
    drizzleGate,
    "el gate SQL raw y el gate Drizzle no deben divergir",
  );
});

test("histopathology eligibility gate depends only on reports activity", () => {
  const source = readSource();
  const rawGate = getRawGate(source);

  assert.equal(
    countOccurrences(rawGate, "FROM reports recent_histopathology_reports"),
    1,
    "el gate debe consultar exclusivamente reports como fuente de actividad",
  );

  assert.equal(
    countOccurrences(rawGate, "clinic_public_search."),
    1,
    "el gate solo debe referenciar clinic_public_search para correlacionar clinic_id",
  );

  assert.ok(
    rawGate.includes(
      "recent_histopathology_reports.clinic_id = clinic_public_search.clinic_id",
    ),
    "el gate debe correlacionar reports con clinic_public_search por clinic_id",
  );

  for (const forbiddenToken of [
    "clinic_public_profiles",
    "report_status_history",
    "study_tracking",
    "clinic_public_search.specialty_text",
    "clinic_public_search.services_text",
    "clinic_public_search.search_text",
    "clinic_public_search.profile_quality_score",
    "clinic_public_search.is_search_eligible",
  ]) {
    assert.ok(
      !rawGate.includes(forbiddenToken),
      `el gate no debe depender de ${forbiddenToken}`,
    );
  }
});

test("histopathology eligibility gate uses report study_type only", () => {
  const source = readSource();
  const rawGate = getRawGate(source);
  const normalizedGate = normalizeSql(rawGate);

  assert.equal(
    countOccurrences(rawGate, "recent_histopathology_reports.study_type"),
    1,
    "el gate debe evaluar study_type una sola vez",
  );

  assert.ok(
    normalizedGate.includes(
      "immutable_unaccent(COALESCE(recent_histopathology_reports.study_type, '')) ILIKE '%histopat%'",
    ),
    "el gate debe usar study_type normalizado para detectar histopatología",
  );

  assert.ok(
    !rawGate.includes("specialty_text"),
    "el texto de especialidad pública no debe habilitar aparición",
  );
});

test("histopathology eligibility gate uses only upload/create report timestamps", () => {
  const source = readSource();
  const rawGate = getRawGate(source);
  const normalizedGate = normalizeSql(rawGate);

  assert.ok(
    normalizedGate.includes(
      "COALESCE( recent_histopathology_reports.upload_date, recent_histopathology_reports.created_at ) >= NOW() - INTERVAL '3 months'",
    ),
    "el gate debe usar upload_date/created_at con ventana inclusiva de 3 meses",
  );

  for (const forbiddenDateColumn of [
    "recent_histopathology_reports.updated_at",
    "recent_histopathology_reports.completed_at",
    "recent_histopathology_reports.status_changed_at",
  ]) {
    assert.ok(
      !rawGate.includes(forbiddenDateColumn),
      `el gate no debe depender de ${forbiddenDateColumn}`,
    );
  }
});
