import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

// ─────────────────────────────────────────────────────────────────────────────
// Successor of `frontend-dashboard-horizontal-nav.test.ts`, retired with its
// subject in B08.
//
// What died with `DashboardHorizontalNav` is the component-shaped half of that
// contract: its private `ADMIN_NAV_ITEMS`/`CLINIC_NAV_ITEMS` literals, its
// inline `${ROUTES.x}?module=y` template strings and its own surface
// resolution. Those are not weaker here — they no longer exist anywhere,
// because B08 moved module navigation onto the B07 primitives, which derive
// ids, order and labels from the catalog and build every href through
// `buildDashboardModuleHref`.
//
// What SURVIVES that component is the real invariant it was protecting: every
// module of both roles stays reachable from the canonical navigation table, by
// its canonical label. That is asserted here against the owner
// (`dashboardModules.ts`), which is a strictly stronger anchor than a substring
// of one component: a module cannot be dropped from navigation by editing a
// component any more.
//
// The topbar and shell-router composition assertions are kept, updated for the
// post-B08 header: the bar is now the header's ONLY band, because the lateral
// navigation is mounted beside `main`, not underneath the bar.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_CATALOG_PATH =
  "frontend/src/features/dashboard/config/dashboardModules.ts";
const MODULE_ICONS_PATH =
  "frontend/src/components/dashboard/dashboardModuleIcons.ts";
const DRAWER_PATH = "frontend/src/components/dashboard/NavigationDrawer.tsx";
const RAIL_PATH = "frontend/src/components/dashboard/NavigationRail.tsx";
const FRAME_PATH =
  "frontend/src/components/dashboard/DashboardNavigationFrame.tsx";
const TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("every admin module stays reachable from the canonical navigation table", () => {
  const catalog = read(MODULE_CATALOG_PATH);
  const icons = read(MODULE_ICONS_PATH);

  // Same ten modules the retired horizontal nav exposed, including the three
  // system/configuration modules PR-GD1 promoted out of the hub.
  const adminModules: ReadonlyArray<{ label: string; moduleId: string }> = [
    { label: "Resumen", moduleId: "admin" },
    { label: "Informes", moduleId: "admin-report-upload" },
    { label: "Estado", moduleId: "admin-health" },
    { label: "Clínicas", moduleId: "admin-clinics" },
    { label: "Tokens", moduleId: "admin-particular-tokens" },
    { label: "Precios", moduleId: "admin-pricing" },
    { label: "Sesiones", moduleId: "admin-sessions" },
    { label: "Usuarios", moduleId: "admin-users-roles" },
    { label: "Auditoría", moduleId: "audit-log" },
    { label: "Mantenimiento", moduleId: "admin-maintenance" },
  ];

  assert.equal(adminModules.length, 10, "the admin role has ten modules");

  for (const { label, moduleId } of adminModules) {
    assert.ok(
      catalog.includes(`{ moduleId: "${moduleId}", label: "${label}"`),
      `admin navigation must expose ${moduleId} as "${label}"`,
    );
    assert.ok(
      icons.includes(`"${moduleId}":`) || icons.includes(`  ${moduleId}:`),
      `admin module ${moduleId} must own a glyph`,
    );
  }
});

test("every clinic module stays reachable from the canonical navigation table", () => {
  const catalog = read(MODULE_CATALOG_PATH);
  const icons = read(MODULE_ICONS_PATH);

  // The five clinic modules PR-CL4 resolved onto `?module=`. B08 adopted the
  // CATALOG's labels and order, not the retired nav's: the operational default
  // is "Operaciones", never a "Resumen" entry that read like a hub the clinic
  // dashboard does not have.
  const clinicModules: ReadonlyArray<{ label: string; moduleId: string }> = [
    { label: "Operaciones", moduleId: "operaciones" },
    { label: "Informes", moduleId: "informes" },
    { label: "Logística", moduleId: "logistica" },
    { label: "Perfil", moduleId: "perfil" },
    { label: "Tokens", moduleId: "tokens" },
  ];

  assert.equal(clinicModules.length, 5, "the clinic role has five modules");

  for (const { label, moduleId } of clinicModules) {
    assert.ok(
      catalog.includes(`{ moduleId: "${moduleId}", label: "${label}"`),
      `clinic navigation must expose ${moduleId} as "${label}"`,
    );
    assert.ok(
      icons.includes(`"${moduleId}":`) || icons.includes(`  ${moduleId}:`),
      `clinic module ${moduleId} must own a glyph`,
    );
  }
});

