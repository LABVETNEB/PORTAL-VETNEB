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
const adminAuditShared = "frontend/src/app/dashboard/admin/admin-audit-shared.ts";
const adminAuditTable =
  "frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx";

test("frontend admin metadata keeps sensitive key guard centralized", () => {
  const source = read(adminAuditShared);

  assertIncludes(
    source,
    "const SENSITIVE_AUDIT_METADATA_KEY_PARTS = [",
    adminAuditShared,
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
    assertIncludes(source, `"${sensitiveKeyPart}"`, adminAuditShared);
  }

  assertIncludes(source, "function isSensitiveAuditMetadataKey", adminAuditShared);
  assertIncludes(source, "const normalizedKey = key.toLowerCase()", adminAuditShared);
  assertIncludes(source, "normalizedKey.includes(part)", adminAuditShared);
});

test("frontend admin metadata filters sensitive keys before display", () => {
  const source = read(adminAuditShared);

  assertIncludes(source, "Object.entries(metadata)", adminAuditShared);
  assert.match(
    source,
    /!\s*isSensitiveAuditMetadataKey\(key\)/,
    "metadata display must filter sensitive keys",
  );
  assertIncludes(source, "value !== null", adminAuditShared);
  assertIncludes(source, "value !== undefined", adminAuditShared);
  assertIncludes(source, 'value !== ""', adminAuditShared);
  assertIncludes(
    source,
    "`${key}: ${formatAuditMetadataValue(value)}`",
    adminAuditShared,
  );
});

test("frontend admin role-change metadata summary only reads approved fields", () => {
  const source = read(adminAuditShared);
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
  const sharedSource = read(adminAuditShared);
  const tableSource = read(adminAuditTable);

  // The detail value is pre-sanitized server-side by shared audit helpers, and
  // page.tsx keeps wiring the safe display string into the table.
  assertIncludes(source, "getAuditMetadataSummary(entry)", adminPage);
  assertIncludes(sharedSource, "function getAuditMetadataSummary", adminAuditShared);
  assert.match(
    sharedSource,
    /!\s*isSensitiveAuditMetadataKey\(key\)/,
    "detail column summary must keep sensitive metadata filtering",
  );

  assertIncludes(tableSource, ">Detalle</TableHead>", adminAuditTable);
  assertIncludes(tableSource, "{row.detail}", adminAuditTable);
  assertIncludes(tableSource, "<AdminAuditDetailDialog row={row} />", adminAuditTable);
});
