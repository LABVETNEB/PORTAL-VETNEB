import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const AUTH_SECURITY_PATH = "server/lib/auth-security.ts";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("auth security uses one argon2 policy for hashing and rehash checks", () => {
  const source = read(AUTH_SECURITY_PATH);

  assert.ok(source.includes("const PASSWORD_HASH_OPTIONS = {"));
  assert.ok(source.includes("return argon2.hash(password, PASSWORD_HASH_OPTIONS);"));
  assert.ok(
    source.includes(
      "argon2.needsRehash(storedHash, PASSWORD_HASH_OPTIONS)",
    ),
  );
  assert.equal(source.includes("argon2.needsRehash(storedHash))"), false);
});
