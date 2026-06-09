import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_SECTION_TABS_PATH =
  "frontend/src/app/dashboard/admin/AdminSectionTabs.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertNoForbiddenSurfaceImports(source: string, context: string): void {
  const importLines = source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "));
  const forbiddenPatterns = [
    /next\/link/,
    /@\/app\/api/,
    /@\/middleware/,
    /@\/lib\/api/,
    /@\/lib\/auth/,
    /@\/components\/public/,
    /\.\.\/.*\/api/,
    /\.\.\/.*\/auth/,
    /\.\.\/.*\/middleware/,
    /\.\.\/.*\/public/,
  ];

  for (const line of importLines) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(line),
        false,
        `${context} must not import forbidden surface via: ${line}`,
      );
    }
  }
}

test("AdminSectionTabs exposes an isolated presentational tab contract", () => {
  const source = read(ADMIN_SECTION_TABS_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("export type AdminSectionTab = {"));
  assert.ok(source.includes("id: string;"));
  assert.ok(source.includes("label: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("badge?: ReactNode;"));
  assert.ok(source.includes("content: ReactNode;"));
  assert.ok(source.includes("anchorIds?: string[];"));
  assert.ok(source.includes("tabs: AdminSectionTab[];"));
  assert.ok(source.includes("defaultTabId?: string;"));
  assert.ok(source.includes("className?: string;"));
  assert.ok(source.includes("isRenderableContent"));
  assert.ok(source.includes("availableTabs"));
});

test("AdminSectionTabs uses buttons and accessible tab semantics without links", () => {
  const source = read(ADMIN_SECTION_TABS_PATH);

  assert.ok(source.includes('role="tablist"'));
  assert.ok(source.includes('role="tab"'));
  assert.ok(source.includes('role="tabpanel"'));
  assert.ok(source.includes('type="button"'));
  assert.ok(source.includes("aria-selected"));
  assert.ok(source.includes("aria-controls"));
  assert.ok(source.includes('aria-orientation="horizontal"'));
  assert.ok(source.includes("focus-visible"));
  assert.ok(source.includes("overflow-x-auto"));
  assert.ok(source.includes("onKeyDown"));
  assert.ok(source.includes('event.key === "Home"'));
  assert.ok(source.includes('event.key === "End"'));
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("href="), false);
  assert.equal(source.includes("fetch("), false);
  assertNoForbiddenSurfaceImports(source, "AdminSectionTabs");
});

test("dashboard admin integrates tabs below command center and critical alerts", () => {
  const source = read(ADMIN_PAGE_PATH);
  const mainSource = source.slice(source.indexOf('<main className="dashboard-main">'));

  assert.ok(source.includes('import { AdminSectionTabs } from "./AdminSectionTabs";'));
  assert.ok(source.includes("<AdminSectionTabs"));
  assert.ok(source.includes('defaultTabId="sistema"'));
  assert.ok(source.includes('label: "Sistema"'));
  assert.ok(source.includes('label: "Gestión"'));
  assert.ok(source.includes('label: "Seguridad"'));
  assert.ok(source.includes('label: "Configuración/Auditoría"'));
  assert.ok(source.includes('"admin-health"'));
  assert.ok(source.includes('"admin-report-upload"'));
  assert.ok(source.includes('"admin-particular-tokens"'));
  assert.ok(source.includes('"admin-sessions"'));
  assert.ok(source.includes('"admin-users-roles"'));
  assert.ok(source.includes('"admin-pricing"'));
  assert.ok(source.includes('"audit-log"'));

  const order = [
    "<DashboardPageHeader",
    "<StickyActionBar",
    "<AdminCommandCenter",
    "Alertas críticas",
    "<AdminFailedLoginAlertsReadOnlyCard />",
    "<AdminSectionTabs",
  ].map((marker) => mainSource.indexOf(marker));

  for (const index of order) {
    assert.ok(index >= 0, `admin tabs source must contain ordered marker ${index}`);
  }

  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    "admin tabs must stay below command center and critical alerts",
  );
});

test("dashboard admin tabs preserve existing admin cards and audit filter contracts", () => {
  const source = read(ADMIN_PAGE_PATH);

  for (const marker of [
    "<AdminCommandCenter",
    "<StickyActionBar",
    "<AdminFailedLoginAlertsReadOnlyCard />",
    "<AdminClinicsManagementCard />",
    "<AdminSchemaHealthStatusCard />",
    "<AdminMaintenanceDryRunCard />",
    "<AdminParticularTokensCard />",
    "<AdminPricingEditorCard />",
    "<AdminSessionsReadOnlyCard />",
    "<AdminUsersRolesReadOnlyCard />",
    'id="audit-log"',
    "buildAdminAuditFilterHref",
    'return qs ? `/dashboard/admin?${qs}#audit-log` : "/dashboard/admin#audit-log";',
  ]) {
    assert.ok(source.includes(marker), `admin page must keep ${marker}`);
  }

  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("fetch("), false);
});

test("dashboard admin tabs stay inside frontend-only PR-7 scope", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const forbiddenChangedPaths = [
    "package.json",
    "pnpm-lock.yaml",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/next-env.d.ts",
    "server/",
    "shared/",
    "frontend/src/app/api/",
    "frontend/src/middleware",
    "middleware",
    "frontend/src/app/page.tsx",
    "frontend/src/app/servicios/",
    "frontend/src/app/histopatologia-veterinaria/",
  ];

  const pr4ServerFiles = ["server/db.ts", "server/routes/reports.fastify.ts"];
  for (const file of changedFiles) {
    if (pr4ServerFiles.includes(file)) continue;
    assert.equal(
      forbiddenChangedPaths.some((path) => file.startsWith(path)),
      false,
      `PR-7 must not modify forbidden path ${file}`,
    );
  }
});
