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

const logisticsOverviewPage =
  "frontend/src/app/dashboard/logistica/page.tsx";
const logisticsVisitsPage =
  "frontend/src/app/dashboard/logistica/visitas/page.tsx";
const logisticsRoutesPage =
  "frontend/src/app/dashboard/logistica/rutas/page.tsx";
const frontendApiClient = "frontend/src/lib/api.ts";

test("frontend logistics pages do not read mock data directly", () => {
  for (const path of [
    logisticsOverviewPage,
    logisticsVisitsPage,
    logisticsRoutesPage,
  ]) {
    const source = read(path);

    assertNotIncludes(source, "@/lib/mock-data", path);
    assertNotIncludes(source, "MOCK_FIELD_VISITS", path);
    assertNotIncludes(source, "MOCK_ROUTE_PLANS", path);
    assertNotIncludes(source, "<strong>Mock data:</strong>", path);
  }
});

test("frontend logistics pages use API client read wrappers", () => {
  const overview = read(logisticsOverviewPage);
  const visits = read(logisticsVisitsPage);
  const routes = read(logisticsRoutesPage);

  assertIncludes(overview, 'from "@/lib/api"', logisticsOverviewPage);
  assertIncludes(overview, "getLogisticsFieldVisits", logisticsOverviewPage);
  assertIncludes(overview, "getRoutePlans", logisticsOverviewPage);
  assertIncludes(overview, "Promise.all", logisticsOverviewPage);
  assertIncludes(
    overview,
    "getLogisticsFieldVisits(requestOptions)",
    logisticsOverviewPage,
  );
  assertIncludes(
    overview,
    "getRoutePlans(requestOptions)",
    logisticsOverviewPage,
  );

  assertIncludes(visits, 'from "@/lib/api"', logisticsVisitsPage);
  assertIncludes(visits, "getLogisticsFieldVisits", logisticsVisitsPage);
  assertIncludes(visits, "getLogisticsFieldVisits(", logisticsVisitsPage);
  assertIncludes(visits, "{ throwOnError: true }", logisticsVisitsPage);

  assertIncludes(routes, 'from "@/lib/api"', logisticsRoutesPage);
  assertIncludes(routes, "getRoutePlans", logisticsRoutesPage);
  assertIncludes(routes, "getRoutePlans(", logisticsRoutesPage);
});

test("frontend logistics visits page surfaces fetch failures separately from empty data", () => {
  const source = read(logisticsVisitsPage);

  assertIncludes(source, "let visitsLoadError = false;", logisticsVisitsPage);
  assertIncludes(source, "try {", logisticsVisitsPage);
  assertIncludes(source, "visitsLoadError = true;", logisticsVisitsPage);
  assertIncludes(source, "visitsLoadError ?", logisticsVisitsPage);
  assertIncludes(
    source,
    "No se pudieron cargar las visitas de campo. Intente nuevamente.",
    logisticsVisitsPage,
  );
  assertIncludes(source, 'role="alert"', logisticsVisitsPage);
  assertIncludes(source, "No hay visitas de campo disponibles.", logisticsVisitsPage);
});

test("frontend logistics pages force dynamic server reads with forwarded cookies", () => {
  for (const path of [
    logisticsOverviewPage,
    logisticsVisitsPage,
    logisticsRoutesPage,
  ]) {
    const source = read(path);

    assertIncludes(source, 'import { cookies } from "next/headers";', path);
    assertIncludes(source, "async function getLogisticsRequestOptions()", path);
    assertIncludes(source, "(await cookies()).toString()", path);
    assertIncludes(source, 'cache: "no-store"', path);
    assertIncludes(source, "Cookie: cookieHeader", path);
    assertIncludes(source, "export default async function", path);
  }
});

test("frontend logistics API wrappers accept request options for server-side reads", () => {
  const source = read(frontendApiClient);

  assertIncludes(source, "async function apiFetch<T>(", frontendApiClient);
  assertIncludes(source, "options: RequestInit = {}", frontendApiClient);
  assertIncludes(
    source,
    "const headers = new Headers(options.headers)",
    frontendApiClient,
  );
  assertIncludes(source, "...options", frontendApiClient);
  assertIncludes(
    source,
    'credentials: options.credentials ?? "include"',
    frontendApiClient,
  );

  assertIncludes(
    source,
    "export async function getLogisticsFieldVisits(",
    frontendApiClient,
  );
  assertIncludes(source, "options?: RequestInit", frontendApiClient);
  assertIncludes(source, "throwOnError?: boolean;", frontendApiClient);
  assertIncludes(source, "readOptions: LogisticsReadOptions = {},", frontendApiClient);
  assertIncludes(source, '"/api/logistics/field-visits"', frontendApiClient);
  assertIncludes(source, "options,", frontendApiClient);
  assertIncludes(source, "if (readOptions.throwOnError) {", frontendApiClient);
  assertIncludes(source, "throw error;", frontendApiClient);

  assertIncludes(
    source,
    "export async function getRoutePlans(",
    frontendApiClient,
  );
  assertIncludes(source, '"/api/logistics/route-plans"', frontendApiClient);
});
