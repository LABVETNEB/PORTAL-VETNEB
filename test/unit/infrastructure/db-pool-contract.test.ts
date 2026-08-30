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

// WBR-12 (VET-12): parseDatabaseMaxConnections debe consumir las constantes
// canonicas DB_MAX_CONNECTIONS_{DEFAULT,FLOOR,CEILING} en lugar de repetir
// 3/1/10 como literales inline. Este guard falla si alguien reintroduce la
// duplicacion (source-contract, sin abrir conexion a DB).
test("server/lib/env.ts declara las constantes canonicas del pool con sus valores exactos", () => {
  const source = read("server/lib/env.ts");

  assert.match(source, /const DB_MAX_CONNECTIONS_DEFAULT = 3;/);
  assert.match(source, /const DB_MAX_CONNECTIONS_FLOOR = 1;/);
  assert.match(source, /const DB_MAX_CONNECTIONS_CEILING = 10;/);
});

test("parseDatabaseMaxConnections usa las constantes canonicas, no literales duplicados", () => {
  const source = read("server/lib/env.ts");
  const functionMatch = source.match(
    /function parseDatabaseMaxConnections\([\s\S]*?\n\}/,
  );

  assert.ok(functionMatch, "parseDatabaseMaxConnections debe existir en server/lib/env.ts");

  const functionBody = functionMatch![0];

  assert.match(
    functionBody,
    /return DB_MAX_CONNECTIONS_DEFAULT;/,
    "el default debe venir de la constante canonica, no de un literal 3",
  );
  assert.match(
    functionBody,
    /Math\.max\(Math\.trunc\(parsed\), DB_MAX_CONNECTIONS_FLOOR\)/,
    "el piso debe venir de la constante canonica, no de un literal 1",
  );
  assert.match(
    functionBody,
    /DB_MAX_CONNECTIONS_CEILING,?\s*\)/,
    "el techo debe venir de la constante canonica, no de un literal 10",
  );
  assert.doesNotMatch(
    functionBody,
    /return 3;/,
    "no debe reintroducirse el literal duplicado 3 como default",
  );
  assert.doesNotMatch(
    functionBody,
    /Math\.trunc\(parsed\), 1\)/,
    "no debe reintroducirse el literal duplicado 1 como piso",
  );
  assert.doesNotMatch(
    functionBody,
    /,\s*10\s*\)/,
    "no debe reintroducirse el literal duplicado 10 como techo",
  );
});

test("server/lib/env.ts no tiene el salto de linea faltante historico antes de las constantes del pool", () => {
  const source = read("server/lib/env.ts");

  assert.doesNotMatch(
    source,
    /\}const DB_MAX_CONNECTIONS_DEFAULT/,
    "debe existir un salto de linea entre el bloque anterior y las constantes del pool",
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
