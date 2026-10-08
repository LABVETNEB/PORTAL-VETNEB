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
  const owners = [
    [
      "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx",
      'usePublishStageModule("admin", activeModule);',
    ],
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

test("an admin request before the controller subscribes is handed over once", async () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  globals.window = globalThis;
  try {
    const { requestAdminModuleActivate, subscribeAdminModuleActivate } = await import(
      "../../../../frontend/src/lib/admin-hub-reset.ts"
    );

    // Controller not mounted yet: the request waits as an unheard activation.
    requestAdminModuleActivate("admin-clinics");
    const heard: string[] = [];
    const stopListening = subscribeAdminModuleActivate((moduleId) => {
      heard.push(moduleId);
    });
    assert.deepEqual(heard, ["admin-clinics"], "the late request reaches the controller");

    requestAdminModuleActivate("audit-log");
    assert.deepEqual(heard, ["admin-clinics", "audit-log"]);

    stopListening();
    requestAdminModuleActivate("admin-pricing");
    assert.deepEqual(heard, ["admin-clinics", "audit-log"], "an unsubscribed controller hears nothing");
    const next: string[] = [];
    subscribeAdminModuleActivate((moduleId) => {
      next.push(moduleId);
    })();
    assert.deepEqual(next, ["admin-pricing"], "the next controller takes the unheard request");
    const again: string[] = [];
    subscribeAdminModuleActivate((moduleId) => {
      again.push(moduleId);
    })();
    assert.deepEqual(again, [], "the hand-over is consumed");
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
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

    // The owner claims only while its previous navigation is in flight.
    let adminInFlight = false;
    const stopAdmin = admin.subscribeAdminModuleActivate(() => adminInFlight);
    assert.equal(admin.requestAdminModuleActivate("audit-log"), false, "nothing in flight: the caller pushes");
    adminInFlight = true;
    assert.equal(admin.requestAdminModuleActivate("admin-pricing"), true, "in flight: the owner claims");
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
    admin.subscribeAdminModuleActivate(() => {})();
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

  const admin = read("frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx");
  assert.ok(admin.includes("const inFlight = pendingNavigationIntent.current?.target != null;"));
  assert.ok(admin.includes("return inFlight;"), "the admin controller claims while in flight");
  assert.ok(
    admin.includes("router.replace(buildDashboardModuleHref(ROUTES.dashboardAdmin, intent.target), {"),
    "the admin controller replaces the superseded entry with the claimed module",
  );
  assert.ok(
    admin.includes("if (superseded === null && currentUrlModule.current === target) return;"),
    "a pending navigation keeps every newer intent, as in clinicNavigationState",
  );
  assert.ok(
    admin.includes("if (pushedFrom.current?.module === intent.target) {") &&
      admin.includes("window.history.back();"),
    "returning to the module the burst pushed from steps back instead of leaving [A, A]",
  );

  const clinic = read("frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx");
  assert.ok(clinic.includes("const inFlight = navigationState.current.pendingIntent !== null;"));
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
