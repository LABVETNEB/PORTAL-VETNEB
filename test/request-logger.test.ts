import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrlForLogs } from "../server/middlewares/request-logger.ts";

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
