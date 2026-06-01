import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLoginRateLimitKey,
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  normalizeLoginRateLimitIdentifier,
} from "../server/lib/login-rate-limit.ts";

test("constantes de login rate limit son estables", () => {
  assert.equal(LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    LOGIN_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiados intentos de inicio de sesión. Intente más tarde.",
  );
});

test("login rate limit key incluye version, superficie, identificador normalizado e IP", () => {
  assert.equal(normalizeLoginRateLimitIdentifier("  User@VETNEB.test "), "user@vetneb.test");
  assert.equal(normalizeLoginRateLimitIdentifier("A".repeat(300)).length, 256);
  assert.equal(
    buildLoginRateLimitKey({
      surface: "unified",
      identifier: "  User@VETNEB.test ",
      ipAddress: "203.0.113.50",
    }),
    "login:v2:unified:user@vetneb.test:ip:203.0.113.50",
  );
});
