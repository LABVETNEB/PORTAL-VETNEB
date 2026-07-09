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
  return extractTemplateConstant(
    source,
    "LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL",
  );
}

function getEligibilityGate(source: string): string {
  return extractTemplateConstant(
    source,
    "PROFESSIONAL_BANK_ELIGIBILITY_SQL",
  );
}

test("raw SQL and Drizzle histopathology gates stay equivalent", () => {
  const source = readSource();

  assert.ok(
    source.includes(
      "const PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL = sql.raw(\n  PROFESSIONAL_BANK_ELIGIBILITY_SQL,",
    ),
    "el gate Drizzle debe reutilizar exactamente el SQL raw",
  );
});

test("histopathology eligibility gate depends on admin delivery events", () => {
  const source = readSource();
  const rawGate = getRawGate(source);

  assert.equal(
    countOccurrences(rawGate, "FROM report_status_history report_delivery_history"),
    1,
    "el gate debe consultar historial de estados como fuente primaria",
  );

  assert.equal(
    countOccurrences(rawGate, "INNER JOIN reports professional_bank_reports"),
    1,
    "el historial debe unirse a reports para clinic_id y study_type",
  );

  assert.equal(
    countOccurrences(rawGate, "FROM reports professional_bank_reports"),
    1,
    "el gate debe mantener fallback de compatibilidad en reports",
  );

  assert.equal(
    countOccurrences(rawGate, "clinic_public_search."),
    2,
    "el gate solo debe referenciar clinic_public_search para correlacionar clinic_id",
  );

  assert.ok(
    rawGate.includes(
      "professional_bank_reports.clinic_id = clinic_public_search.clinic_id",
    ),
    "el gate debe correlacionar reportes con clinic_public_search por clinic_id",
  );

  for (const forbiddenToken of [
    "clinic_public_profiles",
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
    countOccurrences(rawGate, "professional_bank_reports.study_type"),
    2,
    "el gate debe evaluar study_type en historial y fallback",
  );

  assert.ok(
    normalizedGate.includes(
      "professional_bank_reports.study_type = '${HISTOPATHOLOGY_REPORT_STUDY_TYPE}'",
    ),
    "el gate debe usar el tipo de estudio histopatologico del catalogo",
  );

  assert.ok(
    !rawGate.includes("ILIKE '%histopat%'"),
    "el gate no debe inferir histopatologia con busquedas de texto libre",
  );
});

test("histopathology eligibility gate uses only admin delivery timestamps", () => {
  const source = readSource();
  const rawGate = getRawGate(source);
  const eligibilityGate = getEligibilityGate(source);
  const normalizedGate = normalizeSql(rawGate);

  assert.ok(
    normalizedGate.includes("report_delivery_history.created_at AS delivered_at"),
    "el historial de estados debe aportar la fecha de entrega admin",
  );

  assert.ok(
    normalizedGate.includes("professional_bank_reports.status_changed_at AS delivered_at"),
    "reports.status_changed_at queda como fallback de compatibilidad",
  );

  assert.ok(
    normalizedGate.includes(
      "report_delivery_history.changed_by_admin_user_id IS NOT NULL",
    ),
    "el historial debe exigir autor admin",
  );

  assert.ok(
    normalizedGate.includes(
      "professional_bank_reports.status_changed_by_admin_user_id IS NOT NULL",
    ),
    "el fallback debe exigir autor admin",
  );

  assert.ok(
    normalizeSql(eligibilityGate).includes(
      "NOW() - INTERVAL '${PROFESSIONAL_BANK_ELIGIBILITY_MONTHS} months'",
    ),
    "la ventana debe derivarse del contrato de 3 meses",
  );

  for (const forbiddenDateColumn of [
    "professional_bank_reports.upload_date",
    "professional_bank_reports.created_at",
    "professional_bank_reports.updated_at",
    "professional_bank_reports.completed_at",
  ]) {
    assert.ok(
      !rawGate.includes(forbiddenDateColumn),
      `el gate no debe depender de ${forbiddenDateColumn}`,
    );
  }
});
