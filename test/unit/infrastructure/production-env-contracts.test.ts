import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

function readEnvExample(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function activeLines(content: string): string[] {
  return content.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
}

// .env.example (backend) ──────────────────────────────────────────────────────

test(".env.example contiene CORS_ORIGIN de producción como línea activa", () => {
  const active = activeLines(readEnvExample(".env.example"));
  assert.ok(
    active.some((l) => l === "CORS_ORIGIN=https://vetneb.com.ar"),
    "falta: CORS_ORIGIN=https://vetneb.com.ar",
  );
});

test(".env.example contiene TRUST_PROXY=1 como línea activa", () => {
  const active = activeLines(readEnvExample(".env.example"));
  assert.ok(
    active.some((l) => l === "TRUST_PROXY=1"),
    "falta: TRUST_PROXY=1",
  );
});

test(".env.example no contiene TRUST_PROXY=true como línea activa", () => {
  const active = activeLines(readEnvExample(".env.example"));
  assert.ok(
    !active.some((l) => l.includes("TRUST_PROXY=true")),
    "no debe existir TRUST_PROXY=true activo — rompe el startup",
  );
});

test(".env.example no contiene NEXT_PUBLIC_API_URL como línea activa", () => {
  const active = activeLines(readEnvExample(".env.example"));
  assert.ok(
    !active.some((l) => l.startsWith("NEXT_PUBLIC_API_URL")),
    "NEXT_PUBLIC_API_URL es variable de frontend, no del backend",
  );
});

test(".env.example no contiene NEXT_PUBLIC_SITE_URL como línea activa", () => {
  const active = activeLines(readEnvExample(".env.example"));
  assert.ok(
    !active.some((l) => l.startsWith("NEXT_PUBLIC_SITE_URL")),
    "NEXT_PUBLIC_SITE_URL es variable de frontend, no del backend",
  );
});

test(".env.example no contiene URLs de staging como líneas activas", () => {
  const active = activeLines(readEnvExample(".env.example"));
  const stagingPatterns = [
    "portal-vetneb-backend-staging.onrender.com",
    "portal-vetneb-frontend-staging.onrender.com",
    "portal.vetneb.com",
  ];
  for (const pattern of stagingPatterns) {
    assert.ok(
      !active.some((l) => l.includes(pattern)),
      `no debe existir URL de staging activa: ${pattern}`,
    );
  }
});

// frontend/.env.example ───────────────────────────────────────────────────────

test("frontend/.env.example contiene NEXT_PUBLIC_API_URL de producción como línea activa", () => {
  const active = activeLines(readEnvExample("frontend/.env.example"));
  assert.ok(
    active.some((l) => l === "NEXT_PUBLIC_API_URL=https://api.vetneb.com.ar"),
    "falta: NEXT_PUBLIC_API_URL=https://api.vetneb.com.ar",
  );
});

test("frontend/.env.example contiene NEXT_PUBLIC_SITE_URL de producción como línea activa", () => {
  const active = activeLines(readEnvExample("frontend/.env.example"));
  assert.ok(
    active.some((l) => l === "NEXT_PUBLIC_SITE_URL=https://vetneb.com.ar"),
    "falta: NEXT_PUBLIC_SITE_URL=https://vetneb.com.ar",
  );
});

test("frontend/.env.example no contiene portal.vetneb.com como valor activo", () => {
  const active = activeLines(readEnvExample("frontend/.env.example"));
  assert.ok(
    !active.some((l) => l.includes("portal.vetneb.com")),
    "no debe existir portal.vetneb.com activo",
  );
});

test("frontend/.env.example no contiene staging onrender como valores activos", () => {
  const active = activeLines(readEnvExample("frontend/.env.example"));
  const stagingPatterns = [
    "portal-vetneb-frontend-staging.onrender.com",
    "portal-vetneb-backend-staging.onrender.com",
  ];
  for (const pattern of stagingPatterns) {
    assert.ok(
      !active.some((l) => l.includes(pattern)),
      `no debe existir URL de staging activa: ${pattern}`,
    );
  }
});

// TRUST_PROXY schema contract ──────────────────────────────────────────────────
// Schema extraído de server/lib/env.ts — z.coerce.number().int().min(0).max(10)
// Se prueba inline para evitar efectos secundarios del módulo (dotenv, DB URL).

const trustProxySchema = z.coerce.number().int().min(0).max(10).optional();

test("TRUST_PROXY='1' parsea como número entero 1", () => {
  const result = trustProxySchema.safeParse("1");
  assert.ok(result.success, "TRUST_PROXY='1' debe parsear exitosamente");
  assert.strictEqual(result.data, 1);
});

test("TRUST_PROXY='true' falla el schema (z.coerce.number produce NaN)", () => {
  const result = trustProxySchema.safeParse("true");
  assert.ok(
    !result.success,
    "TRUST_PROXY='true' debe fallar — este fue el bug de producción",
  );
});
