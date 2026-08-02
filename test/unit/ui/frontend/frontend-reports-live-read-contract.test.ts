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
const reportsList = "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
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
  const listSource = read(reportsList);

  assertIncludes(source, 'from "@/lib/api"', reportsPage);
  assertIncludes(source, "getReports", reportsPage);
  assertIncludes(source, "searchReports", reportsPage);
  assertIncludes(source, "const requestOptions = await getReportsRequestOptions();", reportsPage);
  assertIncludes(source, "pagedResult = query", reportsPage);
  assertIncludes(source, "? await searchReportsPaginated(", reportsPage);
  assertIncludes(source, ": await getReportsPaginated(", reportsPage);
  assertIncludes(source, "{ throwOnError: true }", reportsPage);
  assertIncludes(source, "const reports = pagedResult.reports", reportsPage);
  assertIncludes(listSource, "visibleReports.map", reportsList);
  assertIncludes(listSource, "reports.length", reportsList);
  assertIncludes(listSource, "totalCount", reportsList);
  assertIncludes(listSource, "reportsTotalPages", reportsList);
});

test("frontend reports page surfaces fetch failures separately from empty data", () => {
  const source = read(reportsPage);
  const listSource = read(reportsList);

  assertIncludes(source, "let reportsLoadError = false;", reportsPage);
  assertIncludes(source, "try {", reportsPage);
  assertIncludes(source, "reportsLoadError = true;", reportsPage);
  assertIncludes(listSource, "loadError ?", reportsList);
  assertIncludes(
    listSource,
    "No se pudieron cargar los informes. Intente nuevamente.",
    reportsList,
  );
  assertIncludes(listSource, 'role="alert"', reportsList);
  assertIncludes(listSource, "No hay informes disponibles.", reportsList);
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
    "export async function getReports(",
    frontendApiClient,
  );
  assertIncludes(source, "options?: RequestInit,", frontendApiClient);
  assertIncludes(source, "params?: {", frontendApiClient);
  assertIncludes(source, "status?: string;", frontendApiClient);
  assertIncludes(source, "throwOnError?: boolean;", frontendApiClient);
  assertIncludes(source, "readOptions: ReportReadOptions = {},", frontendApiClient);
  assertIncludes(
    source,
    '`/api/reports${qs ? `?${qs}` : ""}`',
    frontendApiClient,
  );
  assertIncludes(source, "export async function searchReports(", frontendApiClient);
  assertIncludes(source, "options?: RequestInit", frontendApiClient);
  assertIncludes(
    source,
    '`/api/reports/search${qs ? `?${qs}` : ""}`',
    frontendApiClient,
  );
  assertIncludes(source, "if (readOptions.throwOnError) {", frontendApiClient);
  assertIncludes(source, "throw error;", frontendApiClient);
  assertIncludes(
    source,
    'console.warn("[API] getReports: endpoint no disponible")',
    frontendApiClient,
  );
  assertIncludes(
    source,
    'console.warn("[API] searchReports: endpoint no disponible")',
    frontendApiClient,
  );
  assertIncludes(source, "return []", frontendApiClient);
  assertNotIncludes(source, "return MOCK_REPORTS", frontendApiClient);
});
