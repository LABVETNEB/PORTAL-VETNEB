import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestLogLine,
  requestLogger,
  sanitizeUrlForLogs,
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

test("sanitizeUrlForLogs redacts path y query params sensibles de forma case-insensitive", () => {
  const rawUrl =
    "/API/PUBLIC/REPORT-ACCESS/AbCd1234?reportAccessToken=xyz987&Token=qwerty&other=1";
  const sanitized = sanitizeUrlForLogs(rawUrl);

  assert.equal(
    sanitized,
    "/API/PUBLIC/REPORT-ACCESS/[REDACTED]?reportAccessToken=[REDACTED]&Token=[REDACTED]&other=1",
  );
});

test("sanitizeUrlForLogs redacts public report path token and sensitive query tokens together", () => {
  const rawPathToken = "a".repeat(64);
  const rawQueryToken = "query-secret-token";
  const rawReportAccessToken = "query-report-access-secret";

  const sanitized = sanitizeUrlForLogs(
    "/api/public/report-access/" +
      rawPathToken +
      "?token=" +
      rawQueryToken +
      "&reportAccessToken=" +
      rawReportAccessToken +
      "&safe=1",
  );

  assert.equal(
    sanitized,
    "/api/public/report-access/[REDACTED]?token=[REDACTED]&reportAccessToken=[REDACTED]&safe=1",
  );
  assert.doesNotMatch(sanitized, new RegExp(rawPathToken));
  assert.doesNotMatch(sanitized, new RegExp(rawQueryToken));
  assert.doesNotMatch(sanitized, new RegExp(rawReportAccessToken));
});
test("sanitizeUrlForLogs preserva fragments mientras redacts token query params", () => {
  const rawUrl = "/api/anything?token=abc123#section-2";
  const sanitized = sanitizeUrlForLogs(rawUrl);

  assert.equal(sanitized, "/api/anything?token=[REDACTED]#section-2");
});

test("buildRequestLogLine redondea duraciones muy pequeñas y no agrega RATE_LIMITED fuera de 429", () => {
  const line = buildRequestLogLine({
    timestamp: "2026-04-22T17:10:00.000Z",
    method: "PUT",
    url: "/api/reports/12",
    statusCode: 500,
    durationMs: 0.04,
  });

  assert.equal(
    line,
    "[2026-04-22T17:10:00.000Z] PUT /api/reports/12 500 0.0ms",
  );
});

test("requestLogger registra url sanitizada y no agrega RATE_LIMITED para status no 429", () => {
  const req = {
    method: "DELETE",
    originalUrl: "/api/reports/12?reportAccessToken=secret-token&foo=1",
  };

  const res = createMockResponse(500);

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

  assert.match(line, /^\[[^\]]+\] DELETE /);
  assert.match(line, /500/);
  assert.match(line, /reportAccessToken=\[REDACTED\]/);
  assert.doesNotMatch(line, /RATE_LIMITED/);
});
