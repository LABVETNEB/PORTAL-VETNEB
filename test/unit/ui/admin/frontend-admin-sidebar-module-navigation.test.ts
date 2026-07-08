import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";
const SIDEBAR_FRAME_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";
const ADMIN_CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin sidebar module items navigate with ?module= query params", () => {
  const sidebar = read(ADMIN_SIDEBAR_PATH);

  for (const moduleId of [
    "admin-report-upload",
    "admin-health",
    "admin-clinics",
    "admin-particular-tokens",
    "admin-pricing",
    "admin-sessions",
    "admin-users-roles",
    "audit-log",
    "admin-maintenance",
  ]) {
    assert.ok(
      sidebar.includes(`\`\${ROUTES.dashboardAdmin}?module=${moduleId}\``),
      `admin sidebar must navigate to module ${moduleId} via ?module=`,
    );
  }
});

test("admin sidebar drops legacy hash-anchor module links", () => {
  const sidebar = read(ADMIN_SIDEBAR_PATH);

  assert.equal(
    /\$\{ROUTES\.dashboardAdmin\}#/.test(sidebar),
    false,
    "admin sidebar must not keep hash-anchor module links",
  );
});

test("admin sidebar keeps the home item as an exact non-module link", () => {
  const sidebar = read(ADMIN_SIDEBAR_PATH);

  assert.ok(sidebar.includes('label: "Administración"'));
  assert.ok(sidebar.includes("href: ROUTES.dashboardAdmin,"));
  assert.ok(sidebar.includes("exact: true,"));
});

test("every admin sidebar module id is a valid controller AdminModule", () => {
  const sidebar = read(ADMIN_SIDEBAR_PATH);
  const controller = read(ADMIN_CONTROLLER_PATH);

  const moduleIds = [...sidebar.matchAll(/\?module=([a-z-]+)/g)].map(
    (match) => match[1],
  );

  assert.equal(
    moduleIds.length,
    9,
    `expected 9 module links in admin sidebar, got ${moduleIds.length}`,
  );

  for (const moduleId of moduleIds) {
    assert.ok(
      controller.includes(`"${moduleId}"`),
      `controller must define module ${moduleId} as an AdminModule`,
    );
  }
});

test("sidebar frame resolves active state from the module query param", () => {
  const frame = read(SIDEBAR_FRAME_PATH);

  assert.ok(
    frame.includes('import { usePathname, useSearchParams } from "next/navigation";'),
    "frame must read pathname and search params from next/navigation",
  );
  assert.ok(
    frame.includes('const activeModule = searchParams.get("module");'),
    "frame must read the active module from search params",
  );
  assert.ok(
    frame.includes("function getModuleFromHref(href: string)"),
    "frame must parse the module id from nav item hrefs",
  );
  assert.ok(
    frame.includes("return pathname === hrefPath && activeModule === hrefModule;"),
    "module items must match path and module exactly",
  );
  assert.ok(
    frame.includes("if (exact) return pathname === hrefPath && !activeModule;"),
    "exact home items must deactivate once a module is selected",
  );
});

test("sidebar frame strips query and hash before comparing paths", () => {
  const frame = read(SIDEBAR_FRAME_PATH);

  assert.ok(
    frame.includes("return href.split(/[?#]/)[0] || href;"),
    "getPathFromHref must strip both query and hash segments",
  );
});
