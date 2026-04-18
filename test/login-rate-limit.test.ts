import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  buildLoginRateLimitOptions,
  createLoginRateLimit,
} from "../server/lib/login-rate-limit.ts";

test("buildLoginRateLimitOptions expone configuracion esperada", () => {
  const options = buildLoginRateLimitOptions();

  assert.equal(options.windowMs, 15 * 60 * 1000);
  assert.equal(options.max, 10);
  assert.equal(options.standardHeaders, true);
  assert.equal(options.legacyHeaders, false);
  assert.deepEqual(options.message, {
    success: false,
    error: "Demasiados intentos de inicio de sesión. Intente más tarde.",
  });
});

test("constantes de login rate limit son estables", () => {
  assert.equal(LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    LOGIN_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiados intentos de inicio de sesión. Intente más tarde.",
  );
});

test("createLoginRateLimit devuelve middleware invocable", () => {
  const middleware = createLoginRateLimit();

  assert.equal(typeof middleware, "function");
});
