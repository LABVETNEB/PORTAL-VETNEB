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
      source.includes("? requestAdminModuleActivate(item.moduleId)"),
      `${path} must fire the admin signal before the URL commit lands`,
    );
    assert.ok(
      source.includes(": requestClinicModuleActivate(item.moduleId);"),
      `${path} must fire the clinic signal before the URL commit lands`,
    );
    assert.ok(
      source.includes("if (claimed) event.preventDefault();"),
      `${path} must not push a navigation the controller claimed (single flight)`,
    );
  }
});

test("the band renders the stage owner's module, never its own reading of the commit", () => {
  // DASHBOARD_STAGE_MODULE: the band used to keep a private copy of the pending
  // activation and drop it on every URL commit. A `?module=` navigate action
  // completes before the server answers, so a superseded push can commit ahead
  // of the latest one; the stage owner classified it and kept the new module,
  // the band followed it back to the module the user had left.
  const frame = read("frontend/src/components/dashboard/DashboardNavigationFrame.tsx");

  for (const hook of ["useAdminStageModule()", "useClinicStageModule()"]) {
    assert.ok(frame.includes(hook), `the band renders what the stage owner publishes (${hook})`);
  }
  for (const bus of ["@/lib/admin-hub-reset", "@/lib/clinic-hub-reset"]) {
    assert.equal(
      frame.includes(bus),
      false,
      "the band is chrome: it neither listens to nor mirrors the activation bus, the owner does",
    );
  }
  assert.equal(
    /\buse(State|Effect)\b/.test(frame),
    false,
    "no private intent and no commit-driven reset: the current item is the owner's, not the band's",
  );
  assert.equal(
    /<LateralNavigation surface="clinic" activeModule=\{routeModule\} \/>/.test(frame),
    false,
    "a full route's band follows the activation instead of staying pinned to its module",
  );
  assert.equal(
    /router\.refresh|location\.reload|setTimeout/.test(frame),
    false,
    "the live item must not be produced by a refresh or a timer",
  );
});

