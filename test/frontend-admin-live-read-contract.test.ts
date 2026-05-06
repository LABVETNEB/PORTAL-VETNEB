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
const frontendApiClient = "frontend/src/lib/api.ts";

test("frontend admin page does not read audit mock data directly", () => {
  const source = read(adminPage);

  assertNotIncludes(source, "@/lib/mock-data", adminPage);
  assertNotIncludes(source, "MOCK_AUDIT_ENTRIES", adminPage);
  assertNotIncludes(source, "<strong>Mock data:</strong>", adminPage);
});

test("frontend admin page uses audit API client wrapper", () => {
  const source = read(adminPage);

  assertIncludes(source, 'from "@/lib/api"', adminPage);
  assertIncludes(source, "getAuditEntries", adminPage);
  assertIncludes(source, "getAuditEntries(await getAdminRequestOptions())", adminPage);
  assertIncludes(source, "auditEntries.reduce", adminPage);
  assertIncludes(source, "auditEntries.map", adminPage);
});

test("frontend admin page forces dynamic server reads with forwarded cookies", () => {
  const source = read(adminPage);

  assertIncludes(source, 'import { cookies } from "next/headers";', adminPage);
  assertIncludes(source, "async function getAdminRequestOptions()", adminPage);
  assertIncludes(source, "(await cookies()).toString()", adminPage);
  assertIncludes(source, 'cache: "no-store"', adminPage);
  assertIncludes(source, "Cookie: cookieHeader", adminPage);
  assertIncludes(source, "export default async function", adminPage);
});

test("frontend admin audit API wrapper accepts request options", () => {
  const source = read(frontendApiClient);

  assertIncludes(
    source,
    "export async function getAuditEntries(",
    frontendApiClient,
  );
  assertIncludes(source, "options?: RequestInit", frontendApiClient);
  assertIncludes(source, '"/api/admin/audit-log"', frontendApiClient);
  assertIncludes(source, "options,", frontendApiClient);
  assertIncludes(source, "return MOCK_AUDIT_ENTRIES", frontendApiClient);
});
