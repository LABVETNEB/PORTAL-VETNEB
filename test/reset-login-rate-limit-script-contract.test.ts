/**
 * Tests: contrato operativo del reset de rate limit de login.
 *
 * Verifica invariantes de seguridad sin ejecutar DB ni PowerShell en CI.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PS_SCRIPT_PATH = join(
  import.meta.dirname ?? "",
  "..",
  "scripts",
  "dev",
  "reset-login-rate-limit.ps1",
);
const TS_SCRIPT_PATH = join(
  import.meta.dirname ?? "",
  "..",
  "scripts",
  "dev",
  "reset-login-rate-limit.ts",
);

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

test("reset login rate limit scripts exist", () => {
  assert.ok(existsSync(PS_SCRIPT_PATH), `El wrapper debe existir en ${PS_SCRIPT_PATH}`);
  assert.ok(existsSync(TS_SCRIPT_PATH), `El script TS debe existir en ${TS_SCRIPT_PATH}`);
});

test("PowerShell wrapper validates surface and delegates to pnpm tsx", () => {
  const content = read(PS_SCRIPT_PATH);

  assert.ok(content.includes("ValidateSet"));
  assert.ok(content.includes('"unified"'));
  assert.ok(content.includes('"clinic"'));
  assert.ok(content.includes('"admin"'));
  assert.ok(content.includes('"particular"'));
  assert.ok(content.includes("Get-Command pnpm"));
  assert.ok(content.includes('"exec", "tsx", "scripts/dev/reset-login-rate-limit.ts"'));
  assert.ok(content.includes("--surface"));
  assert.ok(content.includes("--identifier"));
  assert.ok(content.includes("--ip-address"));
  assert.ok(content.includes("--force"));
});

test("reset scripts default to dry-run and require force for delete", () => {
  const psContent = read(PS_SCRIPT_PATH);
  const tsContent = read(TS_SCRIPT_PATH);

  assert.ok(psContent.includes("-Force"));
  assert.ok(psContent.includes("dry-run"));
  assert.ok(tsContent.includes("Default mode is dry-run"));
  assert.ok(tsContent.includes("--force"));
  assert.ok(tsContent.includes("if (!options.force)"));
  assert.ok(tsContent.includes("Dry-run only"));
});

test("reset script uses project DB dependencies, not a local SQL client binary", () => {
  const psContent = read(PS_SCRIPT_PATH).toLowerCase();
  const tsContent = read(TS_SCRIPT_PATH).toLowerCase();

  assert.equal(psContent.includes("psql"), false);
  assert.equal(tsContent.includes("psql"), false);
  assert.ok(tsContent.includes('from "postgres"'));
  assert.ok(tsContent.includes('from "dotenv"'));
  assert.ok(tsContent.includes("process.env.supabase_db_url"));
  assert.ok(tsContent.includes("process.env.database_url"));
});

test("reset script deletes only by matched key hashes and never globally", () => {
  const content = read(TS_SCRIPT_PATH);
  const deleteStatements = content.match(/DELETE FROM login_rate_limits[\s\S]*?RETURNING key_hash/g) ?? [];

  assert.ok(deleteStatements.length > 0, "debe contener DELETE operativo");

  for (const statement of deleteStatements) {
    assert.ok(
      statement.toUpperCase().includes("WHERE"),
      `Todo DELETE debe tener WHERE: ${statement.slice(0, 120)}`,
    );
    assert.ok(statement.includes("key_hash IN"));
  }
});

test("reset script resets by metadata and supports exact-IP legacy fallback only", () => {
  const content = read(TS_SCRIPT_PATH);

  assert.ok(content.includes("hashLoginRateLimitIdentifier"));
  assert.ok(content.includes("hashLoginRateLimitIpAddress"));
  assert.ok(content.includes("WHERE surface = ${options.surface}"));
  assert.ok(content.includes("AND identifier_hash = ${identifierHash}"));
  assert.ok(content.includes("AND ip_hash = ${ipHash}"));
  assert.ok(content.includes("Legacy fallback"));
  assert.ok(content.includes("exact IP"));
  assert.ok(content.includes("Legacy rows cannot be reset by identifier without an exact IP."));
});

test("reset scripts validate identifier and avoid sensitive output", () => {
  const psContent = read(PS_SCRIPT_PATH);
  const tsContent = read(TS_SCRIPT_PATH);

  assert.ok(psContent.includes("Identifier no puede estar vacío"));
  assert.ok(tsContent.includes("--identifier no puede estar vacio"));
  assert.ok(tsContent.includes("previewHash"));
  assert.ok(tsContent.includes("Identifier hash"));
  assert.equal(tsContent.includes("Identifier :"), false);
  assert.equal(tsContent.includes("console.log(options.identifier"), false);
  assert.equal(tsContent.includes("console.log(databaseUrl"), false);
  assert.equal(psContent.includes("Write-Host $databaseUrl"), false);
});
