import test from "node:test";
import assert from "node:assert/strict";
import {
  generateSessionToken,
  hashLegacyPassword,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../server/lib/auth-security.ts";

test("hashLegacyPassword genera sha256 hex estable", () => {
  assert.equal(
    hashLegacyPassword("abc123"),
    "6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090",
  );
});

test("hashSessionToken genera sha256 hex estable", () => {
  assert.equal(
    hashSessionToken("abc123"),
    "6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090",
  );
});

test("generateSessionToken devuelve token hex de 64 caracteres y no repite fácilmente", () => {
  const tokenA = generateSessionToken();
  const tokenB = generateSessionToken();

  assert.match(tokenA, /^[0-9a-f]{64}$/);
  assert.match(tokenB, /^[0-9a-f]{64}$/);
  assert.notEqual(tokenA, tokenB);
});

test("verifyPassword valida hash legacy y marca needsRehash", async () => {
  const storedHash = hashLegacyPassword("abc123");

  const validResult = await verifyPassword("abc123", storedHash);
  const invalidResult = await verifyPassword("otro", storedHash);

  assert.deepEqual(validResult, {
    valid: true,
    needsRehash: true,
  });

  assert.deepEqual(invalidResult, {
    valid: false,
    needsRehash: false,
  });
});

test("hashPassword genera hash argon2 y verifyPassword lo valida", async () => {
  const hash = await hashPassword("abc123");

  assert.match(hash, /^\$argon2/);

  const result = await verifyPassword("abc123", hash);

  assert.equal(result.valid, true);
  assert.equal(typeof result.needsRehash, "boolean");
});

test("verifyPassword rechaza password inválida contra hash argon2", async () => {
  const hash = await hashPassword("abc123");

  const result = await verifyPassword("incorrecta", hash);

  assert.deepEqual(result, {
    valid: false,
    needsRehash: false,
  });
});
