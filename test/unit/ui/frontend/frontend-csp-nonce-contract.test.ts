import test from "node:test";
import assert from "node:assert/strict";

import {
  generateNonce,
  NONCE_PATTERN,
} from "../../../../frontend/src/lib/security/csp-nonce.ts";

test("generateNonce returns a non-empty string", () => {
  const nonce = generateNonce();
  assert.equal(typeof nonce, "string");
  assert.ok(nonce.length > 0, "nonce must not be empty");
});

test("generateNonce produces at least 128 bits of entropy", () => {
  const nonce = generateNonce();
  assert.ok(nonce.length >= 22, `nonce length too short: ${nonce.length}`);
});

test("two consecutive nonces are different", () => {
  const a = generateNonce();
  const b = generateNonce();
  assert.notEqual(a, b, "consecutive nonces must differ");
});

test("nonce uses only standard base64 characters", () => {
  const nonce = generateNonce();
  assert.match(nonce, NONCE_PATTERN);
});

test("nonce contains no whitespace, quote, semicolon, angle bracket or backslash", () => {
  const nonce = generateNonce();
  const forbidden = /[\s'";<>\\]/;
  assert.ok(!forbidden.test(nonce), `nonce contains forbidden characters: ${nonce}`);
});

test("a batch of 64 nonces are all unique", () => {
  const set = new Set<string>();
  for (let i = 0; i < 64; i += 1) {
    set.add(generateNonce());
  }
  assert.equal(set.size, 64, "expected 64 unique nonces");
});
