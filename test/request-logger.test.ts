import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../server/middlewares/request-logger.ts";

test("sanitizeUrlForLogs redacts public report access token in path", () => {
  const rawUrl = `/api/public/report-access/${"a".repeat(64)}?foo=bar`;
  const sanitized = sanitizeUrlForLogs(rawUrl);

  assert.equal(sanitized, "/api/public/report-access/[REDACTED]?foo=bar");
});

test("sanitizeUrlForLogs redacts token query params", () => {
  const rawUrl = `/api/anything?token=${"b".repeat(64)}&other=1`;
  const sanitized = sanitizeUrlForLogs(rawUrl);

  assert.equal(sanitized, "/api/anything?token=[REDACTED]&other=1");
});

test("sanitizeUrlForLogs preserves unrelated urls", () => {
  const rawUrl = "/api/reports/123/history";
  const sanitized = sanitizeUrlForLogs(rawUrl);

  assert.equal(sanitized, rawUrl);
});

test("buildRequestLogLine marca respuestas 429 como RATE_LIMITED", () => {
  const line = buildRequestLogLine({
    timestamp: "2026-04-19T12:00:00.000Z",
    method: "GET",
    url: "/api/public/professionals/search?limit=1",
    statusCode: 429,
    durationMs: 12.34,
  });

  assert.equal(
    line,
    "[2026-04-19T12:00:00.000Z] GET /api/public/professionals/search?limit=1 429 12.3ms RATE_LIMITED",
  );
});

test("buildRequestLogLine no agrega marker para respuestas no limitadas", () => {
  const line = buildRequestLogLine({
    timestamp: "2026-04-19T12:00:00.000Z",
    method: "GET",
    url: "/api/health",
    statusCode: 200,
    durationMs: 5,
  });

  assert.equal(
    line,
    "[2026-04-19T12:00:00.000Z] GET /api/health 200 5.0ms",
  );
});
