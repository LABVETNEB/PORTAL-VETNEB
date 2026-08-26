import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const REPO_ROOT = process.cwd();

const PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CONTROLLER_PATH =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
/** Retired by B09 together with the two per-role bottom navs it outlived. */
const RAIL_PATH = "frontend/src/components/dashboard/DashboardModuleRail.tsx";
const WORKSPACE_PATH =
  "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx";
// B08 retired DashboardHorizontalNav and B09 the rail; the regime boundary they
// used to declare is now one CSS fact about the single mobile owner.
const NAVIGATION_CSS_PATH = "frontend/src/styles/dashboard/navigation.css";
const MOBILE_NAV_PATH =
  "frontend/src/components/dashboard/DashboardMobileNav.tsx";
const SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const CATALOG_PATH =
  "frontend/src/features/dashboard/config/dashboardModules.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── The Home/hub is gone ─────────────────────────────────────────────────────

test("clinic dashboard removes every trace of the module hub/home", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);

  // No landing band, no module-tile grid, no "Módulos clínicos" section.
  assert.equal(page.includes("<DashboardPageHeader"), false);
  assert.equal(page.includes("Resumen operativo"), false);

  assert.equal(controller.includes("Módulos clínicos"), false);
  assert.equal(controller.includes('data-dashboard-module-hub'), false);
  assert.equal(controller.includes('data-clinic-cockpit'), false);
  assert.equal(controller.includes("ClinicDashboardCockpit"), false);
  assert.equal(controller.includes("clinic-hub-tile"), false);
  // No `activeModule === null` hub branch: the module is never nullable.
  assert.equal(controller.includes("ClinicModule | null>"), false);
});

// ── /dashboard resolves to the operational default ───────────────────────────

test("/dashboard resolves to the operational default module (operaciones)", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);

  // The operational default is the single source of truth in the config
  // catalog; the controller imports and re-exports it (compat) and resolves to
  // it, so `/dashboard` still opens straight into operaciones.
  const catalog = read(CATALOG_PATH);
  assert.ok(
    catalog.includes(
      'export const DEFAULT_CLINIC_MODULE: ClinicModule = "operaciones";',
    ),
  );
  assert.ok(controller.includes("export { DEFAULT_CLINIC_MODULE };"));
  // Server render already opens the default (no client-only flash to a hub).
  assert.ok(
    page.includes(
      "parseClinicModule(resolvedSearchParams.module) ?? DEFAULT_CLINIC_MODULE",
    ),
  );
  // Client controller also never falls back to null/hub.
  assert.ok(controller.includes("initialModule ?? DEFAULT_CLINIC_MODULE"));
  assert.ok(
    controller.includes(
      'parseClinicModule(searchParams.get("module")) ?? DEFAULT_CLINIC_MODULE',
    ),
  );
});

// ── Deep links keep working ──────────────────────────────────────────────────

test("clinic deep links (?module=) still drive the active module", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);

  assert.ok(page.includes("parseClinicModule(resolvedSearchParams.module)"));
  assert.ok(controller.includes('searchParams.get("module")'));
  // The canonical clinic module list is the single source of truth in the
  // config catalog; the route + controller drive the active module through the
  // shared `parseClinicModule` helper instead of a re-declared list.
  const catalog = read(CATALOG_PATH);
  assert.ok(catalog.includes("export const CLINIC_MODULE_IDS = ["));
  assert.ok(catalog.includes("export function parseClinicModule("));
  for (const moduleId of [
    "operaciones",
    "informes",
    "logistica",
    "perfil",
    "tokens",
  ]) {
    assert.ok(
      catalog.includes(`"${moduleId}"`),
      `catalog must know module ${moduleId}`,
    );
  }
});

// ── One shared navigation owner across every module and device ───────────────

