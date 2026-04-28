import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from "../server/lib/login-rate-limit.ts";

test("constantes de login rate limit son estables", () => {
  assert.equal(LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    LOGIN_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiados intentos de inicio de sesión. Intente más tarde.",
  );
});
