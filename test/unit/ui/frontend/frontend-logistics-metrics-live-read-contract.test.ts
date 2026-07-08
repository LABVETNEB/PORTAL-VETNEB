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

const logisticsMetricsPage =
  "frontend/src/app/dashboard/logistica/metricas/page.tsx";
const frontendApiClient = "frontend/src/lib/api.ts";

test("frontend logistics metrics page does not read mock data directly", () => {
  const source = read(logisticsMetricsPage);

  assertNotIncludes(source, "@/lib/mock-data", logisticsMetricsPage);
  assertNotIncludes(source, "MOCK_ROUTE_METRICS", logisticsMetricsPage);
  assertNotIncludes(source, "MOCK_ROUTE_PLANS", logisticsMetricsPage);
  assertNotIncludes(source, "<strong>Mock data:</strong>", logisticsMetricsPage);
});

test("frontend logistics metrics page uses API client wrappers", () => {
  const source = read(logisticsMetricsPage);

  assertIncludes(source, 'from "@/lib/api"', logisticsMetricsPage);
  assertIncludes(source, "getRoutePlans", logisticsMetricsPage);
  assertIncludes(source, "getRoutePlanMetrics", logisticsMetricsPage);
  assertIncludes(source, "Promise.all", logisticsMetricsPage);
  assertIncludes(source, "let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];", logisticsMetricsPage);
  assertIncludes(source, "let routePlansLoadError = false;", logisticsMetricsPage);
  assertIncludes(source, "let routeMetrics: Awaited<ReturnType<typeof getRoutePlanMetrics>> = [];", logisticsMetricsPage);
  assertIncludes(source, "let routeMetricsLoadError = false;", logisticsMetricsPage);
  assertIncludes(source, "getRoutePlans(requestOptions, {", logisticsMetricsPage);
  assertIncludes(source, "throwOnError: true,", logisticsMetricsPage);
  assertIncludes(source, "routePlans.map", logisticsMetricsPage);
  assertIncludes(
    source,
    "getRoutePlanMetrics(plan.id, requestOptions, {",
    logisticsMetricsPage,
  );
});

test("frontend logistics metrics page forces dynamic server reads with forwarded cookies", () => {
  const source = read(logisticsMetricsPage);

  assertIncludes(source, 'import { cookies } from "next/headers";', logisticsMetricsPage);
  assertIncludes(source, "async function getLogisticsRequestOptions()", logisticsMetricsPage);
  assertIncludes(source, "(await cookies()).toString()", logisticsMetricsPage);
  assertIncludes(source, 'cache: "no-store"', logisticsMetricsPage);
  assertIncludes(source, "Cookie: cookieHeader", logisticsMetricsPage);
  assertIncludes(source, "export default async function", logisticsMetricsPage);
});

test("frontend logistics metrics API wrapper accepts request options", () => {
  const source = read(frontendApiClient);

  assertIncludes(
    source,
    "export async function getRoutePlanMetrics(",
    frontendApiClient,
  );
  assertIncludes(source, "planId?: number", frontendApiClient);
  assertIncludes(source, "options?: RequestInit", frontendApiClient);
  assertIncludes(source, "readOptions: LogisticsReadOptions = {},", frontendApiClient);
  assertIncludes(
    source,
    "`/api/logistics/route-plans/${planId}/metrics`",
    frontendApiClient,
  );
  assertIncludes(source, "options,", frontendApiClient);
  assertIncludes(
    source,
    'console.warn("[API] getRoutePlanMetrics: endpoint no disponible")',
    frontendApiClient,
  );
  assertIncludes(
    source,
    'console.warn("[API] getRoutePlanMetrics: requiere planId para usar endpoint real")',
    frontendApiClient,
  );
  assertIncludes(source, "if (readOptions.throwOnError) {", frontendApiClient);
  assertIncludes(source, "throw error;", frontendApiClient);
  assertIncludes(source, "return []", frontendApiClient);
});

