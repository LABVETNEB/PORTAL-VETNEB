import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const CONFIG = "frontend/src/features/dashboard/config/dashboardModules.ts";
const NAVIGATION =
  "frontend/src/features/dashboard/application/dashboardModuleNavigation.ts";
const CONTROLLER =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const MOBILE_NAV = "frontend/src/components/dashboard/DashboardMobileNav.tsx";
const DRAWER = "frontend/src/components/dashboard/NavigationDrawer.tsx";
const RAIL = "frontend/src/components/dashboard/NavigationRail.tsx";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

test("B13 · the admin entry grammar owns an explicit default and hub URL", () => {
  const config = read(CONFIG);
  const navigation = read(NAVIGATION);

  assert.ok(
    config.includes('export const DEFAULT_ADMIN_MODULE: AdminModule = "admin";'),
    "the bare admin landing has an explicit operational default",
  );
  assert.ok(config.includes('id: "home"'), "Inicio is declared by the catalog");
  assert.ok(navigation.includes('ADMIN_HUB_QUERY_PARAM = "hub"'));
  assert.ok(navigation.includes('ADMIN_HUB_QUERY_VALUE = "1"'));
  assert.ok(navigation.includes("function isAdminHubRequested"));
  assert.ok(navigation.includes("function buildAdminHubHref"));
  assert.ok(navigation.includes("ROUTES.dashboardAdmin"));
});

test("B13 · entry precedence preserves URL intent and restores the durable hub", () => {
  const source = read(CONTROLLER);

  assert.ok(
    source.includes("parseAdminModule(searchParams.get(MODULE_QUERY_PARAM))"),
    "module parsing remains the controller's URL authority",
  );
  assert.ok(
    source.includes(
      "if (searchParams.get(MODULE_QUERY_PARAM) || isAdminHubRequested(searchParams)) return;",
    ),
    "any module URL and ?hub=1 win over storage",
  );
  assert.ok(
    source.includes("const landingModule = lastModule ?? DEFAULT_ADMIN_MODULE;"),
    "missing, stale, or unavailable storage falls back to the default",
  );
  assert.ok(
    source.includes("buildDashboardModuleHref(ROUTES.dashboardAdmin, landingModule)"),
    "the bare landing is canonicalized with replace",
  );
  assert.ok(source.includes("router.replace(buildAdminHubHref(), { scroll: false });"));
  assert.ok(source.includes("setHasManuallyReturnedToHub(true);"));
  assert.ok(source.includes("pendingNavigationIntent"));
  assert.ok(source.includes("pendingActivation"));
  assert.ok(source.includes("previousUrlModule"));
  assert.ok(source.includes("currentUrlModule"));
});

test("B13 · every admin Inicio target is explicit and does not clear persistence", () => {
  for (const path of [MOBILE_NAV, DRAWER, RAIL]) {
    const source = read(path);
    assert.ok(source.includes("buildAdminHubHref()"), `${path} links Inicio to ?hub=1`);
  }

  const mobile = read(MOBILE_NAV);
  assert.equal(
    mobile.includes('writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, "")'),
    false,
    "admin Inicio must not erase the durable last module",
  );
});

test("B13 · the lateral rail reserves a viewport budget for Inicio", () => {
  const css = read(NAVIGATION_CSS);
  assert.ok(css.includes("max-height: 759.98px"));
});
