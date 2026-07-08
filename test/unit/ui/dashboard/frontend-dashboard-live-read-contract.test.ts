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

const dashboardPage = "frontend/src/app/dashboard/page.tsx";
const frontendApiClient = "frontend/src/lib/api.ts";

test("frontend dashboard page does not read mock data directly", () => {
  const source = read(dashboardPage);

  assertNotIncludes(source, "@/lib/mock-data", dashboardPage);
  assertNotIncludes(source, "MOCK_DASHBOARD_STATS", dashboardPage);
  assertNotIncludes(source, "MOCK_REPORTS", dashboardPage);
  assertNotIncludes(source, "MOCK_FIELD_VISITS", dashboardPage);
  assertNotIncludes(source, "Modo demo", dashboardPage);
  assertNotIncludes(source, "mock data", dashboardPage);
});

test("frontend dashboard page uses API client wrappers", () => {
  const source = read(dashboardPage);

  assertIncludes(source, 'from "@/lib/api"', dashboardPage);
  assertIncludes(source, "getDashboardStats", dashboardPage);
  assertIncludes(source, "getReports", dashboardPage);
  assertIncludes(source, "getLogisticsFieldVisits", dashboardPage);
  assertIncludes(source, "Promise.all", dashboardPage);
  assertIncludes(source, "let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;", dashboardPage);
  assertIncludes(source, "let statsLoadError = false;", dashboardPage);
  assertIncludes(source, "stats = await getDashboardStats(requestOptions);", dashboardPage);
  assertIncludes(source, "statsLoadError = true;", dashboardPage);
  assertIncludes(source, "let reports: Awaited<ReturnType<typeof getReports>> = [];", dashboardPage);
  assertIncludes(source, "let reportsLoadError = false;", dashboardPage);
  assertIncludes(source, "let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];", dashboardPage);
  assertIncludes(source, "let visitsLoadError = false;", dashboardPage);
  // Zero-scroll adaptive density: the workspace summaries paginate a
  // viewport-safe superset (24, matching INFORMES_LIMIT_CAP) client-side.
  assertIncludes(
    source,
    "getReports(requestOptions, { limit: 24, offset: 0 }, {",
    dashboardPage,
  );
  assertIncludes(source, "getLogisticsFieldVisits(requestOptions, {", dashboardPage);
  assertIncludes(source, "throwOnError: true,", dashboardPage);
});

test("frontend dashboard clinic command center exposes load error messages", () => {
  const clinicCommandCenterPath = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
  const source = read(clinicCommandCenterPath);

  assertIncludes(source, "No se pudieron cargar las métricas operativas. Intente nuevamente.", clinicCommandCenterPath);
  assertIncludes(source, "statsLoadError ?", clinicCommandCenterPath);
  assertIncludes(source, "reportsLoadError ?", clinicCommandCenterPath);
  assertIncludes(source, "visitsLoadError ?", clinicCommandCenterPath);
});

test("frontend dashboard page forces dynamic server reads with forwarded cookies", () => {
  const source = read(dashboardPage);

  assertIncludes(source, 'import { cookies } from "next/headers";', dashboardPage);
  assertIncludes(source, "async function getDashboardRequestOptions()", dashboardPage);
  assertIncludes(source, "(await cookies()).toString()", dashboardPage);
  assertIncludes(source, 'cache: "no-store"', dashboardPage);
  assertIncludes(source, "Cookie: cookieHeader", dashboardPage);
  assertIncludes(source, "export default async function", dashboardPage);
});

test("frontend dashboard stats are computed from live-read wrappers", () => {
  const source = read(frontendApiClient);

  assertIncludes(
    source,
    "export async function getDashboardStats(",
    frontendApiClient,
  );
  assertIncludes(source, "options?: RequestInit", frontendApiClient);
  assertIncludes(source, "getReports(options, undefined, { throwOnError: true })", frontendApiClient);
  assertIncludes(source, "getLogisticsFieldVisits(options, { throwOnError: true })", frontendApiClient);
  assertIncludes(source, "getRoutePlans(options, { throwOnError: true })", frontendApiClient);
  assertIncludes(source, "totalReports: reports.length", frontendApiClient);
  assertIncludes(source, "pendingReports:", frontendApiClient);
  assertIncludes(source, "activeVisits:", frontendApiClient);
  assertIncludes(source, "activePlans:", frontendApiClient);
});
