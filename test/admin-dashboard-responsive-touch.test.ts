import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

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
  const source = read("frontend/src/app/globals.css");
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

test("DashboardModuleWorkspace back button has min-h touch target", () => {
  const source = read(
    "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx",
  );
  assert.ok(
    source.includes("min-h-[2.75rem]"),
    "DashboardModuleWorkspace back button must declare min-h-[2.75rem] touch target",
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
