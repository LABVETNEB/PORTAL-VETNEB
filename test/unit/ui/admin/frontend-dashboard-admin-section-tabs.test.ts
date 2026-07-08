import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isClean7aAllowedDependencyChange } from "./helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "./helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "./helpers/dashboard-scope-guard.ts";

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

test("dashboard admin integrates tabs below module hub, command center and critical alerts", () => {
  const source = read(ADMIN_PAGE_PATH);

  // PR5C: AdminSectionTabs replaced by per-module workspace isolation.
  assert.ok(source.includes("<AdminDashboardWorkspaceController"));
  assert.ok(source.includes('"admin-health"'));
  assert.ok(source.includes('"admin-report-upload"'));
  assert.ok(source.includes('"admin-particular-tokens"'));
  assert.ok(source.includes('"admin-sessions"'));
  assert.ok(source.includes('"admin-users-roles"'));
  assert.ok(source.includes('"admin-pricing"'));
  assert.ok(source.includes('"audit-log"'));

  // App Shell: slot vars defined before <main>; the page header is now a
  // controller prop, so it appears after the controller opening tag.
  const order = [
    "<AdminCommandCenter",
    "Alertas críticas",
    "<AdminFailedLoginAlertsReadOnlyCard />",
    "<AdminDashboardWorkspaceController",
    "<DashboardPageHeader",
  ].map((marker) => source.indexOf(marker));

  for (const index of order) {
    assert.ok(index >= 0, `admin workspaces source must contain ordered marker ${index}`);
  }

  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    "admin workspaces must stay below command center and critical alerts",
  );
});

test("dashboard admin tabs preserve existing admin cards and audit filter contracts", () => {
  const source = read(ADMIN_PAGE_PATH);

  for (const marker of [
    "<AdminCommandCenter",
    "<AdminDashboardWorkspaceController",
    "<AdminFailedLoginAlertsReadOnlyCard />",
    "<AdminClinicsManagementCard />",
    "<AdminSchemaHealthStatusCard />",
    "<AdminMaintenanceDryRunCard />",
    "<AdminParticularTokensCard />",
    "<AdminPricingEditorCard />",
    "<AdminSessionsReadOnlyCard />",
    "<AdminUsersRolesReadOnlyCard />",
    "<AdminAuditCard",
  ]) {
    assert.ok(source.includes(marker), `admin page must keep ${marker}`);
  }

  // R-06: pagination (offset/limit) moved client-side into AdminAuditCard
  // (RF debounced, viewport-adaptive); page.tsx no longer owns audit offset.
  assert.equal(source.includes("const auditQuery: AdminAuditQuery = {"), false);
  assert.equal(source.includes("ADMIN_AUDIT_PAGE_SIZE"), false);

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
  // PR-specific guard: only enforce when the diff touches dashboard scope.
  if (!dashboardScopeGuardApplies(changedFiles)) return;
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
    "frontend/src/app/histopatologia-veterinaria/",
  ];

  const pr4ServerFiles = [
    "server/db.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/contact.fastify.ts",
  ];
  for (const file of changedFiles) {
    if (isClean7aAllowedDependencyChange(file)) continue;
    if (isReportForeignAccessBackendFile(file)) continue;
    if (pr4ServerFiles.includes(file)) continue;
    assert.equal(
      forbiddenChangedPaths.some((path) => file.startsWith(path)),
      false,
      `PR-7 must not modify forbidden path ${file}`,
    );
  }
});
