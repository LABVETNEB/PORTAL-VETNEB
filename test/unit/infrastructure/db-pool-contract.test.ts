import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("server/db.ts configura max conexiones desde ENV.databaseMaxConnections", () => {
  const source = read("server/db.ts");
  assert.ok(
    source.includes("max: ENV.databaseMaxConnections"),
    "el cliente postgres debe recibir max: ENV.databaseMaxConnections para limitar el pool",
  );
});

test("server/lib/env.ts expone DATABASE_MAX_CONNECTIONS y databaseMaxConnections", () => {
  const source = read("server/lib/env.ts");
  assert.ok(
    source.includes("DATABASE_MAX_CONNECTIONS"),
    "envSchema debe incluir DATABASE_MAX_CONNECTIONS",
  );
  assert.ok(
    source.includes("databaseMaxConnections"),
    "ENV debe exportar databaseMaxConnections",
  );
});

test("server/preflight.ts exporta safeCleanupStep e isPoolExhaustedError", () => {
  const source = read("server/preflight.ts");
  assert.ok(
    source.includes("export async function safeCleanupStep"),
    "safeCleanupStep debe ser exportada para testabilidad",
  );
  assert.ok(
    source.includes("export function isPoolExhaustedError"),
    "isPoolExhaustedError debe ser exportada para testabilidad",
  );
});

test("server/index.ts importa preflight desde server/preflight.ts y no define preflight local", () => {
  const source = read("server/index.ts");
  assert.ok(
    source.includes('from "./preflight.ts"'),
    "index.ts debe importar preflight del modulo preflight.ts",
  );
  assert.ok(
    !source.includes("async function preflight()"),
    "index.ts no debe definir una funcion preflight local (debe delegarla al modulo)",
  );
});
