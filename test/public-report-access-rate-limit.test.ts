import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS,
  buildPublicReportAccessRateLimitOptions,
  createPublicReportAccessRateLimit,
} from "../server/lib/public-report-access-rate-limit.ts";

test("buildPublicReportAccessRateLimitOptions expone configuracion esperada", () => {
  const options = buildPublicReportAccessRateLimitOptions();

  assert.equal(options.windowMs, 15 * 60 * 1000);
  assert.equal(options.max, 10);
  assert.equal(options.standardHeaders, true);
  assert.equal(options.legacyHeaders, false);
  assert.deepEqual(options.message, {
    success: false,
    error: "Demasiados accesos públicos al informe. Intente más tarde.",
  });
});

test("constantes de public report access rate limit son estables", () => {
  assert.equal(PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiados accesos públicos al informe. Intente más tarde.",
  );
});

test("createPublicReportAccessRateLimit devuelve middleware invocable", () => {
  const middleware = createPublicReportAccessRateLimit();

  assert.equal(typeof middleware, "function");
});
