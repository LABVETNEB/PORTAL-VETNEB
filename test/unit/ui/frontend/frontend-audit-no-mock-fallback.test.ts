import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

test("frontend audit api client does not import audit mock dataset", () => {
  const source = read(API_CLIENT_PATH);

  assert.equal(source.includes("MOCK_AUDIT_ENTRIES"), false);
});

test("frontend audit api client uses real admin audit endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAuditEntries("));
  assert.ok(source.includes("/api/admin/audit-log"));
});

test("frontend audit api client returns empty state instead of mock fallback", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes(
      'console.warn("[API] getAuditEntries: endpoint no disponible")',
    ),
  );
  assert.equal(
    source.includes('console.warn("[API] getAuditEntries: usando mock data")'),
    false,
  );
});
