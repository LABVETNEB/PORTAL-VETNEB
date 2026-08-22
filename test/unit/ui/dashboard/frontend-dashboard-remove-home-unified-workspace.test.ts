import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CONTROLLER_PATH =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const RAIL_PATH = "frontend/src/components/dashboard/DashboardModuleRail.tsx";
const WORKSPACE_PATH =
  "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx";
// B08 retired DashboardHorizontalNav; the >=768px suppression it used to
// declare is now a CSS fact about the legacy rail itself.
const NAVIGATION_CSS_PATH = "frontend/src/styles/dashboard/navigation.css";
const MOBILE_BOTTOM_NAV_PATH =
  "frontend/src/components/dashboard/ClinicMobileBottomNav.tsx";
const CATALOG_PATH =
  "frontend/src/features/dashboard/config/dashboardModules.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
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

// ── Single, shared navigation/pager across every module and device ───────────

test("DashboardModuleRail is the single shared module navigation/pager", () => {
  const rail = read(RAIL_PATH);
  const controller = read(CONTROLLER_PATH);

  // One rail, rendered once by the controller (module-agnostic → identical for
  // every module and every device).
  assert.ok(
    controller.includes('import { DashboardModuleRail } from "./DashboardModuleRail";'),
  );
  assert.ok(controller.includes("<DashboardModuleRail activeModule={activeModule} />"));

  // Accessible landmark + pager grammar + deep-linkable controls.
  assert.ok(rail.includes('"use client";'));
  assert.ok(rail.includes('data-dashboard-module-rail="true"'));
  assert.ok(rail.includes('data-dashboard-pager="module"'));
  assert.ok(rail.includes('aria-label="Navegación de módulos de clínica"'));
  assert.ok(rail.includes('aria-current={isActive ? "page" : undefined}'));
  assert.ok(rail.includes("data-dashboard-module-rail-prev="));
  assert.ok(rail.includes("data-dashboard-module-rail-next="));
  assert.ok(
    rail.includes(
      'import { PublicRouteControl } from "@/components/public/PublicRouteControl";',
    ),
  );
  assert.ok(
    rail.includes(
      'import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";',
    ),
  );
  assert.equal(/from "next\/link"/.test(rail), false);
  assert.equal(/<a\s/.test(rail), false);

  // Every clinic module is reachable from the single rail via ?module=. The
  // rail derives its items (id/label/shortLabel/order) from the shared config
  // catalog and keeps only its local icon map, so the module list is declared
  // once and can never drift from the mobile bottom-nav.
  assert.ok(
    rail.includes(
      'import { CLINIC_MODULE_NAV_LABELS } from "@/features/dashboard/config";',
    ),
  );
  assert.ok(rail.includes("CLINIC_MODULE_NAV_LABELS.map("));
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

// ── The two device-split navs are suppressed on /dashboard ───────────────────

test("the split desktop-tab / mobile-bottom navs are suppressed on the main dashboard", () => {
  const bottom = read(MOBILE_BOTTOM_NAV_PATH);
  const railCss = read(NAVIGATION_CSS_PATH);

  // The desktop top-tab bar is gone entirely: B08 retired
  // `DashboardHorizontalNav`, so its clinic suppression clause has no subject
  // left. The invariant it encoded — no second desktop navigation next to the
  // rail on /dashboard — is now stronger, because the rail itself leaves that
  // regime: from 768px up the lateral model is the only module navigation.
  assert.match(
    railCss,
    /@media \(min-width: 768px\)[^@]*\.dashboard-module-rail[^{]*\{[^}]*display:\s*none/,
    "the legacy rail must not paint at >=768px, where the drawer/rail own navigation",
  );

  // Mobile bottom bar still yields to the rail on the exact /dashboard path —
  // which is precisely why B08 did NOT delete the rail: below 768px it is the
  // only module navigation that surface has. Unifying the two is B09.
  assert.ok(bottom.includes("pathname === ROUTES.dashboard"));
  assert.ok(bottom.includes("return null;"));
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
  assert.ok(workspace.includes("{onBack ? ("));
});
