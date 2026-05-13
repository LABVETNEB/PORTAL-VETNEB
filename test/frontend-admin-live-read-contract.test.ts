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
  assertIncludes(source, "let auditEntries: Awaited<ReturnType<typeof getAuditEntries>> = [];", adminPage);
  assertIncludes(source, "let auditEntriesLoadError = false;", adminPage);
  assertIncludes(source, "auditEntries = await getAuditEntries(await getAdminRequestOptions(), {", adminPage);
  assertIncludes(source, "throwOnError: true,", adminPage);
  assertIncludes(source, "auditEntriesLoadError = true;", adminPage);
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
  assertIncludes(source, "readOptions: AdminReadOptions = {}", frontendApiClient);
  assertIncludes(source, '"/api/admin/audit-log"', frontendApiClient);
  assertIncludes(source, "options,", frontendApiClient);
  assertIncludes(
    source,
    'console.warn("[API] getAuditEntries: endpoint no disponible")',
    frontendApiClient,
  );
  assertIncludes(source, "if (readOptions.throwOnError) {", frontendApiClient);
  assertIncludes(source, "throw error;", frontendApiClient);
  assertIncludes(source, "return []", frontendApiClient);
  assertNotIncludes(source, "return MOCK_AUDIT_ENTRIES", frontendApiClient);
});


test("frontend admin failed-login alerts read-only UI queda montada", () => {
  const adminPageSource = read(adminPage);
  const apiSource = read(frontendApiClient);
  const cardSource = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  assertIncludes(
    adminPageSource,
    'import { AdminFailedLoginAlertsReadOnlyCard } from "./AdminFailedLoginAlertsReadOnlyCard";',
    adminPage,
  );
  assertIncludes(
    adminPageSource,
    "<AdminFailedLoginAlertsReadOnlyCard />",
    adminPage,
  );
  assertIncludes(
    apiSource,
    "export async function getAdminFailedLoginAlerts(",
    frontendApiClient,
  );
  assertIncludes(
    apiSource,
    "/api/admin/failed-login-alerts",
    frontendApiClient,
  );
  assertIncludes(
    cardSource,
    "getAdminFailedLoginAlerts(query)",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "Vista Admin read-only",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "no bloquea usuarios",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "no revoca sesiones",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertNotIncludes(
    cardSource,
    "tokenHash",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
});


test("frontend admin failed-login alerts expone export CSV read-only", () => {
  const apiSource = read(frontendApiClient);
  const cardSource = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  assertIncludes(
    apiSource,
    "export function buildAdminFailedLoginAlertsCsvUrl(",
    frontendApiClient,
  );
  assertIncludes(
    apiSource,
    "/api/admin/failed-login-alerts/export.csv",
    frontendApiClient,
  );
  assertIncludes(
    cardSource,
    "buildAdminFailedLoginAlertsCsvUrl",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "Exportar CSV",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "GET /api/admin/failed-login-alerts/export.csv",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "no bloquea usuarios",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "no revoca sesiones",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertNotIncludes(
    cardSource,
    "tokenHash",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
});


test("frontend admin failed-login alerts CSV usa filtros sin paginacion", () => {
  const cardSource = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  assertIncludes(
    cardSource,
    "const csvUrl = useMemo(",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "buildAdminFailedLoginAlertsCsvUrl({",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    '...(surface !== "all" ? { surface } : {})',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    '...(reason !== "all" ? { reason } : {})',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "[reason, surface]",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  const csvUrlBlock = cardSource.slice(
    cardSource.indexOf("const csvUrl = useMemo("),
    cardSource.indexOf("function loadFailedLoginAlerts()"),
  );

  assertNotIncludes(
    csvUrlBlock,
    "limit: PAGE_SIZE",
    "AdminFailedLoginAlertsReadOnlyCard.tsx csvUrl",
  );
  assertNotIncludes(
    csvUrlBlock,
    "offset",
    "AdminFailedLoginAlertsReadOnlyCard.tsx csvUrl",
  );
});


test("frontend admin failed-login alerts permite limpiar filtros sin mutaciones", () => {
  const cardSource = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  assertIncludes(
    cardSource,
    "function clearFailedLoginAlertFilters()",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    'setSurface("all")',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    'setReason("all")',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "setOffset(0)",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "Limpiar filtros",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "filtros reversibles",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "no bloquea usuarios",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "no revoca",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertNotIncludes(
    cardSource,
    "fetch(",
    "AdminFailedLoginAlertsReadOnlyCard.tsx clear filters",
  );
  assertNotIncludes(
    cardSource,
    "method: \"POST\"",
    "AdminFailedLoginAlertsReadOnlyCard.tsx clear filters",
  );
});


test("frontend admin failed-login alerts deshabilita limpiar filtros sin filtros activos", () => {
  const cardSource = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  assertIncludes(
    cardSource,
    "clearFailedLoginAlertFilters",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    'disabled={surface === "all" && reason === "all" && offset === 0}',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    'setSurface("all")',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    'setReason("all")',
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assertIncludes(
    cardSource,
    "setOffset(0)",
    "AdminFailedLoginAlertsReadOnlyCard.tsx",
  );

  const clearFiltersBlock = cardSource.slice(
    cardSource.indexOf("function clearFailedLoginAlertFilters()"),
    cardSource.indexOf("function loadFailedLoginAlerts()"),
  );

  assertNotIncludes(
    clearFiltersBlock,
    "fetch(",
    "AdminFailedLoginAlertsReadOnlyCard.tsx clear filters",
  );
  assertNotIncludes(
    clearFiltersBlock,
    "getAdminFailedLoginAlerts",
    "AdminFailedLoginAlertsReadOnlyCard.tsx clear filters",
  );
  assertNotIncludes(
    clearFiltersBlock,
    "buildAdminFailedLoginAlertsCsvUrl",
    "AdminFailedLoginAlertsReadOnlyCard.tsx clear filters",
  );
});
