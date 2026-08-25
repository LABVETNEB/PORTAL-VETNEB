import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readDashboardCssSource } from "../../../helpers/read-dashboard-css-source.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const TABLE_HEAVY_CARDS = [
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
];

test("admin table-heavy cards use dashboard-table-responsive wrapper", () => {
  for (const filePath of TABLE_HEAVY_CARDS) {
    const source = read(filePath);
    assert.ok(
      source.includes("dashboard-table-responsive"),
      `${filePath} must use dashboard-table-responsive for horizontal table scroll`,
    );
  }
});

test("globals.css defines dashboard-table-responsive with overflow-x scroll", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes(".dashboard-table-responsive"),
    "globals.css must define .dashboard-table-responsive",
  );
  assert.ok(
    source.includes("overflow-x: auto"),
    ".dashboard-table-responsive must set overflow-x: auto",
  );
  assert.ok(
    source.includes("overscroll-behavior-x: contain"),
    ".dashboard-table-responsive must set overscroll-behavior-x: contain",
  );
});

test("DashboardModuleWorkspace back button fits B11 and stays absent from Admin mobile", () => {
  const source = read(
    "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx",
  );
  const css = readDashboardCssSource();
  assert.ok(
    source.includes("min-h-10"),
    "the desktop back action must fit the canonical 40px WorkspaceHeader",
  );
  assert.match(
    css,
    /\[data-vetneb-app-shell-surface="admin"\][\s\S]*\[data-dashboard-module-workspace\][\s\S]*\.dashboard-workspace-header\s*\{\s*display:\s*none !important;/,
    "Admin mobile must keep the B09 header reclaim instead of painting a sub-44px touch action",
  );
});

test("AdminSessionsReadOnlyCard pagination buttons expand on mobile", () => {
  const source = read(
    "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  );
  assert.ok(
    source.includes("flex-1 sm:flex-none"),
    "AdminSessionsReadOnlyCard pagination buttons must use flex-1 sm:flex-none for mobile expansion",
  );
});

test("AdminFailedLoginAlertsReadOnlyCard pagination buttons expand on mobile", () => {
  const source = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  assert.ok(
    source.includes("flex-1 sm:flex-none"),
    "AdminFailedLoginAlertsReadOnlyCard pagination buttons must use flex-1 sm:flex-none",
  );
});

test("AdminUsersRolesReadOnlyCard pagination buttons expand on mobile", () => {
  const source = read(
    "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
  );
  assert.ok(
    source.includes("flex-1 sm:flex-none"),
    "AdminUsersRolesReadOnlyCard pagination buttons must use flex-1 sm:flex-none",
  );
});
