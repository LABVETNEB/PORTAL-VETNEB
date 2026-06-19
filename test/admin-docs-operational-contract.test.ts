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

test("staging smoke runbook enforces real admin operation without demo/smoke flow", () => {
  const source = read("docs/staging-smoke-runbook.md");

  for (const marker of [
    "Validar secciones visibles del sidebar admin con datos reales",
    "Regla operativa: staging/prod no usa clínicas demo/smoke/smock como flujo",
    "eliminarlos solo desde",
    "confirmación exacta por nombre",
    "Transporte de correo",
    "Gmail API HTTPS",
    "usuario de acceso (usar email real de la clínica)",
    "contraseña inicial enmascarada por defecto",
    "revelarla de forma explícita",
  ]) {
    assert.ok(
      source.includes(marker),
      `docs/staging-smoke-runbook.md missing ${marker}`,
    );
  }
});

test("release readiness tracks full admin sections and safe delete policy", () => {
  const source = read("docs/release-readiness.md");

  for (const marker of [
    "Panel admin valida todas las secciones visibles",
    "`Administración`, `Subir informe`, `Estado`, `Clínicas`",
    "`Tokens particulares`, `Precios`, `Sesiones`, `Roles clínica`",
    "`Auditoría`, `Mantenimiento`",
    "eliminar clínicas desde UI con confirmación",
    "exacta por nombre",
    "contraseña inicial enmascarada por defecto",
    "reveal explícito y reversible",
    "No se usa demo/smoke/smock como operación real",
    "clinic.deleted",
    "Gmail API HTTPS",
  ]) {
    assert.ok(
      source.includes(marker),
      `docs/release-readiness.md missing ${marker}`,
    );
  }
});
