/**
 * Tests: contrato del script reset-login-rate-limit.ps1
 *
 * Verifica que el script existe y cumple invariantes de seguridad operativa
 * sin ejecutarlo realmente (no requiere DB ni PowerShell en CI).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SCRIPT_PATH = join(
  import.meta.dirname ?? "",
  "..",
  "scripts",
  "dev",
  "reset-login-rate-limit.ps1",
);

test("reset-login-rate-limit.ps1 existe", () => {
  assert.ok(existsSync(SCRIPT_PATH), `El script debe existir en ${SCRIPT_PATH}`);
});

test("reset-login-rate-limit.ps1 tiene parámetro -Surface con ValidateSet", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  assert.ok(
    content.includes("ValidateSet"),
    "debe tener ValidateSet para restringir Surface",
  );
  assert.ok(content.includes('"unified"'), "debe incluir surface unified");
  assert.ok(content.includes('"clinic"'), "debe incluir surface clinic");
  assert.ok(content.includes('"admin"'), "debe incluir surface admin");
  assert.ok(content.includes('"particular"'), "debe incluir surface particular");
});

test("reset-login-rate-limit.ps1 requiere -Force para ejecutar DELETE", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  assert.ok(
    content.includes("-Force"),
    "debe requerir -Force para ejecutar",
  );
  assert.ok(
    content.includes("dry-run") || content.includes("DRY-RUN"),
    "debe mencionar dry-run por defecto",
  );
});

test("reset-login-rate-limit.ps1 no imprime hashes completos", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  // El script debe usar solo primeros N chars del hash
  assert.ok(
    content.includes("Substring(0,") || content.includes(".Substring(0,"),
    "debe truncar el hash antes de mostrarlo",
  );
  assert.ok(
    !content.match(/Write-Host.*\$hash[^P]/),
    "no debe imprimir el hash completo directamente",
  );
});

test("reset-login-rate-limit.ps1 no ejecuta reset global sin filtro", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  // No debe haber DELETE sin WHERE
  const deleteStatements = content.match(/DELETE FROM login_rate_limits[^;]*/gi) ?? [];
  for (const stmt of deleteStatements) {
    assert.ok(
      stmt.toUpperCase().includes("WHERE"),
      `Todo DELETE debe tener WHERE: ${stmt.trim().substring(0, 80)}`,
    );
  }
});

test("reset-login-rate-limit.ps1 valida que Identifier no esté vacío", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  assert.ok(
    content.includes("Length -eq 0") || content.includes("normalizedIdentifier") && content.includes("vacío"),
    "debe validar que el identifier no sea vacío",
  );
});

test("reset-login-rate-limit.ps1 no expone DATABASE_URL en output", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  assert.ok(
    !content.includes("Write-Host $databaseUrl"),
    "no debe imprimir DATABASE_URL",
  );
  assert.ok(
    !content.includes("Write-Output $databaseUrl"),
    "no debe imprimir DATABASE_URL",
  );
});

test("reset-login-rate-limit.ps1 usa SHA256 para reproducir el hash de la key", () => {
  const content = readFileSync(SCRIPT_PATH, "utf8");
  assert.ok(
    content.includes("SHA256") || content.includes("sha256"),
    "debe usar SHA256 para reproducir el keyHash",
  );
});