test("every stage owner publishes the module it shows; every chrome surface renders it", () => {
  // PR-NAV-03: on the admin surface the owner is the navigation machine. Stage
  // and chrome render the same `display`, through one hook each, so there is
  // nothing to publish and no second copy that could disagree.
  const adminStage = read("frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx");
  assert.ok(
    adminStage.includes("const navigation = useAdminDashboardNavigation();") &&
      adminStage.includes("const activeModule = navigation === null ? urlModule : navigation.module;"),
    "the admin stage shows the machine's display",
  );
  assert.equal(adminStage.includes("usePublishStageModule"), false, "the admin stage is not a second owner");
  assert.ok(
    read("frontend/src/components/dashboard/useStageModule.ts").includes(
      'if (surface === "admin") return adminNavigation === null ? undefined : adminNavigation.module;',
    ),
    "the admin chrome reads the same display, and the URL when no owner is mounted",
  );
  const adminOwner = read("frontend/src/components/dashboard/DashboardNavigationProvider.tsx");
  assert.ok(
    adminOwner.includes(": previewDisplay(MACHINE, ADMIN_CONFIG, snapshot, source.location);") &&
      adminOwner.includes("const searchParams = useSearchParams();"),
    "the display is derived in render, in the same commit as the URL",
  );
  // Clinic isolation: the layout is shared, the owner is not. Outside
  // /dashboard/admin the provider hands out no store slot and mounts no owner,
  // so nothing below it can reach a store; and it never reads the URL itself.
  const provider = adminOwner.slice(
    adminOwner.indexOf("export function DashboardNavigationProvider("),
    adminOwner.indexOf("export type AdminDashboardNavigation"),
  );
  assert.ok(
    provider.includes("const isAdmin = usePathname() === ROUTES.dashboardAdmin;") &&
      provider.includes("const slot = isAdmin ? (held ?? createAdminStoreSlot()) : null;") &&
      provider.includes("<AdminStoreSlotContext.Provider value={slot}>") &&
      provider.includes("{slot === null ? null : ("),
    "the owner exists on /dashboard/admin only",
  );
  for (const urlRead of ["useSearchParams", "useRouter", "createAdminStore("]) {
    assert.equal(provider.includes(urlRead), false, `the layout-level provider does not touch ${urlRead}`);
  }
  // The page is never inside a boundary of the owner: a boundary around the
  // children would make the server send the page twice, fallback and content.
  assert.ok(
    provider.includes("<Suspense fallback={null}>\n          <AdminNavigationOwner />\n        </Suspense>") &&
      provider.includes("      )}\n      {children}\n    </AdminStoreSlotContext.Provider>"),
    "the owner is a sibling of the children and renders nothing",
  );
  assert.equal(adminOwner.split("<Suspense").length - 1, 1, "the only boundary of the owner wraps the owner itself");
  assert.ok(
    adminOwner.includes("store ??= createAdminStore(router, location, explicit);") &&
      adminOwner.split("createAdminStore(router, location, explicit)").length - 1 === 1,
    "one store per visit, created in render by whoever reads the URL first (A1)",
  );
  const consumers = adminOwner.slice(adminOwner.indexOf("function useAdminNavigationSource("));
  assert.ok(
    consumers.includes("slot === null ? null : { store: slot.resolve(router, location, explicit), location }"),
    "without a slot there is no store to reach",
  );
  for (const clinicOnly of ["clinic-hub-reset", "CLINIC_LAST_MODULE_STORAGE_KEY", "parseClinicModule", "stageModule"]) {
    assert.equal(adminOwner.includes(clinicOnly), false, `the admin owner touches no clinic mechanism: ${clinicOnly}`);
  }

  const owners = [
    [
      "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx",
      'usePublishStageModule("clinic", isHubActive ? null : activeModule);',
    ],
    [
      "frontend/src/components/dashboard/ClinicFullRouteModuleStage.tsx",
      'usePublishStageModule("clinic", leavingTo, leavingTo !== null);',
    ],
  ] as const;
  for (const [path, publish] of owners) {
    assert.ok(read(path).includes(publish), `${path} publishes its resolved module`);
  }

  for (const path of [
    "frontend/src/components/dashboard/DashboardMobileNav.tsx",
    "frontend/src/components/dashboard/ModuleContextTitle.tsx",
  ]) {
    const source = read(path);
    assert.ok(source.includes("useStageModule(surface)"), `${path} renders the owner's module`);
    assert.equal(
      /observe(Admin|Clinic)ModuleActivate/.test(source),
      false,
      `${path} keeps no mirror of the activation bus`,
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

// PR-NAV-03 (FSM roadmap §11.3): the owner lives in the dashboard layout and its
// store exists before any page mounts, so a request made before it registers is
// not kept for a later replay. The caller is told `false` and navigates on its
// own; the owner then sees that navigation as a URL commit. A replayed request
// could land after it and navigate a second time.
test("an admin request with no navigation owner is left to the caller and never replayed", async () => {
  const { requestAdminModuleActivate, requestAdminHubReset, registerAdminNavigationOwner } = await import(
    "../../../../frontend/src/lib/admin-hub-reset.ts"
  );

  assert.equal(requestAdminModuleActivate("admin-clinics"), false, "no owner: the caller navigates");
  requestAdminHubReset();

  const heard: string[] = [];
  const unregister = registerAdminNavigationOwner({
    selectModule(moduleId) {
      heard.push(moduleId);
      return true;
    },
    selectHub() {
      heard.push("hub");
    },
  });
  assert.deepEqual(heard, [], "nothing asked before the owner registered is replayed");

  assert.equal(requestAdminModuleActivate("audit-log"), true);
  requestAdminHubReset();
  assert.deepEqual(heard, ["audit-log", "hub"]);

  // A newer owner replaces the previous one; the stale unregister is inert.
  const next: string[] = [];
  const unregisterNext = registerAdminNavigationOwner({
    selectModule(moduleId) {
      next.push(moduleId);
      return true;
    },
    selectHub() {},
  });
  unregister();
  assert.equal(requestAdminModuleActivate("admin-pricing"), true);
  assert.deepEqual(next, ["admin-pricing"]);
  assert.deepEqual(heard, ["audit-log", "hub"], "the replaced owner hears nothing");

  unregisterNext();
  assert.equal(requestAdminModuleActivate("admin-sessions"), false, "an unregistered owner hears nothing");
  assert.deepEqual(next, ["admin-pricing"]);

  const adapter = read("frontend/src/lib/admin-hub-reset.ts");
  for (const retired of ["unheardActivation", "LATE_ACTIVATION_MAX_AGE_MS", "performance.now()", "Listeners"]) {
    assert.equal(adapter.includes(retired), false, `the listener bus and its replay are gone: ${retired}`);
  }
});

test("a clinic tap before the controller subscribes is handed over once", async () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const { requestClinicModuleActivate, subscribeClinicModuleActivate } = await import(
      "../../../../frontend/src/lib/clinic-hub-reset.ts"
    );

    // The band hydrated, the controller has not subscribed yet: the tap used to
    // reach only the chrome, so the stage kept the module the user had left.
    requestClinicModuleActivate("tokens");
    const heard: string[] = [];
    const stopListening = subscribeClinicModuleActivate((moduleId) => {
      heard.push(moduleId);
    });
    assert.deepEqual(heard, ["tokens"], "the late tap reaches the controller");

    requestClinicModuleActivate("perfil");
    assert.deepEqual(heard, ["tokens", "perfil"]);

    stopListening();
    requestClinicModuleActivate("informes");
    const late: string[] = [];
    const stopLate = subscribeClinicModuleActivate((moduleId) => {
      late.push(moduleId);
    });
    assert.deepEqual(late, ["informes"], "an unheard request is handed to the next subscriber once");
    stopLate();
    const again: string[] = [];
    subscribeClinicModuleActivate((moduleId) => {
      again.push(moduleId);
    })();
    assert.deepEqual(again, [], "the hand-over is consumed");
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});

test("the stage module is the latest owner's claim, undefined without an owner", async () => {
  const { getStageModuleSnapshot, publishStageModule, subscribeStageModule } = await import(
    "../../../../frontend/src/lib/dashboard/navigation/stageModule.ts"
  );

  assert.equal(getStageModuleSnapshot("admin"), undefined, "no owner: the chrome reads the URL");
  const notified: string[] = [];
  const stop = subscribeStageModule("admin", () =>
    notified.push(String(getStageModuleSnapshot("admin"))),
  );

  // A superseded commit never reaches this store: only the owner's resolution does.
  const releaseB = publishStageModule("admin", "admin-particular-tokens");
  const releaseC = publishStageModule("admin", "admin-pricing");
  releaseB();
  assert.equal(getStageModuleSnapshot("admin"), "admin-pricing", "the stage owner's latest value wins");
  assert.equal(getStageModuleSnapshot("clinic"), undefined, "surfaces never share a claim");

  // An owner mounting while the previous one releases never reads as "no owner".
  const releaseNext = publishStageModule("admin", null);
  releaseC();
  assert.equal(getStageModuleSnapshot("admin"), null, "a module-less stage is null, not undefined");
  releaseNext();
  releaseNext();
  assert.equal(getStageModuleSnapshot("admin"), undefined, "a released owner leaves the URL in charge");
  assert.deepEqual(notified, [
    "admin-particular-tokens",
    "admin-pricing",
    "admin-pricing",
    "null",
    "null",
    "undefined",
  ]);

  stop();
  publishStageModule("admin", "audit-log")();
  assert.equal(notified.length, 6, "an unsubscribed listener hears nothing");
});

test("SINGLE FLIGHT: only a stage owner claims a request, and only when it says so", async () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const admin = await import("../../../../frontend/src/lib/admin-hub-reset.ts");
    const clinic = await import("../../../../frontend/src/lib/clinic-hub-reset.ts");

    // No owner yet: nobody can navigate later, so the caller must.
    assert.equal(admin.requestAdminModuleActivate("admin-clinics"), false);
    assert.equal(clinic.requestClinicModuleActivate("tokens"), false);

    // PR-NAV-03: the admin owner is the navigation machine. The adapter relays
    // its answer and adds no claim of its own; whether a taken selection
    // navigates at once or is claimed by the flight in the router is the
    // machine's row #29 (dashboard-navigation-machine and -coordinator suites).
    let adminTakes = false;
    const stopAdmin = admin.registerAdminNavigationOwner({
      selectModule: () => adminTakes,
      selectHub() {},
    });
    assert.equal(admin.requestAdminModuleActivate("audit-log"), false, "the owner declined: the caller pushes");
    adminTakes = true;
    assert.equal(admin.requestAdminModuleActivate("admin-pricing"), true, "the owner took it: the caller must not");
    stopAdmin();

    let clinicInFlight = true;
    const stopClinic = clinic.subscribeClinicModuleActivate(() => clinicInFlight);
    assert.equal(clinic.requestClinicModuleActivate("perfil"), true);
    clinicInFlight = false;
    assert.equal(clinic.requestClinicModuleActivate("logistica"), false);
    stopClinic();

    // A handing-over stage never claims: its destinations leave the route.
    const stopStage = clinic.subscribeClinicModuleActivate(() => true, { handsOver: true });
    assert.equal(clinic.requestClinicModuleActivate("informes"), false, "a full-route stage never claims");
    stopStage();
    clinic.relinquishClinicModuleActivateHandOver();
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});

test("SINGLE FLIGHT: every producer honours a claim and both owners claim and reconcile", () => {
  for (const [path, honours] of [
    ["frontend/src/components/dashboard/NavigationDrawer.tsx", "if (claimed) event.preventDefault();"],
    ["frontend/src/components/dashboard/NavigationRail.tsx", "if (claimed) event.preventDefault();"],
    ["frontend/src/components/dashboard/DashboardMobileKebabMenu.tsx", "if (claimed) event.preventDefault();"],
    [
      "frontend/src/components/dashboard/WorkspaceAppBar.tsx",
      "if (!claimed) router.push(buildDashboardModuleHref(basePath, entry.moduleId));",
    ],
    [
      "frontend/src/app/dashboard/admin/AdminOverviewQuickLinks.tsx",
      "if (requestAdminModuleActivate(link.module)) event.preventDefault();",
    ],
    ["frontend/src/components/dashboard/DashboardMobileNav.tsx", "if (onActivate(destination.moduleId)) event.preventDefault();"],
    ["frontend/src/components/dashboard/DashboardMobileNav.tsx", "if (onNavigate(destination.moduleId)) event.preventDefault();"],
  ] as const) {
    assert.ok(read(path).includes(honours), `${path} must not navigate a claimed request`);
  }

  // PR-NAV-03: on the admin surface the claim and its reconciliation are rows
  // of the navigation machine; the owner only dispatches and interprets.
  const admin = read("frontend/src/components/dashboard/DashboardNavigationProvider.tsx");
  const machine = read("frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts");
  assert.ok(
    admin.includes('if (parsed === null || tag === "BOOTING" || tag === "FAILED") return false;') &&
      admin.includes('store.dispatch({ type: "SELECT_MODULE", module: parsed });\n        return true;'),
    "the admin owner takes every selection the machine will not ignore (DT-10)",
  );
  assert.ok(
    machine.includes("// #29: the flight in the router claims the selection; nothing navigates.") &&
      machine.includes("state: { ...state, next: same(target, state.target) ? null : target },") &&
      machine.includes("effects: [PUBLISH_DISPLAY],"),
    "the machine claims a selection made while a user flight is in the router",
  );
  const landed = machine.slice(machine.indexOf("// #30:"), machine.indexOf("// #32:"));
  assert.ok(
    landed.includes("state.next,") && landed.includes('"replace",'),
    "the machine replaces the landed entry with the claimed module",
  );
  assert.ok(
    machine.includes("if (same(target, state.next ?? state.target)) return stay(ctx, state);"),
    "a flight keeps the newest selection: re-selecting it is the only no-op",
  );
  // DT-16 = A: returning to the committed module is a push to the current URL
  // (#25), which discards the flight; the machine has no native history effect
  // to step back with (S9), so no part of the owner calls history.back().
  assert.ok(
    machine.includes("return returnToCommitted(config, ctx, target, cancelBudget(state)); // #25") &&
      machine.includes('{ type: "ROUTER_PUSH", to: target },'),
    "returning to the committed module pushes its own URL instead of leaving [A, A]",
  );
  for (const path of [
    "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx",
    "frontend/src/components/dashboard/DashboardNavigationProvider.tsx",
    "frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts",
  ]) {
    assert.equal(
      /history\.(back|forward|go|pushState|replaceState)\(|router\.refresh\(/.test(read(path)),
      false,
      `${path}: the admin owner navigates through router.push/replace only (S9, DT-2)`,
    );
  }

  const clinic = read("frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx");
  assert.ok(
    clinic.includes("const inFlight = navigationState.current.pendingIntent !== null && flight.isActive();"),
  );
  assert.ok(clinic.includes("return inFlight;"), "the clinic controller claims while in flight");
  assert.ok(clinic.includes("outcome.reconcileTo"), "the clinic controller reconciles the superseded entry");
  assert.ok(
    clinic.includes("if (outcome.historyBack) {") && clinic.includes("recordNavigationIntent(parsed, { pushed: !inFlight });"),
    "the clinic controller steps back to the module its burst pushed from",
  );
  // Leaving the hub is optimistic: until the module commits, the url is still
  // `?hub=1`. Neither the url effect nor the last-module restore may read it as
  // the default module, and the hub entry is module-less for the burst origin.
  assert.ok(
    clinic.includes("confirmedUrlModule: hubInUrl ? null : (initialModule ?? DEFAULT_CLINIC_MODULE),"),
    "a session that starts on the hub has no module entry to step back onto",
  );
  assert.ok(
    clinic.includes("navigationState.current = confirmClinicHubEntry(navigationState.current);"),
    "a hub commit is confirmed as module-less",
  );
  assert.equal(
    clinic.split("if (hubInUrl || isHubActive) return;").length - 1,
    1,
    "the last-module restore never fires while the url is still the hub",
  );
});

test("Abrir módulo completo shows its pending state for the whole full-route navigation", () => {
  const control = read("frontend/src/components/dashboard/FullModuleRouteControl.tsx");
  assert.ok(control.includes("const [isPending, startTransition] = useTransition();"));
  assert.ok(control.includes("startTransition(() => router.push(href));"), "the push runs inside the transition");
  assert.ok(control.includes("aria-busy={isPending || undefined}"), "the pending state is exposed, not only painted");
  assert.ok(control.includes('"Abriendo módulo…"'), "the pending state is visible");
  assert.ok(control.includes("<PublicRouteControl"), "keeps the route-control pattern and its pre-hydration fallback");
  assert.equal(/router\.refresh|location\.(reload|assign)|setTimeout/.test(control), false);

  for (const [path, href] of [
    ["frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx", "ROUTES.dashboardLogistica"],
    ["frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx", "ROUTES.dashboardInformes"],
  ] as const) {
    assert.ok(
      read(path).includes(`<FullModuleRouteControl href={${href}}`),
      `${path} opens its full route through the pending-aware control`,
    );
  }
});

test("a full-route stage hands the latest activation to the controller that replaces it", async () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const {
      relinquishClinicModuleActivateHandOver,
      requestClinicModuleActivate,
      subscribeClinicModuleActivate,
    } = await import("../../../../frontend/src/lib/clinic-hub-reset.ts");

    // A then B from a full route, both before A's `/dashboard` commit.
    const leaving: string[] = [];
    const stopStage = subscribeClinicModuleActivate((moduleId) => {
      leaving.push(moduleId);
    }, {
      handsOver: true,
    });
    requestClinicModuleActivate("tokens");
    requestClinicModuleActivate("informes");
    assert.deepEqual(leaving, ["tokens", "informes"]);

    // A commits: the stage unmounts and the controller takes the stage.
    stopStage();
    const controller: string[] = [];
    const stopController = subscribeClinicModuleActivate((moduleId) => {
      controller.push(moduleId);
    });
    assert.deepEqual(controller, ["informes"], "the latest intent survives the owner change, not A");

    requestClinicModuleActivate("perfil");
    assert.deepEqual(controller, ["informes", "perfil"]);
    stopController();
    const remounted: string[] = [];
    subscribeClinicModuleActivate((moduleId) => {
      remounted.push(moduleId);
    })();
    assert.deepEqual(remounted, [], "an intent a final owner heard is never replayed");

    // A handing-over stage never consumes what it keeps for the next owner.
    const nextStage: string[] = [];
    const stopNextStage = subscribeClinicModuleActivate((moduleId) => {
      nextStage.push(moduleId);
    }, {
      handsOver: true,
    });
    requestClinicModuleActivate("logistica");
    const strictRemount = subscribeClinicModuleActivate(() => {}, { handsOver: true });
    strictRemount();
    assert.deepEqual(nextStage, ["logistica"]);

    // Back/Forward before the commit is the user's own navigation.
    relinquishClinicModuleActivateHandOver();
    stopNextStage();
    const afterBack: string[] = [];
    subscribeClinicModuleActivate((moduleId) => {
      afterBack.push(moduleId);
    })();
    assert.deepEqual(afterBack, [], "a history navigation drops the retained intent");
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});

test("an owner mounted by Back/Forward inside popstate never adopts the kept destination", async () => {
  const globals = globalThis as { window?: unknown; event?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const { requestClinicModuleActivate, subscribeClinicModuleActivate } = await import(
      "../../../../frontend/src/lib/clinic-hub-reset.ts"
    );

    // The full route keeps Tokens for `/dashboard`; Back starts before its commit.
    const stopStage = subscribeClinicModuleActivate(() => {}, { handsOver: true });
    requestClinicModuleActivate("tokens");

    // Real order without the Navigation API: the router's popstate listener
    // commits the restored entry, the stage unmounts before its own listener
    // runs, and the controller subscribes while popstate is still dispatching.
    globals.event = { type: "popstate" };
    stopStage();
    const controller: string[] = [];
    const stopController = subscribeClinicModuleActivate((moduleId) => {
      controller.push(moduleId);
    });
    delete globals.event;
    stopController();
    assert.deepEqual(controller, [], "the traversal superseded the kept destination");

    const later: string[] = [];
    subscribeClinicModuleActivate((moduleId) => {
      later.push(moduleId);
    })();
    assert.deepEqual(later, [], "the dropped destination is never replayed afterwards");
  } finally {
    delete globals.event;
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});

// M2 — SINGLE FLIGHT's budget. A payload that never answers ended no flight, so
// every later request was claimed and the url and history froze on the origin
// until a reload. The flight is abandoned past its budget: claims stop and the
// owner navigates the latest intent itself, as a new flight.
// Real timers on a short budget: `createNavigationFlight` takes the budget, so
// no clock double is needed and the 10 s default is asserted on its own.
const elapse = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const TEST_BUDGET_MS = 100;

test("SINGLE FLIGHT budget: an abandoned flight hands the latest intent over once, never in a loop", async () => {
  const { createNavigationFlight, NAVIGATION_FLIGHT_BUDGET_MS } = await import(
    "../../../../frontend/src/lib/dashboard/navigation/navigationFlight.ts"
  );
  assert.equal(NAVIGATION_FLIGHT_BUDGET_MS, 10_000);

  // The owner's rule: hand over the latest intent unless it is the navigation
  // that was abandoned. Both payloads hang: informes, then the handed-over perfil.
  const latest = "perfil";
  const navigations: string[] = [];
  const flight = createNavigationFlight((abandoned) => {
    if (latest === abandoned) return null;
    navigations.push(latest);
    return latest;
  }, TEST_BUDGET_MS);

  assert.equal(flight.isActive(), false, "nothing is in flight before a navigation is issued");
  flight.start("informes");
  await elapse(TEST_BUDGET_MS / 5);
  assert.equal(flight.isActive(), true, "a young flight still claims");
  assert.deepEqual(navigations, []);

  await elapse(TEST_BUDGET_MS * 1.3);
  assert.deepEqual(navigations, ["perfil"], "the latest intent is navigated when the budget elapses");
  assert.equal(flight.isActive(), true, "the handed-over navigation is a new flight with its own budget");

  await elapse(TEST_BUDGET_MS * 1.5);
  assert.deepEqual(navigations, ["perfil"], "a handed-over navigation that hangs too is never re-issued");
  assert.equal(flight.isActive(), false, "the second abandonment only stops the claims");
});

test("SINGLE FLIGHT budget: a commit, Back or unmount before the budget ends the flight", async () => {
  const { createNavigationFlight } = await import(
    "../../../../frontend/src/lib/dashboard/navigation/navigationFlight.ts"
  );
  const expired: string[] = [];
  const flight = createNavigationFlight((abandoned) => {
    expired.push(abandoned);
    return abandoned;
  }, TEST_BUDGET_MS);

  flight.start("informes");
  await elapse(TEST_BUDGET_MS / 5);
  flight.end();
  await elapse(TEST_BUDGET_MS * 1.5);
  assert.deepEqual(expired, [], "a flight that landed inside its budget never hands over");
  assert.equal(flight.isActive(), false);

  // A reconcile re-arms the flight: the budget counts from the latest navigation.
  flight.start("informes");
  await elapse(TEST_BUDGET_MS * 0.6);
  flight.start("perfil");
  await elapse(TEST_BUDGET_MS * 0.6);
  assert.deepEqual(expired, [], "re-arming restarts the budget");
  await elapse(TEST_BUDGET_MS * 0.9);
  assert.deepEqual(expired, ["perfil"], "the abandoned target is the latest navigation issued");
  assert.equal(flight.isActive(), false, "re-issuing the abandoned target itself is not a new flight");
  flight.end();
  assert.equal(flight.isActive(), false, "ending an ended flight is harmless");
});

test("SINGLE FLIGHT budget: both owners claim only within it and settle it on every terminal state", () => {
  const hook = read("frontend/src/components/dashboard/useNavigationFlight.ts");
  assert.ok(
    hook.includes("useEffect(() => () => flight.end(), [flight]);"),
    "an owner that unmounts takes its flight with it",
  );

  for (const [path, claim] of [
    [
      "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx",
      "const inFlight = navigationState.current.pendingIntent !== null && flight.isActive();",
    ],
  ] as const) {
    const owner = read(path);
    assert.ok(owner.includes(claim), `${path} claims only while its flight is within budget`);
    assert.ok(owner.includes("const flight = useNavigationFlight(navigateAbandonedIntent);"), path);
    assert.ok(owner.includes("router.push("), `${path} navigates the latest intent of an abandoned flight`);
    assert.equal(
      owner.split("flight.start(").length - 1,
      3,
      `${path} arms the flight, with its target, for every navigation it starts or lets the caller start`,
    );
    assert.ok(
      owner.includes("target === abandonedTarget) return null;"),
      `${path} never re-issues the navigation it abandoned: no retry loop`,
    );
    // A push of the committed module commits no module change, so nothing would
    // ever end its flight: claims would hold every click for a whole budget.
    assert.ok(
      owner.includes("parsed !== confirmedUrlModule) flight.start(parsed);") ||
        owner.includes("if (parsed !== committed) flight.start(parsed);"),
      `${path} arms no flight for a push of the committed module`,
    );
    assert.ok(
      owner.includes("historyTraversalStarted.current = false;\n      flight.end();"),
      `${path}: Back/Forward ends the flight`,
    );
    assert.equal(/window\.event|setInterval|location\.reload/.test(owner), false, path);
  }

  // PR-NAV-03: the admin owner keeps the same budget, as rows of the machine
  // interpreted by the coordinator (FSM roadmap §12.5.1, DT-5 = 10 000 ms).
  const adminView = read("frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx");
  const adminOwner = read("frontend/src/components/dashboard/DashboardNavigationProvider.tsx");
  const coordinator = read("frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts");
  const machine = read("frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts");
  for (const retired of ["useNavigationFlight", "flight.", "navigateAbandonedIntent", "router."]) {
    assert.equal(adminView.includes(retired), false, `the admin view owns no flight: ${retired}`);
  }
  assert.ok(
    adminOwner.includes(
      'import { NAVIGATION_FLIGHT_BUDGET_MS } from "@/lib/dashboard/navigation/navigationFlight";',
    ) && adminOwner.includes("timers.set(navId, setTimeout(expire, NAVIGATION_FLIGHT_BUDGET_MS));"),
    "one budget value in the tree: the admin owner arms the same constant the clinic flight uses",
  );
  assert.equal(adminOwner.split("setTimeout(").length - 1, 1, "the admin owner arms a timer for the budget only");
  assert.ok(
    adminOwner.includes("clearTimeout(timers.get(navId));") && coordinator.includes("for (const navId of [...armed]) cancel(navId);"),
    "an owner that unmounts takes its budget with it",
  );
  assert.ok(
    coordinator.includes("if (navId !== flight) cancel(navId);") && coordinator.includes("if (flight !== null) arm(flight);"),
    "the budget is settled on every terminal state: timers follow the state (A6)",
  );
  const expiry = machine.slice(machine.indexOf("function expire("), machine.indexOf("function fail("));
  assert.ok(
    expiry.includes("// #31: one relay, in the history of the flight it relieves.") &&
      expiry.includes("supersede(ctx.superseded, state.target, state.next),"),
    "the admin owner navigates the latest intent of an abandoned flight, once",
  );
  assert.ok(
    expiry.includes('tag: "STALLED",') && expiry.includes("return stay(ctx, state); // #13 and the ignored pairs"),
    "an abandoned flight with nothing to hand over stalls, and a stale budget is inert: no retry loop",
  );
  assert.ok(
    machine.includes("if (same(target, ctx.committed)) return stay(ctx, state); // #4") &&
      machine.includes("// #17") &&
      machine.includes("effects: [...cancelBudget(state), { type: \"ARM_BUDGET\", navId }, PUBLISH_DISPLAY],"),
    "no flight is armed for the committed module, and Back/Forward ends the flight it finds",
  );
  assert.equal(/window\.event|setInterval|location\.reload/.test(adminOwner + coordinator), false);
});