test("DashboardMobileNav is the single shared module navigation below 768px", () => {
  const mobileNav = read(MOBILE_NAV_PATH);
  const controller = read(CONTROLLER_PATH);

  // The stage carries NO navigation any more. `DashboardModuleRail` used to be
  // rendered here and was the only thing on `/dashboard` that spent VERTICAL
  // budget on navigation; B09 retired it and moved the owner to shell level.
  assert.equal(controller.includes("DashboardModuleRail"), false);
  assert.equal(existsSync(resolve(REPO_ROOT, RAIL_PATH)), false);

  // Accessible landmark + deep-linkable controls, one owner for both roles.
  assert.ok(mobileNav.includes('"use client";'));
  assert.ok(mobileNav.includes("data-dashboard-mobile-nav={surface}"));
  assert.ok(mobileNav.includes('clinic: "Navegación móvil de clínica"'));
  assert.ok(mobileNav.includes("aria-label={SURFACE_LANDMARK[surface]}"));
  assert.ok(mobileNav.includes('aria-current={isActive ? "page" : undefined}'));
  assert.ok(
    mobileNav.includes(
      'import { PublicRouteControl } from "@/components/public/PublicRouteControl";',
    ),
  );
  assert.ok(mobileNav.includes("requestClinicModuleActivate"));
  assert.equal(/from "next\/link"/.test(mobileNav), false);
  assert.equal(/<a\s/.test(mobileNav), false);

  // The prev/next pager is NOT reproduced. It was a second grammar over the
  // same ordered modules — two affordances that could report different states —
  // and B07 already declined to carry it into the lateral model.
  assert.equal(mobileNav.includes("data-dashboard-module-rail-prev"), false);
  assert.equal(mobileNav.includes("data-dashboard-module-rail-next"), false);

  // Every clinic module is reachable via ?module=. The owner derives its items
  // (id/label/shortLabel/order) from the shared catalog and its glyphs from the
  // shared icon owner, so no module list is declared twice.
  assert.ok(mobileNav.includes("CLINIC_MODULE_NAV_LABELS"));
  assert.ok(mobileNav.includes("buildDashboardModuleHref"));
  const catalog = read(CATALOG_PATH);
  for (const moduleId of [
    "operaciones",
    "informes",
    "logistica",
    "perfil",
    "tokens",
  ]) {
    assert.ok(
      catalog.includes(`moduleId: "${moduleId}"`),
      `catalog must list module ${moduleId}`,
    );
  }
});

// ── One navigation model per regime on /dashboard ────────────────────────────

test("exactly one navigation model claims each regime on the main dashboard", () => {
  const navCss = read(NAVIGATION_CSS_PATH);

  // The desktop top-tab bar is gone entirely (B08 retired
  // `DashboardHorizontalNav`) and so is the rail (B09). What replaces both
  // suppression clauses is a single regime boundary: the mobile owner must not
  // paint from 768px up, where the lateral drawer/rail owns navigation.
  assert.match(
    navCss,
    /@media \(min-width: 768px\)[^@]*\.dashboard-mobile-nav[^{]*\{[^}]*display:\s*none/,
    "the mobile bar must not paint at >=768px, where the drawer/rail own navigation",
  );

  // And the mirror: below 768px it is the owner, mounted at shell level as a
  // real flex item so the shell subtracts its height from `main`.
  assert.match(
    navCss,
    /@media \(max-width: 767px\)[\s\S]*\.dashboard-mobile-nav \{[^}]*position:\s*relative/,
    "the mobile bar is a flow sibling of main, never a fixed overlay",
  );

  // The suppression that made `/dashboard` special is gone with the component
  // that needed it: no source may reintroduce a path-conditional bottom nav.
  const shellRouter = read(SHELL_ROUTER_PATH);
  assert.ok(shellRouter.includes("<DashboardMobileNav surface={surface} />"));
  assert.equal(shellRouter.includes("ROUTES.dashboard"), false);
});

// ── The module workspace no longer offers a "back to hub" control ────────────

test("clinic module workspace exposes no hub back-button (rail owns navigation)", () => {
  const controller = read(CONTROLLER_PATH);
  const workspace = read(WORKSPACE_PATH);

  // The clinic controller renders the workspace WITHOUT an onBack handler.
  assert.equal(controller.includes("onBack="), false);
  assert.equal(controller.includes("backToHub"), false);
  // The workspace only renders the back button when an onBack prop is provided
  // (admin still uses it); the prop is optional.
  assert.ok(workspace.includes("onBack?: () => void;"));
  // B11 moved the conditional into WorkspaceHeader's `leadingAction` slot, so
  // the guard is the prop expression instead of a bare JSX child. The contract
  // is unchanged: the back button exists only when `onBack` is provided.
  assert.ok(workspace.includes("leadingAction={"));
  assert.ok(workspace.includes("onBack ? ("));
  assert.ok(workspace.includes(") : null"));
});
