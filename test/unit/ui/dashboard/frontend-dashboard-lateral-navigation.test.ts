import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

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
    // Desktop/tablet space pass: the admin hub and its Inicio item are retired.
    assert.equal(
      source.includes("buildAdminHubHref"),
      false,
      `${path} must not link the retired admin hub`,
    );
    assert.ok(
      source.includes('aria-current={isActive ? "page" : undefined}'),
      `${path} must mark only the active module`,
    );
    assert.equal(/from "next\/link"/.test(source), false, `${path}: no next/link`);
    assert.equal(/<a\s/.test(source), false, `${path}: no anchors`);
  }
});

test("the lateral primitives preserve distinct landmarks and complete accessible names", () => {
  const drawer = read(DRAWER_PATH);
  const rail = read(RAIL_PATH);

  for (const [source, compact] of [
    [drawer, false],
    [rail, true],
  ] as const) {
    assert.ok(
      source.includes(
        compact
          ? 'const ADMIN_LANDMARK = "Navegación lateral compacta de administración";'
          : 'const ADMIN_LANDMARK = "Navegación lateral de administración";',
      ),
    );
    assert.ok(
      source.includes(
        compact
          ? 'const CLINIC_LANDMARK = "Navegación lateral compacta de clínica";'
          : 'const CLINIC_LANDMARK = "Navegación lateral de clínica";',
      ),
    );
    assert.ok(
      source.includes("aria-label={isAdmin ? ADMIN_LANDMARK : CLINIC_LANDMARK}"),
      "each visible navigation landmark needs a role- and primitive-specific name",
    );
    assert.ok(
      source.includes('aria-hidden="true"'),
      "module glyphs stay decorative",
    );
  }

  assert.ok(
    drawer.includes(
      '<span className="dashboard-navigation-drawer-label">{item.label}</span>',
    ),
    "the drawer exposes the full visible label as the control name",
  );
  assert.ok(rail.includes("aria-label={item.label}"));
  assert.ok(rail.includes("title={item.label}"));
  assert.ok(
    rail.includes(
      '<span className="dashboard-navigation-rail-label">{item.shortLabel}</span>',
    ),
    "the compact rail keeps the short visible label while aria-label carries the full name",
  );
});

test("the lateral primitives keep natural keyboard order without roving tabindex", () => {
  for (const path of [DRAWER_PATH, RAIL_PATH]) {
    const source = read(path);

    assert.equal(
      /tabIndex\s*=/.test(source),
      false,
      `${path} must keep the route controls in natural DOM tab order`,
    );
    assert.equal(
      /onKeyDown\s*=/.test(source),
      false,
      `${path} must not replace the route control's native keyboard activation`,
    );
  }
});

test("both surfaces notify their controller before route navigation", () => {
  // DASHBOARD_GLOBAL_LIVE_SYNC: this used to pin the signal as clinic-only. The
  // admin controller then waited for the URL commit, which lands only after the
  // whole no-store server render, so an admin click painted nothing until then.
  for (const path of [DRAWER_PATH, RAIL_PATH]) {
    const source = read(path);

    assert.ok(
      source.includes(
        'import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";',
      ),
      `${path} must keep the clinic optimistic activation signal`,
    );
    assert.ok(
      source.includes(
        'import { requestAdminModuleActivate } from "@/lib/admin-hub-reset";',
      ),
      `${path} must publish the admin optimistic activation signal`,
    );
    assert.equal(
      source.includes("if (isAdmin) return;"),
      false,
      `${path}: the signal must not be clinic-only`,
    );
    assert.ok(
      source.includes("requestAdminModuleActivate(item.moduleId);"),
      `${path} must fire the admin signal before the URL commit lands`,
    );
    assert.ok(
      source.includes("requestClinicModuleActivate(item.moduleId);"),
      `${path} must fire the clinic signal before the URL commit lands`,
    );
  }
});

