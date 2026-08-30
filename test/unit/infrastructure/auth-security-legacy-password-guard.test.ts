import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_SECURITY_PATH = "server/lib/auth-security.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

// WBR-15 (VET-15, F1): the legacy SHA-256 password digest must remain
// verify-only. This guard checks the real caller census: hashLegacyPassword
// is used only inside auth-security.ts itself (never to create a stored
// hash from another module), while hashPassword (argon2id) is the only
// function called by password write surfaces.
function extractLegacyCompareCallSite(source: string): string {
  const match = source.match(
    /const valid = timingSafeHexEqual\(hashLegacyPassword\(password\), storedHash\);/,
  );
  assert.ok(match, "expected the timingSafeHexEqual legacy compare call site to exist");
  return match![0];
}

test("hashLegacyPassword is never called to create a new stored password hash outside auth-security.ts", () => {
  const writeSurfaces = [
    "server/features/clinics/admin-clinics-command-service.ts",
    "server/routes/admin-auth.fastify.ts",
    "server/routes/auth.fastify.ts",
  ];

  for (const file of writeSurfaces) {
    assert.doesNotMatch(
      read(file),
      /hashLegacyPassword/,
      `${file} must never call hashLegacyPassword directly`,
    );
  }
});

test("password write surfaces call hashPassword (argon2id), not the legacy digest", () => {
  const writeSurfaces = [
    "server/features/clinics/admin-clinics-command-service.ts",
    "server/routes/admin-auth.fastify.ts",
    "server/routes/auth.fastify.ts",
  ];

  for (const file of writeSurfaces) {
    assert.match(
      read(file),
      /hashPassword\(/,
      `${file} must call hashPassword for new/updated password hashes`,
    );
  }
});

test("the legacy password comparison uses timingSafeHexEqual, not a direct string comparison", () => {
  const source = read(AUTH_SECURITY_PATH);
  const callSite = extractLegacyCompareCallSite(source);

  assert.match(callSite, /timingSafeHexEqual\(/);
  assert.doesNotMatch(
    source,
    /hashLegacyPassword\(password\)\s*===\s*storedHash/,
    "the legacy path must not compare the digest with a direct === on the stored hash",
  );
});

test("auth-security.ts does not use ==, ===, or != for comparing password hash material", () => {
  const source = read(AUTH_SECURITY_PATH);

  // Scoped to this file's own hash-comparison surface (not a global ban):
  // no line assigning `valid` may use a direct equality operator against a
  // hash/digest variable.
  const validAssignmentLines = source
    .split("\n")
    .filter((line) => /\bconst valid\b/.test(line));

  for (const line of validAssignmentLines) {
    assert.doesNotMatch(
      line,
      /[!=]==?\s*storedHash|storedHash\s*[!=]==?/,
      `hash comparison must not use a direct equality operator: ${line.trim()}`,
    );
  }
});

test("negative proof: a mutated source reintroducing === on the stored hash is detected by the guard pattern", () => {
  const regressedSource =
    'const valid = hashLegacyPassword(password) === storedHash;';
  const fixedSource =
    'const valid = timingSafeHexEqual(hashLegacyPassword(password), storedHash);';

  assert.match(
    regressedSource,
    /[!=]==?\s*storedHash|storedHash\s*[!=]==?/,
    "the historical pattern must be detected as a violation",
  );
  assert.doesNotMatch(
    fixedSource,
    /[!=]==?\s*storedHash|storedHash\s*[!=]==?/,
    "the fixed pattern must not be flagged",
  );
});

test("auth-security-legacy-password-guard source stays ascii only", () => {
  const source = readFileSync(
    resolve(process.cwd(), "test/unit/infrastructure/auth-security-legacy-password-guard.test.ts"),
    "utf8",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `auth-security-legacy-password-guard source must stay ascii-only at index ${index}`,
    );
  }
});
