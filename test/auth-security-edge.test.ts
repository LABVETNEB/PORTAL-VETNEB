import test from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import {
  hashLegacyPassword,
  hashSessionToken,
  verifyPassword,
} from "../server/lib/auth-security.ts";

test("hashLegacyPassword y hashSessionToken generan sha256 estable para string vacío", () => {
  const expected =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  assert.equal(hashLegacyPassword(""), expected);
  assert.equal(hashSessionToken(""), expected);
});

test("verifyPassword con argon2 válido expone needsRehash true cuando argon2 lo indica", async () => {
  const originalVerify = argon2.verify;
  const originalNeedsRehash = argon2.needsRehash;

  let verifyCalls = 0;
  let needsRehashCalls = 0;

  (argon2 as any).verify = async (storedHash: string, password: string) => {
    verifyCalls += 1;
    assert.equal(storedHash, "$argon2id$test-hash");
    assert.equal(password, "abc123");
    return true;
  };

  (argon2 as any).needsRehash = async (storedHash: string) => {
    needsRehashCalls += 1;
    assert.equal(storedHash, "$argon2id$test-hash");
    return true;
  };

  try {
    const result = await verifyPassword("abc123", "$argon2id$test-hash");

    assert.deepEqual(result, {
      valid: true,
      needsRehash: true,
    });
  } finally {
    (argon2 as any).verify = originalVerify;
    (argon2 as any).needsRehash = originalNeedsRehash;
  }

  assert.equal(verifyCalls, 1);
  assert.equal(needsRehashCalls, 1);
});

test("verifyPassword con argon2 válido expone needsRehash false cuando no hace falta", async () => {
  const originalVerify = argon2.verify;
  const originalNeedsRehash = argon2.needsRehash;

  let verifyCalls = 0;
  let needsRehashCalls = 0;

  (argon2 as any).verify = async () => {
    verifyCalls += 1;
    return true;
  };

  (argon2 as any).needsRehash = async () => {
    needsRehashCalls += 1;
    return false;
  };

  try {
    const result = await verifyPassword("abc123", "$argon2id$test-hash");

    assert.deepEqual(result, {
      valid: true,
      needsRehash: false,
    });
  } finally {
    (argon2 as any).verify = originalVerify;
    (argon2 as any).needsRehash = originalNeedsRehash;
  }

  assert.equal(verifyCalls, 1);
  assert.equal(needsRehashCalls, 1);
});

test("verifyPassword con argon2 inválido no consulta needsRehash", async () => {
  const originalVerify = argon2.verify;
  const originalNeedsRehash = argon2.needsRehash;

  let needsRehashCalls = 0;

  (argon2 as any).verify = async () => false;

  (argon2 as any).needsRehash = async () => {
    needsRehashCalls += 1;
    return true;
  };

  try {
    const result = await verifyPassword("incorrecta", "$argon2id$test-hash");

    assert.deepEqual(result, {
      valid: false,
      needsRehash: false,
    });
  } finally {
    (argon2 as any).verify = originalVerify;
    (argon2 as any).needsRehash = originalNeedsRehash;
  }

  assert.equal(needsRehashCalls, 0);
});

test("verifyPassword propaga error de argon2.verify", async () => {
  const originalVerify = argon2.verify;
  const originalNeedsRehash = argon2.needsRehash;

  const expectedError = new Error("argon2 verify failed");

  (argon2 as any).verify = async () => {
    throw expectedError;
  };

  (argon2 as any).needsRehash = async () => false;

  try {
    await assert.rejects(
      verifyPassword("abc123", "$argon2id$test-hash"),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (argon2 as any).verify = originalVerify;
    (argon2 as any).needsRehash = originalNeedsRehash;
  }
});
