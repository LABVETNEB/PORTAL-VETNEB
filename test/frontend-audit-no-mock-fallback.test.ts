import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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
