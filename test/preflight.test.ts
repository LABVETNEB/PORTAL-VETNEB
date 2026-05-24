import test from "node:test";
import assert from "node:assert/strict";

import {
  isPoolExhaustedError,
  safeCleanupStep,
} from "../server/preflight.ts";

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

test("safeCleanupStep retorna 0 y loguea warning cuando es EMAXCONNSESSION", async () => {
  const warnings: string[] = [];
  const mockLogger = {
    warn: (...args: unknown[]) => {
      warnings.push(args.join(" "));
    },
  };

  const result = await safeCleanupStep(
    async () => {
      throw new Error("max clients reached in session mode — pool_size: 15");
    },
    "admin_sessions",
    mockLogger,
  );

  assert.equal(result, 0);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("[PREFLIGHT_CLEANUP_WARN]"));
  assert.ok(warnings[0].includes("admin_sessions"));
  assert.ok(warnings[0].includes("pool exhausted"));
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
  const mockLogger = {
    warn: (...args: unknown[]) => {
      warnings.push(args.join(" "));
    },
  };

  await safeCleanupStep(async () => 3, "test_silent", mockLogger);
  assert.equal(warnings.length, 0);
});
