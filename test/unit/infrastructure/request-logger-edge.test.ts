import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestLogLine,
  requestLogger,
  sanitizeUrlForLogs,
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

test("sanitizeUrlForLogs redacts repeated sensitive params while preserving safe interleaved params", () => {
  const rawUrl =
    "/api/public/report-access/path-secret?safe=1&token=query-secret-a&reportAccessToken=report-secret-a&token=query-secret-b&other=ok&reportAccessToken=report-secret-b";
  const sanitized = sanitizeUrlForLogs(rawUrl);

  assert.equal(
    sanitized,
    "/api/public/report-access/[REDACTED]?safe=1&token=[REDACTED]&reportAccessToken=[REDACTED]&token=[REDACTED]&other=ok&reportAccessToken=[REDACTED]",
  );
  assert.doesNotMatch(sanitized, /path-secret/);
  assert.doesNotMatch(sanitized, /query-secret-a/);
  assert.doesNotMatch(sanitized, /query-secret-b/);
  assert.doesNotMatch(sanitized, /report-secret-a/);
  assert.doesNotMatch(sanitized, /report-secret-b/);
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

test("requestLogger registra evento estructurado sin marcar rateLimited fuera de 429", () => {
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
  const logEvent = JSON.parse(line) as {
    event: string;
    level: string;
    context: Record<string, unknown>;
  };

  assert.equal(logEvent.event, "HTTP_REQUEST_COMPLETED");
  assert.equal(logEvent.level, "info");
  assert.equal(logEvent.context.method, "DELETE");
  assert.equal(logEvent.context.statusCode, 500);
  assert.equal(logEvent.context.statusClass, "5xx");
  assert.equal(logEvent.context.rateLimited, false);
  assert.equal(logEvent.context.routeTemplate, "UNMATCHED_ROUTE");

  // Sin template seguro el evento cae a UNMATCHED_ROUTE y no conserva el
  // pathname original: /api/reports/12 lleva un reportId real.
  assert.deepEqual(Object.keys(logEvent.context).sort(), [
    "durationMs",
    "method",
    "rateLimited",
    "statusClass",
    "statusCode",
    "routeTemplate",
  ].sort());
  assert.equal("path" in logEvent.context, false);
  assert.equal("url" in logEvent.context, false);

  // Sólo las dimensiones string son deterministas: durationMs es un float y
  // puede contener cualquier secuencia de digitos.
  const serializedDimensions = JSON.stringify({
    method: logEvent.context.method,
    routeTemplate: logEvent.context.routeTemplate,
    statusClass: logEvent.context.statusClass,
  });

  assert.equal(serializedDimensions.includes("secret-token"), false);
  assert.equal(serializedDimensions.includes("/api/reports"), false);
  assert.equal(serializedDimensions.includes("12"), false);
  assert.equal(line.includes("secret-token"), false);
  assert.equal(line.includes("/api/reports"), false);
});
