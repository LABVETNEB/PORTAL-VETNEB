import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLoginRateLimitKeyMetadata,
  buildLoginRateLimitKey,
  buildMissingCredentialsLoginRateLimitKey,
  getLoginRateLimitKeyMetadata,
  hashLoginRateLimitIdentifier,
  hashLoginRateLimitIpAddress,
  LOGIN_RATE_LIMIT_KEY_VERSION,
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

test("buildLoginRateLimitKey genera keys distintas para surfaces distintas con mismo identifier e IP", () => {
  const base = { identifier: "usuario@vetneb.com", ipAddress: "1.2.3.4" };
  const keyAdmin = buildLoginRateLimitKey({ ...base, surface: "admin" });
  const keyClinic = buildLoginRateLimitKey({ ...base, surface: "clinic" });
  const keyParticular = buildLoginRateLimitKey({ ...base, surface: "particular" });
  const keyUnified = buildLoginRateLimitKey({ ...base, surface: "unified" });

  assert.notEqual(keyAdmin, keyClinic, "admin y clinic deben tener keys distintas");
  assert.notEqual(keyAdmin, keyParticular, "admin y particular deben tener keys distintas");
  assert.notEqual(keyAdmin, keyUnified, "admin y unified deben tener keys distintas");
  assert.notEqual(keyClinic, keyParticular, "clinic y particular deben tener keys distintas");

  assert.equal(keyAdmin, "login:v2:admin:usuario@vetneb.com:ip:1.2.3.4");
  assert.equal(keyClinic, "login:v2:clinic:usuario@vetneb.com:ip:1.2.3.4");
  assert.equal(keyParticular, "login:v2:particular:usuario@vetneb.com:ip:1.2.3.4");
  assert.equal(keyUnified, "login:v2:unified:usuario@vetneb.com:ip:1.2.3.4");
});

test("buildLoginRateLimitKey genera keys distintas para identifiers distintos con mismo surface e IP", () => {
  const base = { surface: "admin" as const, ipAddress: "1.2.3.4" };
  const keyA = buildLoginRateLimitKey({ ...base, identifier: "admin_a" });
  const keyB = buildLoginRateLimitKey({ ...base, identifier: "admin_b" });

  assert.notEqual(keyA, keyB, "admin_a y admin_b deben tener keys distintas");
});

test("buildLoginRateLimitKey con ipAddress null usa 'unknown'", () => {
  const key = buildLoginRateLimitKey({
    surface: "clinic",
    identifier: "clinica@test.com",
    ipAddress: null,
  });
  assert.equal(key, "login:v2:clinic:clinica@test.com:ip:unknown");
});

test("login rate limit metadata usa hashes seguros y version estable", () => {
  const metadata = buildLoginRateLimitKeyMetadata({
    surface: "admin",
    identifier: "  Admin@Vetneb.test ",
    ipAddress: "203.0.113.50",
  });

  assert.equal(metadata.surface, "admin");
  assert.equal(metadata.keyVersion, LOGIN_RATE_LIMIT_KEY_VERSION);
  assert.equal(metadata.identifierHash.length, 64);
  assert.equal(metadata.ipHash.length, 64);
  assert.equal(metadata.identifierHash, hashLoginRateLimitIdentifier("admin@vetneb.test"));
  assert.equal(metadata.ipHash, hashLoginRateLimitIpAddress("203.0.113.50"));
  assert.notEqual(metadata.identifierHash, "admin@vetneb.test");
  assert.notEqual(metadata.ipHash, "203.0.113.50");
});

test("login rate limit metadata se puede derivar desde la key persistida", () => {
  const key = buildLoginRateLimitKey({
    surface: "particular",
    identifier: "TOKEN-RAW",
    ipAddress: "2001:db8::51",
  });

  assert.deepEqual(getLoginRateLimitKeyMetadata(key), {
    surface: "particular",
    identifierHash: hashLoginRateLimitIdentifier("token-raw"),
    ipHash: hashLoginRateLimitIpAddress("2001:db8::51"),
    keyVersion: LOGIN_RATE_LIMIT_KEY_VERSION,
  });
});

test("missing credentials usa bucket separado por surface e IP", () => {
  assert.equal(
    buildMissingCredentialsLoginRateLimitKey({
      surface: "unified",
      ipAddress: "203.0.113.52",
    }),
    "login:v2:unified:missing:ip:203.0.113.52",
  );
  assert.notEqual(
    buildMissingCredentialsLoginRateLimitKey({
      surface: "unified",
      ipAddress: "203.0.113.52",
    }),
    buildLoginRateLimitKey({
      surface: "unified",
      identifier: "usuario@vetneb.com",
      ipAddress: "203.0.113.52",
    }),
  );
});
