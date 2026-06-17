import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertIncludes(source: string, expected: string, context: string): void {
  assert.ok(source.includes(expected), `${context} missing ${expected}`);
}

function assertNotIncludes(
  source: string,
  unexpected: string,
  context: string,
): void {
  assert.ok(
    !source.includes(unexpected),
    `${context} must not include ${unexpected}`,
  );
}

const adminPage = "frontend/src/app/dashboard/admin/page.tsx";
const adminAuditTable =
  "frontend/src/app/dashboard/admin/AdminAuditLogTable.tsx";

test("frontend admin metadata keeps sensitive key guard centralized", () => {
  const source = read(adminPage);

  assertIncludes(
    source,
    "const SENSITIVE_AUDIT_METADATA_KEY_PARTS = [",
    adminPage,
  );

  for (const sensitiveKeyPart of [
    "password",
    "token",
    "secret",
    "cookie",
    "auth",
    "hash",
    "storage",
  ]) {
    assertIncludes(source, `"${sensitiveKeyPart}"`, adminPage);
  }

  assertIncludes(source, "function isSensitiveAuditMetadataKey", adminPage);
  assertIncludes(source, "const normalizedKey = key.toLowerCase()", adminPage);
  assertIncludes(source, "normalizedKey.includes(part)", adminPage);
});

test("frontend admin metadata filters sensitive keys before display", () => {
  const source = read(adminPage);

  assertIncludes(source, "Object.entries(metadata)", adminPage);
  assert.match(
    source,
    /!\s*isSensitiveAuditMetadataKey\(key\)/,
    "metadata display must filter sensitive keys",
  );
  assertIncludes(source, "value !== null", adminPage);
  assertIncludes(source, "value !== undefined", adminPage);
  assertIncludes(source, 'value !== ""', adminPage);
  assertIncludes(
    source,
    "`${key}: ${formatAuditMetadataValue(value)}`",
    adminPage,
  );
});

test("frontend admin role-change metadata summary only reads approved fields", () => {
  const source = read(adminPage);
  const roleChangeBlockMatch = source.match(
    /if \(entry\.event === "clinic_user\.role\.changed"\) \{[\s\S]*?\n  \}/,
  );

  assert.ok(roleChangeBlockMatch, "role-change metadata block must exist");

  const roleChangeBlock = roleChangeBlockMatch[0];

  for (const safeField of [
    "metadata.username",
    "metadata.clinicName",
    "metadata.previousRole",
    "metadata.newRole",
  ]) {
    assertIncludes(roleChangeBlock, safeField, "role-change metadata block");
  }

  for (const forbiddenField of [
    "metadata.passwordHash",
    "metadata.tokenHash",
    "metadata.authProId",
    "metadata.secret",
    "metadata.cookie",
  ]) {
    assertNotIncludes(
      roleChangeBlock,
      forbiddenField,
      "role-change metadata block",
    );
  }
});
test("frontend admin audit table keeps detail column wired to safe metadata summary", () => {
  const source = read(adminPage);
  const tableSource = read(adminAuditTable);

  // App Shell: the audit registry table is a dedicated paginated client
  // component. The detail value is pre-sanitized server-side in page.tsx via
  // getAuditMetadataSummary, so the client only ever receives a safe string.
  assertIncludes(source, "getAuditMetadataSummary(entry)", adminPage);
  assertIncludes(source, "function getAuditMetadataSummary", adminPage);
  assert.match(
    source,
    /!\s*isSensitiveAuditMetadataKey\(key\)/,
    "detail column summary must keep sensitive metadata filtering",
  );

  assertIncludes(tableSource, "<TableHead>Detalle</TableHead>", adminAuditTable);
  assertIncludes(tableSource, "{entry.detail}", adminAuditTable);
  assertIncludes(tableSource, "colSpan={7}", adminAuditTable);
});
