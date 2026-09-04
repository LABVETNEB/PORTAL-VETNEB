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

  // CMP-02 — the hub grammar is declared ONCE for both roles. The `?hub=1`
  // literals and the admin-named helpers survive as delegating aliases, so B13's
  // contract (an explicit, durable hub URL owned by the application layer) is
  // unchanged; it is simply no longer admin-only, which is what let the clinic
  // "Inicio" slot resolve to a module instead of an entry surface (DIF-041).
  assert.ok(navigation.includes('HUB_QUERY_PARAM = "hub"'));
  assert.ok(navigation.includes('HUB_QUERY_VALUE = "1"'));
  assert.ok(navigation.includes("function isHubRequested"));
  assert.ok(navigation.includes("function buildHubHref"));
  assert.ok(navigation.includes("ROUTES.dashboardAdmin"));

  // The admin-named aliases must keep resolving for the desktop call sites.
  assert.ok(navigation.includes("ADMIN_HUB_QUERY_PARAM = HUB_QUERY_PARAM"));
  assert.ok(navigation.includes("ADMIN_HUB_QUERY_VALUE = HUB_QUERY_VALUE"));
  assert.ok(navigation.includes("function isAdminHubRequested"));
  assert.ok(navigation.includes("function buildAdminHubHref"));

  // Both roles must be addressable, or the grammar is admin-only again.
  assert.ok(navigation.includes("ROUTES.dashboard,"), "the clinic hub base path is declared");
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
  // CMP-02 — the drawer and the rail are DESKTOP admin surfaces and keep the
  // admin-bound builder. The mobile bar serves both roles, so it links Inicio
  // through the surface-parameterised builder; the invariant B13 owns — an
  // explicit `?hub=1`, never a bare route — is unchanged for admin and now holds
  // for clinic too (audit DIF-041 / RC-015).
  for (const path of [DRAWER, RAIL]) {
    const source = read(path);
    assert.ok(source.includes("buildAdminHubHref()"), `${path} links Inicio to ?hub=1`);
  }
  assert.ok(
    read(MOBILE_NAV).includes("buildHubHref(surface)"),
    `${MOBILE_NAV} links Inicio to ?hub=1 for whichever surface owns the bar`,
  );

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
