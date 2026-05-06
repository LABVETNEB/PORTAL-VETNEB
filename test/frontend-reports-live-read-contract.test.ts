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

const reportsPage = "frontend/src/app/dashboard/informes/page.tsx";
const frontendApiClient = "frontend/src/lib/api.ts";

test("frontend reports page does not read mock data directly", () => {
  const source = read(reportsPage);

  assertNotIncludes(source, "@/lib/mock-data", reportsPage);
  assertNotIncludes(source, "MOCK_REPORTS", reportsPage);
  assertNotIncludes(source, "<strong>Mock data:</strong>", reportsPage);
  assertNotIncludes(source, "Mock data", reportsPage);
});

test("frontend reports page uses reports API client wrapper", () => {
  const source = read(reportsPage);

  assertIncludes(source, 'from "@/lib/api"', reportsPage);
  assertIncludes(source, "getReports", reportsPage);
  assertIncludes(source, "getReports(await getReportsRequestOptions())", reportsPage);
  assertIncludes(source, "reports.map", reportsPage);
  assertIncludes(source, "reports.length", reportsPage);
});

test("frontend reports page forces dynamic server reads with forwarded cookies", () => {
  const source = read(reportsPage);

  assertIncludes(source, 'import { cookies } from "next/headers";', reportsPage);
  assertIncludes(source, "async function getReportsRequestOptions()", reportsPage);
  assertIncludes(source, "(await cookies()).toString()", reportsPage);
  assertIncludes(source, 'cache: "no-store"', reportsPage);
  assertIncludes(source, "Cookie: cookieHeader", reportsPage);
  assertIncludes(source, "export default async function", reportsPage);
});

test("frontend reports API wrappers accept request options", () => {
  const source = read(frontendApiClient);

  assertIncludes(
    source,
    "export async function getReports(options?: RequestInit)",
    frontendApiClient,
  );
  assertIncludes(source, '"/api/reports", options', frontendApiClient);
  assertIncludes(source, "export async function searchReports(", frontendApiClient);
  assertIncludes(source, "options?: RequestInit", frontendApiClient);
  assertIncludes(
    source,
    '`/api/reports/search${qs ? `?${qs}` : ""}`',
    frontendApiClient,
  );
  assertIncludes(source, "return MOCK_REPORTS", frontendApiClient);
});