test("the frame moves the current item with the activation, not with the commit", () => {
  const frame = read("frontend/src/components/dashboard/DashboardNavigationFrame.tsx");

  assert.ok(
    frame.includes("observeAdminModuleActivate"),
    "admin current item observes the activation without consuming the controller hand-over",
  );
  assert.ok(
    frame.includes("observeClinicModuleActivate"),
    "clinic current item observes the activation without consuming the stage owner's hand-over",
  );
  assert.equal(
    frame.includes("subscribeClinicModuleActivate"),
    false,
    "the band is chrome: listening would count a tap as heard before the stage owner subscribes",
  );
  assert.equal(
    /<LateralNavigation surface="clinic" activeModule=\{routeModule\} \/>/.test(frame),
    false,
    "a full route's band follows the activation instead of staying pinned to its module",
  );
  assert.ok(
    frame.includes("intent.from === committedModule"),
    "the live override is bound to the commit it was issued from, so the URL stays authoritative",
  );
  assert.equal(
    /router\.refresh|location\.reload|setTimeout/.test(frame),
    false,
    "the live item must not be produced by a refresh or a timer",
  );
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

  // B09 collapsed the two per-role bottom navs into one owner, mounted here
  // with the surface the shell already resolved. The mount site did not move:
  // the bar is still a flow sibling of the frame, so the shell keeps
  // subtracting its height from `main` instead of letting it cover content.
  assert.ok(source.includes('import { DashboardMobileNav } from "./DashboardMobileNav";'));
  assert.equal(source.includes("AdminMobileBottomNav"), false);
  assert.equal(source.includes("ClinicMobileBottomNav"), false);
  assert.equal(source.includes("AdminDashboardSidebar"), false);
  assert.equal(source.includes("ClinicDashboardSidebar"), false);
  assert.equal(source.includes("<aside"), false);
  assert.ok(source.includes("flex flex-col h-dvh overflow-hidden"));
  assert.ok(source.includes("data-vetneb-app-shell-surface={surface}"));
  assert.ok(source.includes("<DashboardMobileNav surface={surface} />"));
});

test("admin observers mirror every request without taking the controller's late hand-over", async () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const {
      observeAdminModuleActivate,
      requestAdminModuleActivate,
      subscribeAdminModuleActivate,
    } = await import("../../../../frontend/src/lib/admin-hub-reset.ts");

    const observed: string[] = [];
    const stopObserving = observeAdminModuleActivate((moduleId) => observed.push(moduleId));

    // Controller not mounted yet: the observer sees the request, and the request
    // still waits for the controller as an unheard activation.
    requestAdminModuleActivate("admin-clinics");
    assert.deepEqual(observed, ["admin-clinics"]);

    const heard: string[] = [];
    const stopListening = subscribeAdminModuleActivate((moduleId) => heard.push(moduleId));
    assert.deepEqual(heard, ["admin-clinics"], "the observer must not consume the late hand-over");

    requestAdminModuleActivate("audit-log");
    assert.deepEqual(observed, ["admin-clinics", "audit-log"]);
    assert.deepEqual(heard, ["admin-clinics", "audit-log"]);

    stopObserving();
    stopListening();
    requestAdminModuleActivate("admin-pricing");
    assert.deepEqual(observed, ["admin-clinics", "audit-log"], "an unsubscribed observer hears nothing");
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});

test("clinic observers mirror every request and a tap before the controller subscribes is handed over", async () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const {
      observeClinicModuleActivate,
      requestClinicModuleActivate,
      subscribeClinicModuleActivate,
    } = await import("../../../../frontend/src/lib/clinic-hub-reset.ts");

    const observed: string[] = [];
    const stopObserving = observeClinicModuleActivate((moduleId) => observed.push(moduleId));

    // The band hydrated, the controller has not subscribed yet: the tap used to
    // reach only the chrome, so the stage kept the module the user had left.
    requestClinicModuleActivate("tokens");
    assert.deepEqual(observed, ["tokens"]);

    const heard: string[] = [];
    const stopListening = subscribeClinicModuleActivate((moduleId) => heard.push(moduleId));
    assert.deepEqual(heard, ["tokens"], "the observer must not consume the late hand-over");

    requestClinicModuleActivate("perfil");
    assert.deepEqual(observed, ["tokens", "perfil"]);
    assert.deepEqual(heard, ["tokens", "perfil"]);

    stopObserving();
    stopListening();
    requestClinicModuleActivate("informes");
    assert.deepEqual(observed, ["tokens", "perfil"], "an unsubscribed observer hears nothing");

    const late: string[] = [];
    const stopLate = subscribeClinicModuleActivate((moduleId) => late.push(moduleId));
    assert.deepEqual(late, ["informes"], "an unheard request is handed to the next subscriber once");
    stopLate();
    const again: string[] = [];
    subscribeClinicModuleActivate((moduleId) => again.push(moduleId))();
    assert.deepEqual(again, [], "the hand-over is consumed");
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});
