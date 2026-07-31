import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestLogLine,
  requestLogger,
} from "../../../server/middlewares/request-logger.ts";

function createMockResponse(statusCode = 200) {
  const listeners = new Map<string, Array<() => void>>();

  return {
    statusCode,
    on(event: string, handler: () => void) {
      const current = listeners.get(event) ?? [];
      current.push(handler);
      listeners.set(event, current);
      return this;
    },
    emit(event: string) {
      for (const handler of listeners.get(event) ?? []) {
        handler();
      }
    },
  };
}

test("requestLogger llama next inmediatamente", () => {
  const req = {
    method: "GET",
    originalUrl: "/api/health",
    ip: "127.0.0.1",
    headers: {
      "user-agent": "node-test",
    },
  };

  const res = createMockResponse(200);
  const nextCalls: unknown[] = [];

  requestLogger(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
});

test("requestLogger registra un evento estructurado al finalizar la respuesta", () => {
  const req = {
    method: "GET",
    originalUrl: "/api/public/report-access/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890?token=abc",
    ip: "127.0.0.1",
    headers: {
      "user-agent": "node-test",
    },
  };

  const res = createMockResponse(200);

  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];

  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    requestLogger(req as any, res as any, (() => {}) as any);
    res.emit("finish");
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0][0], "string");

  const line = calls[0][0] as string;
  const logEvent = JSON.parse(line) as {
    event: string;
    timestamp: string;
    context: Record<string, unknown>;
  };

  assert.equal(logEvent.event, "HTTP_REQUEST_COMPLETED");
  assert.equal(typeof logEvent.timestamp, "string");
  assert.equal(logEvent.context.method, "GET");
  assert.equal(logEvent.context.statusCode, 200);
  assert.equal(logEvent.context.statusClass, "2xx");
  assert.equal(logEvent.context.routeTemplate, "UNMATCHED_ROUTE");
  assert.equal(typeof logEvent.context.durationMs, "number");

  // El token de acceso publico viaja en el path; el evento no puede conservar
  // ninguna forma de la URL, ni siquiera redactada.
  assert.equal("path" in logEvent.context, false);
  assert.equal("url" in logEvent.context, false);
  assert.equal(line.includes("report-access"), false);
  assert.equal(line.includes("abcdef1234567890"), false);
  assert.equal(line.includes("[REDACTED]"), false);
});

test("requestLogger marca rateLimited cuando statusCode es 429", () => {
  const req = {
    method: "POST",
    originalUrl: "/api/auth/login",
    ip: "127.0.0.1",
    headers: {
      "user-agent": "node-test",
    },
  };

  const res = createMockResponse(429);

  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];

  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    requestLogger(req as any, res as any, (() => {}) as any);
    res.emit("finish");
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(calls.length, 1);

  const logEvent = JSON.parse(calls[0][0] as string) as {
    context: Record<string, unknown>;
  };

  assert.equal(logEvent.context.rateLimited, true);
  assert.equal(logEvent.context.statusCode, 429);
  assert.equal(logEvent.context.statusClass, "4xx");
});

test("buildRequestLogLine usa timestamp y url explícitos para status 200", () => {
  const line = buildRequestLogLine({
    timestamp: "2026-04-20T14:00:10.148Z",
    method: "GET",
    url: "/api/health",
    statusCode: 200,
    durationMs: 12,
  });

  assert.equal(
    line,
    "[2026-04-20T14:00:10.148Z] GET /api/health 200 12.0ms",
  );
});

test("buildRequestLogLine agrega RATE_LIMITED para 429", () => {
  const line = buildRequestLogLine({
    timestamp: "2026-04-20T14:00:10.148Z",
    method: "POST",
    url: "/api/auth/login",
    statusCode: 429,
    durationMs: 7.25,
  });

  assert.equal(
    line,
    "[2026-04-20T14:00:10.148Z] POST /api/auth/login 429 7.3ms RATE_LIMITED",
  );
});

test("requestLogger con un ID real en la URL sólo registra el route template", () => {
  const req = {
    method: "GET",
    originalUrl: "/api/reports/4821/history?clinicId=307",
    route: { path: "/api/reports/:reportId/history" },
    ip: "127.0.0.1",
    headers: {
      "user-agent": "node-test",
      "x-request-id": "323e4567-e89b-42d3-a456-426614174002",
    },
  };

  const res = createMockResponse(200);

  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];

  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    requestLogger(req as any, res as any, (() => {}) as any);
    res.emit("finish");
  } finally {
    console.log = originalConsoleLog;
  }

  const line = calls[0][0] as string;
  const logEvent = JSON.parse(line) as {
    requestId?: string;
    context: Record<string, unknown>;
  };

  assert.equal(logEvent.context.routeTemplate, "/api/reports/:reportId/history");
  assert.equal(logEvent.requestId, "323e4567-e89b-42d3-a456-426614174002");
  assert.deepEqual(Object.keys(logEvent.context).sort(), [
    "durationMs",
    "method",
    "rateLimited",
    "routeTemplate",
    "statusClass",
    "statusCode",
  ]);
  assert.equal(line.includes("4821"), false);
  assert.equal(line.includes("clinicId"), false);
  assert.equal(line.includes("307"), false);
});

test("requestLogger no promueve un request id opaco con caracteres previamente permitidos", () => {
  const credentialShapedRequestId = [
    "sess",
    "opaque",
    "fixture",
    "abc123",
  ].join("_");

  const req = {
    method: "GET",
    originalUrl: "/api/health",
    route: { path: "/api/health" },
    headers: {
      "x-request-id": credentialShapedRequestId,
    },
  };

  const res = createMockResponse(200);
  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];

  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    requestLogger(req as any, res as any, (() => {}) as any);
    res.emit("finish");
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(calls.length, 1);

  const line = String(calls[0]?.[0]);
  const logEvent = JSON.parse(line) as {
    requestId?: string;
    context: Record<string, unknown>;
  };

  assert.equal("requestId" in logEvent, false);
  assert.equal(
    line.includes(credentialShapedRequestId),
    false,
  );
  assert.equal(
    logEvent.context.routeTemplate,
    "/api/health",
  );
});
