import test from "node:test";
import assert from "node:assert/strict";

import {
  isPoolExhaustedError,
  safeCleanupStep,
} from "../../../server/preflight.ts";

// isPoolExhaustedError

test("isPoolExhaustedError detecta 'max clients reached'", () => {
  assert.equal(
    isPoolExhaustedError(
      new Error("max clients reached in session mode — pool_size: 15"),
    ),
    true,
  );
});

test("isPoolExhaustedError detecta 'too many connections'", () => {
  assert.equal(
    isPoolExhaustedError(new Error("too many connections")),
    true,
  );
});

test("isPoolExhaustedError detecta 'EMAXCONN'", () => {
  assert.equal(isPoolExhaustedError(new Error("EMAXCONN")), true);
});

test("isPoolExhaustedError no clasifica errores criticos como pool", () => {
  assert.equal(
    isPoolExhaustedError(new Error("password authentication failed")),
    false,
  );
  assert.equal(
    isPoolExhaustedError(new Error("connection refused: ECONNREFUSED")),
    false,
  );
  assert.equal(
    isPoolExhaustedError(new Error("relation does not exist")),
    false,
  );
});

// safeCleanupStep

test("safeCleanupStep retorna el resultado cuando la funcion tiene exito", async () => {
  const result = await safeCleanupStep(async () => 7, "test_ok");
  assert.equal(result, 7);
});

test("safeCleanupStep retorna 0 y loguea warning estructurado sin texto crudo de DB cuando es EMAXCONNSESSION", async () => {
  // WBR-11: el warning de pool exhausto ahora pasa por el logger
  // estructurado canonico (logWarn), que nunca expone el mensaje crudo del
  // error (server/lib/logger.ts: serializeError). Se espia console.warn
  // directamente, como ya hace test/integration/app/fastify-app.test.ts
  // para otros eventos estructurados.
  const rawDbMessage =
    "max clients reached in session mode — pool_size: 15 at host=private-db.internal";
  const warnings: string[] = [];
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };

  let result: number;
  try {
    result = await safeCleanupStep(async () => {
      throw new Error(rawDbMessage);
    }, "admin_sessions");
  } finally {
    console.warn = originalConsoleWarn;
  }

  assert.equal(result, 0);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('"event":"PREFLIGHT_CLEANUP_WARN"'));
  assert.ok(warnings[0].includes('"label":"admin_sessions"'));
  assert.ok(warnings[0].includes('"errorName":"Error"'));
  assert.equal(warnings[0].includes(rawDbMessage), false);
  assert.equal(warnings[0].includes("private-db.internal"), false);
});

test("safeCleanupStep re-lanza errores criticos que no son de pool", async () => {
  const criticalError = new Error("password authentication failed for user");

  await assert.rejects(
    () => safeCleanupStep(async () => { throw criticalError; }, "test_critical"),
    (err: unknown) => {
      assert.ok(err === criticalError);
      return true;
    },
  );
});

test("safeCleanupStep re-lanza errores de conexion rechazada", async () => {
  await assert.rejects(
    () =>
      safeCleanupStep(
        async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
        },
        "test_econnrefused",
      ),
    /ECONNREFUSED/,
  );
});

test("safeCleanupStep no loguea nada en caso de exito", async () => {
  const warnings: string[] = [];
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };

  try {
    await safeCleanupStep(async () => 3, "test_silent");
  } finally {
    console.warn = originalConsoleWarn;
  }

  assert.equal(warnings.length, 0);
});
