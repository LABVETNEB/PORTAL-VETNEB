import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestLogLine,
  requestLogger,
} from "../server/middlewares/request-logger.ts";

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

test("requestLogger registra una línea al finalizar la respuesta", () => {
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

  assert.match(line, /^\[[^\]]+\] GET /);
  assert.match(line, /200/);
  assert.match(line, /\[REDACTED\]/);
  assert.match(line, /[0-9]+\.[0-9]ms$/);
});

test("requestLogger conserva el marker RATE_LIMITED cuando statusCode es 429", () => {
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

  const line = calls[0][0] as string;
  assert.match(line, /RATE_LIMITED/);
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
