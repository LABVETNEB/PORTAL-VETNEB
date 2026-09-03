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

test(".env.example contiene TRUST_PROXY=<RENDER_PROXY_IP_OR_CIDR> como línea activa", () => {
  const active = activeLines(readEnvExample(".env.example"));
  assert.ok(
    active.some((l) => l === "TRUST_PROXY=<RENDER_PROXY_IP_OR_CIDR>"),
    "falta: TRUST_PROXY=<RENDER_PROXY_IP_OR_CIDR>",
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
// Validador extraído de server/lib/env.ts — isValidTrustProxyConfig (IP/CIDR,
// lista separada por coma; rechaza hop-count numérico legacy y booleanos).
// Se prueba inline para evitar efectos secundarios del módulo (dotenv, DB URL).

function isValidTrustProxyEntry(entry: string): boolean {
  const cidrMatch = entry.match(/^(.+)\/(\d{1,3})$/);
  if (cidrMatch) {
    const [, address, prefixRaw] = cidrMatch;
    const prefix = Number(prefixRaw);
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(address)) {
      return prefix >= 0 && prefix <= 32;
    }
    if (address.includes(":")) {
      return prefix >= 0 && prefix <= 128;
    }
    return false;
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(entry)) return true;
  if (entry.includes(":")) return true;
  return false;
}

function isValidTrustProxyConfig(value: string): boolean {
  const entries = value.split(",").map((entry) => entry.trim());
  return entries.every((entry) => entry.length > 0 && isValidTrustProxyEntry(entry));
}

const trustProxySchema = z.string().min(1).refine(isValidTrustProxyConfig).optional();

test("TRUST_PROXY='1' falla el schema (hop-count numérico legacy ya no es válido)", () => {
  const result = trustProxySchema.safeParse("1");
  assert.ok(
    !result.success,
    "TRUST_PROXY='1' debe fallar — Fastify 5.12.1 deshabilitó trust proxy numérico",
  );
});

test("TRUST_PROXY='true' falla el schema", () => {
  const result = trustProxySchema.safeParse("true");
  assert.ok(
    !result.success,
    "TRUST_PROXY='true' debe fallar — este fue el bug de producción",
  );
});

test("TRUST_PROXY con un IP válido parsea exitosamente", () => {
  const result = trustProxySchema.safeParse("203.0.113.10");
  assert.ok(result.success, "TRUST_PROXY con IP válido debe parsear");
});

test("TRUST_PROXY con un CIDR válido parsea exitosamente", () => {
  const result = trustProxySchema.safeParse("203.0.113.0/24");
  assert.ok(result.success, "TRUST_PROXY con CIDR válido debe parsear");
});

test("TRUST_PROXY con lista de IP/CIDR separada por coma parsea exitosamente", () => {
  const result = trustProxySchema.safeParse("203.0.113.10, 198.51.100.0/24");
  assert.ok(result.success, "TRUST_PROXY con lista separada por coma debe parsear");
});

test("TRUST_PROXY con un valor inválido falla el schema", () => {
  const result = trustProxySchema.safeParse("not-an-ip");
  assert.ok(!result.success, "TRUST_PROXY inválido debe fallar");
});

test("TRUST_PROXY vacío queda undefined (fail-closed: no confía en ningún proxy)", () => {
  const result = trustProxySchema.safeParse(undefined);
  assert.ok(result.success, "TRUST_PROXY ausente debe ser válido (optional)");
  assert.strictEqual(result.data, undefined);
});
