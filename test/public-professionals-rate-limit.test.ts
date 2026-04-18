import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS,
  buildPublicProfessionalsSearchRateLimitOptions,
  createPublicProfessionalsSearchRateLimit,
} from "../server/lib/public-professionals-rate-limit.ts";

test("buildPublicProfessionalsSearchRateLimitOptions expone configuracion esperada", () => {
  const options = buildPublicProfessionalsSearchRateLimitOptions();

  assert.equal(options.windowMs, 15 * 60 * 1000);
  assert.equal(options.max, 10);
  assert.equal(options.standardHeaders, true);
  assert.equal(options.legacyHeaders, false);
  assert.deepEqual(options.message, {
    success: false,
    error: "Demasiadas consultas al directorio público. Intente más tarde.",
  });
});

test("constantes de public professionals search rate limit son estables", () => {
  assert.equal(PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiadas consultas al directorio público. Intente más tarde.",
  );
});

test("createPublicProfessionalsSearchRateLimit devuelve middleware invocable", () => {
  const middleware = createPublicProfessionalsSearchRateLimit();

  assert.equal(typeof middleware, "function");
});
