import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin clinics create soporta clinic_id legacy requerido en DB real", () => {
  const source = read("server/db-admin-clinics.ts");

  assert.ok(source.includes("column_name = 'clinic_id'"));
  assert.ok(source.includes("buildLegacyClinicExternalId"));
  assert.ok(source.includes("insert into \"clinics\""));
  assert.ok(source.includes("\"clinic_id\""));
  assert.ok(source.includes("reserveNextClinicId"));
});

test("admin clinics delete limpia report_access_tokens antes de borrar clinics", () => {
  const source = read("server/db-admin-clinics.ts");

  const deleteReportAccessTokensIndex = source.indexOf(
    ".delete(reportAccessTokens)",
  );
  const deleteClinicsIndex = source.indexOf(".delete(clinics)");

  assert.ok(deleteReportAccessTokensIndex >= 0);
  assert.ok(deleteClinicsIndex > deleteReportAccessTokensIndex);
});