test("the lateral navigation navigates via PublicRouteControl and the shared grammar", () => {
  for (const path of [DRAWER_PATH, RAIL_PATH]) {
    const source = read(path);

    assert.ok(
      source.includes(
        'import { PublicRouteControl } from "@/components/public/PublicRouteControl";',
      ),
      `${path} must navigate through the route control`,
    );
    assert.ok(
      source.includes("buildDashboardModuleHref(basePath, item.moduleId)"),
      `${path} must build every href through the application layer`,
    );
    assert.ok(
      source.includes('aria-current={isActive ? "page" : undefined}'),
      `${path} must mark only the active module`,
    );
    assert.equal(/from "next\/link"/.test(source), false, `${path}: no next/link`);
    assert.equal(/<a\s/.test(source), false, `${path}: no anchors`);
  }
});

test("the clinic surface still notifies the controller before route navigation", () => {
  for (const path of [DRAWER_PATH, RAIL_PATH]) {
    const source = read(path);

    assert.ok(
      source.includes(
        'import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";',
      ),
      `${path} must keep the optimistic activation signal`,
    );
    assert.ok(
      source.includes("if (isAdmin) return;"),
      `${path}: the signal is clinic-only`,
    );
    assert.ok(
      source.includes("requestClinicModuleActivate(item.moduleId);"),
      `${path} must fire the signal before the URL commit lands`,
    );
  }
});

test("topbar is a single-band header: module navigation moved beside main", () => {
  const source = read(TOPBAR_PATH);

  assert.ok(source.includes("<WorkspaceAppBar"));
  assert.equal(
    [...source.matchAll(/<WorkspaceAppBar/g)].length,
    1,
    "the header composes exactly one band",
  );
  assert.equal(
    source.includes("DashboardHorizontalNav"),
    false,
    "B08 retired the second band; the lateral model costs width, not height",
  );
  assert.ok(source.includes("flex shrink-0 flex-col"));
  assert.equal(source.includes("Portal operativo"), false);
  assert.equal(source.includes("Sesión clínica segura"), false);
});

test("the navigation frame places the band beside main, never over it", () => {
  const source = read(FRAME_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("<NavigationDrawer"));
  assert.ok(source.includes("<NavigationRail"));
  assert.ok(
    source.includes('className="dashboard-navigation-frame"'),
    "the row that holds the band and the workspace",
  );
  assert.equal(
    /position:\s*(fixed|absolute)|className="[^"]*\b(fixed|absolute)\b/.test(source),
    false,
    "the band is a real flex item; overlaying it would cover main",
  );
});

test("shell router no longer renders a vertical sidebar as primary navigation", () => {
  const source = read(SHELL_ROUTER_PATH);

  assert.ok(source.includes('import { AdminMobileBottomNav } from "./AdminMobileBottomNav";'));
  assert.ok(source.includes('import { ClinicMobileBottomNav } from "./ClinicMobileBottomNav";'));
  assert.equal(source.includes("AdminDashboardSidebar"), false);
  assert.equal(source.includes("ClinicDashboardSidebar"), false);
  assert.equal(source.includes("<aside"), false);
  assert.ok(source.includes("flex flex-col h-dvh overflow-hidden"));
  assert.ok(source.includes("data-vetneb-app-shell-surface={surface}"));
  assert.ok(source.includes("isAdminDashboard ? ("));
  assert.ok(source.includes("<AdminMobileBottomNav />"));
  assert.ok(source.includes("<ClinicMobileBottomNav />"));
});
