import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS,
  buildReportAccessTokenMutationRateLimitOptions,
  createReportAccessTokenMutationRateLimit,
} from "../server/lib/report-access-token-rate-limit.ts";

test("buildReportAccessTokenMutationRateLimitOptions expone configuracion esperada", () => {
  const options = buildReportAccessTokenMutationRateLimitOptions();

  assert.equal(options.windowMs, 15 * 60 * 1000);
  assert.equal(options.max, 10);
  assert.equal(options.standardHeaders, true);
  assert.equal(options.legacyHeaders, false);
  assert.deepEqual(options.message, {
    success: false,
    error: "Demasiadas operaciones sobre tokens públicos de informes. Intente más tarde.",
  });
});

test("constantes de report access token mutation rate limit son estables", () => {
  assert.equal(
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
  );
  assert.equal(REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiadas operaciones sobre tokens públicos de informes. Intente más tarde.",
  );
});

test("createReportAccessTokenMutationRateLimit devuelve middleware invocable", () => {
  const middleware = createReportAccessTokenMutationRateLimit();

  assert.equal(typeof middleware, "function");
});
