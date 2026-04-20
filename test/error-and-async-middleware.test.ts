import test from "node:test";
import assert from "node:assert/strict";
import { errorHandler, notFoundHandler } from "../server/middlewares/error-handler.ts";
import { asyncHandler } from "../server/utils/async-handler.ts";

function createMockResponse() {
  return {
    statusCode: 200,
    jsonPayload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      return this;
    },
  };
}

test("notFoundHandler responde 404 con path solicitado", () => {
  const req = {
    originalUrl: "/ruta/inexistente",
  };

  const res = createMockResponse();

  notFoundHandler(req as any, res as any);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Ruta no encontrada",
    path: "/ruta/inexistente",
  });
});

test("errorHandler responde 500 genérico para Error estándar", () => {
  const req = {
    method: "GET",
    originalUrl: "/api/falla",
  };

  const res = createMockResponse();

  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];

  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    errorHandler(new Error("falló fuerte"), req as any, res as any, (() => {}) as any);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Error interno del servidor",
    details: undefined,
    path: "/api/falla",
  });

  assert.equal(consoleCalls.length, 1);
  assert.equal(consoleCalls[0][0], "[API ERROR]");

  const loggedPayload = consoleCalls[0][1] as {
    method: string;
    path: string;
    status: number;
    message: string;
    error: unknown;
  };

  assert.equal(loggedPayload.method, "GET");
  assert.equal(loggedPayload.path, "/api/falla");
  assert.equal(loggedPayload.status, 500);
  assert.equal(loggedPayload.message, "falló fuerte");
  assert.ok(loggedPayload.error instanceof Error);
});

test("errorHandler respeta status explícito y expone details en errores 4xx", () => {
  const req = {
    method: "POST",
    originalUrl: "/api/reports",
  };

  const res = createMockResponse();

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const error = Object.assign(new Error("Conflicto de negocio"), {
      status: 409,
    });

    errorHandler(
      error,
      req as any,
      res as any,
      (() => {}) as any,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Conflicto de negocio",
    details: "Conflicto de negocio",
    path: "/api/reports",
  });
});

test("errorHandler convierte códigos postgres conocidos a 400", () => {
  const req = {
    method: "PATCH",
    originalUrl: "/api/clinics/4",
  };

  const res = createMockResponse();

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const error = Object.assign(
      new Error("duplicate key value violates unique constraint"),
      {
        code: "23505",
      },
    );

    errorHandler(
      error,
      req as any,
      res as any,
      (() => {}) as any,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "duplicate key value violates unique constraint",
    details: "duplicate key value violates unique constraint",
    path: "/api/clinics/4",
  });
});

test("asyncHandler no llama next cuando la promesa resuelve", async () => {
  const req = { originalUrl: "/ok" };
  const res = {};
  const nextCalls: unknown[] = [];

  const handler = asyncHandler(async (_req, _res, _next) => {
    return "ok";
  });

  handler(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(nextCalls.length, 0);
});

test("asyncHandler propaga rechazos a next", async () => {
  const req = { originalUrl: "/fail" };
  const res = {};
  const nextCalls: unknown[] = [];
  const expectedError = new Error("boom");

  const handler = asyncHandler(async () => {
    throw expectedError;
  });

  handler(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], expectedError);
});
