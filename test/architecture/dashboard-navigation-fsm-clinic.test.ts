import assert from "node:assert/strict";
import test from "node:test";

import { readSourceFile as read } from "../helpers/tracked-source-files.ts";
import {
  createNavigationCoordinator,
  previewDisplay,
  type CoordinatorHost,
  type NavigationEffect,
} from "../../frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts";
import {
  initial,
  transition,
  type MachineConfig,
  type NavEvent,
  type NavLocation,
} from "../../frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts";

// PR-NAV-04 — the clinic shell and hub navigate through the navigation machine
// (docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §16, rev. 2.3).
//
// The machine and its interpreter are verified by their own suites, with a
// clinic configuration among others. This file holds what the CUT adds:
//
//   1. the clinic contracts of the fiche (R-2/D-12, R-6, #7, C-9 with DT-13
//      pending) on the unmodified coordinator, with the production module ids;
//   2. the input adapter (`clinic-hub-reset.ts`), by behaviour;
//   3. ownership: the controller is a view and the provider owns one store per
//      surface.
//
// PR-NAV-05 — the full routes join it: their stage and "Abrir módulo completo"
// are views of the same display, and the hand-over bus they kept is gone.

const MACHINE = { initial, transition };

const CLINIC: MachineConfig = {
  surface: "clinic",
  modules: ["operaciones", "informes", "logistica", "perfil", "tokens"],
  defaultModule: "operaciones",
};

const HUB: NavLocation = { kind: "hub" };

function moduleAt(moduleId: string): NavLocation {
  return { kind: "module", module: moduleId };
}

type Hydrated = Extract<NavEvent, { readonly type: "HYDRATED" }>;

/** The coordinator on an observable host: router, storage and timers are lists. */
function clinicOwner(hydrated: Omit<Hydrated, "type">) {
  const microtasks: (() => void)[] = [];
  const navigations: NavigationEffect[] = [];
  const persisted: string[] = [];
  const timers = new Map<number, () => void>();
  const host: CoordinatorHost = {
    scheduleMicrotask: (drain) => microtasks.push(drain),
    navigate: (effect) => navigations.push(effect),
    persist: (moduleId) => persisted.push(moduleId),
    armBudget: (navId, expire) => timers.set(navId, expire),
    cancelBudget: (navId) => timers.delete(navId),
    reportError(error) {
      throw error;
    },
  };
  const store = createNavigationCoordinator(MACHINE, CLINIC, { type: "HYDRATED", ...hydrated }, host);
  const settle = () => {
    for (let task = microtasks.shift(); task !== undefined; task = microtasks.shift()) task();
  };
  return {
    store,
    navigations,
    persisted,
    timers,
    settle,
    /** One task: the event, then the microtask checkpoint that follows it. */
    send(event: NavEvent) {
      store.dispatch(event);
      settle();
    },
    commit(location: NavLocation) {
      store.commit(location);
      settle();
    },
    expire(navId: number) {
      // A timer fires once: it is no longer pending when its callback runs.
      const fire = timers.get(navId);
      timers.delete(navId);
      fire?.();
      settle();
    },
  };
}

const BARE_ENTRY = { location: moduleAt("operaciones"), explicit: false } as const;

test("R-2 / D-12: a bare clinic entry restores the stored module by one replace, showing the default until it commits", () => {
  const owner = clinicOwner({ ...BARE_ENTRY, storedModule: "logistica" });

  // A1: creating the store runs nothing.
  assert.deepEqual(owner.navigations, []);
  assert.equal(owner.timers.size, 0);
  assert.deepEqual(owner.persisted, []);

  owner.store.mount();
  owner.settle();
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_REPLACE", to: moduleAt("logistica") }]);
  assert.deepEqual([...owner.timers.keys()], [1], "one budget, the restore's");
  // S10: until the commit the stage shows what the URL shows, never the target.
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("operaciones"));
  assert.deepEqual(
    previewDisplay(MACHINE, CLINIC, owner.store.getSnapshot(), moduleAt("logistica")),
    moduleAt("logistica"),
    "the render that sees the restored URL paints the restored module in that commit",
  );

  owner.commit(moduleAt("logistica"));
  const { ctx, state } = owner.store.getSnapshot();
  assert.equal(state.tag, "IDLE");
  assert.deepEqual(ctx.display, moduleAt("logistica"));
  assert.deepEqual(ctx.committed, moduleAt("logistica"));
  assert.deepEqual(owner.persisted, ["logistica"], "the restored module is what stays stored");
  assert.equal(owner.timers.size, 0);
  // R-6 / S5(a): a restore never pushes, so it adds no history entry.
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_REPLACE", to: moduleAt("logistica") }]);
});

for (const { name, hydrated, rests, stores } of [
  { name: "nothing stored (R-3)", hydrated: { ...BARE_ENTRY, storedModule: null }, rests: moduleAt("operaciones"), stores: ["operaciones"] },
  { name: "the default stored (R-3)", hydrated: { ...BARE_ENTRY, storedModule: "operaciones" }, rests: moduleAt("operaciones"), stores: ["operaciones"] },
  { name: "an unknown module stored (R-4)", hydrated: { ...BARE_ENTRY, storedModule: "bogus" }, rests: moduleAt("operaciones"), stores: ["operaciones"] },
  { name: "an explicit module (R-8)", hydrated: { location: moduleAt("informes"), explicit: true, storedModule: "logistica" }, rests: moduleAt("informes"), stores: ["informes"] },
  { name: "an unknown ?module= (R-8)", hydrated: { location: moduleAt("operaciones"), explicit: true, storedModule: "logistica" }, rests: moduleAt("operaciones"), stores: ["operaciones"] },
  { name: "the hub (R-8)", hydrated: { location: HUB, explicit: true, storedModule: "logistica" }, rests: HUB, stores: [] },
  { name: "a full route", hydrated: { location: { kind: "route", path: "/dashboard/informes", module: "informes" }, explicit: false, storedModule: "logistica" }, rests: { kind: "route", path: "/dashboard/informes", module: "informes" }, stores: ["informes"] },
  { name: "a full route without a module of the surface (S12)", hydrated: { location: { kind: "route", path: "/dashboard/otra", module: "" }, explicit: false, storedModule: "logistica" }, rests: { kind: "route", path: "/dashboard/otra", module: "" }, stores: [] },
] as const) {
  test(`entry without a restore: ${name} rests where the URL is and navigates nothing`, () => {
    const owner = clinicOwner(hydrated);
    owner.store.mount();
    owner.settle();

    assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
    assert.deepEqual(owner.store.getSnapshot().ctx.display, rests);
    assert.deepEqual(owner.navigations, []);
    assert.equal(owner.timers.size, 0);
    assert.deepEqual(owner.persisted, stores);
  });
}

test("#7: SELECT_HUB pushes the hub URL and the stage shows the hub at once; Back from a module returns to it", () => {
  const owner = clinicOwner({ location: moduleAt("informes"), explicit: true, storedModule: null });
  owner.store.mount();
  owner.settle();

  owner.send({ type: "SELECT_HUB" });
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_PUSH", to: HUB }]);
  assert.equal(owner.store.getSnapshot().state.tag, "ROUTING");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, HUB);

  owner.commit(HUB);
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.persisted, ["informes"], "the hub is not a module: it stores nothing");

  // Hub → module → Back.
  owner.send({ type: "SELECT_MODULE", module: "tokens" });
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("tokens"));
  owner.commit(moduleAt("tokens"));
  owner.send({ type: "TRAVERSE_STARTED", destination: HUB });
  assert.equal(owner.store.getSnapshot().state.tag, "TRAVERSING");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, HUB, "the stage follows Back on the event");
  owner.commit(HUB);
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, HUB);
  assert.equal(owner.timers.size, 0);
  assert.deepEqual(
    owner.navigations,
    [
      { type: "ROUTER_PUSH", to: HUB },
      { type: "ROUTER_PUSH", to: moduleAt("tokens") },
    ],
    "a traversal is the browser's: the owner navigates nothing for it",
  );
});

test("#29–#31 from the hub: a second choice is claimed by the flight and leaves once, as a replace", () => {
  const owner = clinicOwner({ location: HUB, explicit: true, storedModule: null });
  owner.store.mount();
  owner.settle();

  owner.send({ type: "SELECT_MODULE", module: "informes" });
  owner.send({ type: "SELECT_MODULE", module: "operaciones" });
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_PUSH", to: moduleAt("informes") }]);
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("operaciones"));

  owner.commit(moduleAt("informes"));
  assert.deepEqual(owner.navigations.at(-1), { type: "ROUTER_REPLACE", to: moduleAt("operaciones") });
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("operaciones"), "the landed module is never shown");
  owner.commit(moduleAt("operaciones"));
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.equal(owner.navigations.length, 2);
  assert.equal(owner.timers.size, 0);
});

test("C-9, DT-13 pending: a render failure during the restore drops it, and leaving FAILED rests on the default module and stores it", () => {
  const owner = clinicOwner({ ...BARE_ENTRY, storedModule: "logistica" });

  // The boundary is a child: its effect runs before the owner's, in one flush.
  owner.store.dispatch({ type: "NAV_FAILED", reason: "unknown" });
  owner.store.mount();
  owner.settle();
  assert.equal(owner.store.getSnapshot().state.tag, "FAILED");
  assert.deepEqual(owner.navigations, [], "the restore of a failed commit never leaves");
  assert.equal(owner.timers.size, 0, "and arms no budget");

  owner.send({ type: "RESET", location: owner.store.getSnapshot().delivered });
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("operaciones"));
  assert.deepEqual(owner.navigations, [], "RESET does not retry the restore");
  assert.equal(owner.timers.size, 0);
  // The known limitation, as it is: the stored preference is overwritten.
  assert.deepEqual(owner.persisted, ["operaciones"]);
  // The unmount that follows "Reintentar" resets again: an ignored pair.
  owner.send({ type: "RESET", location: owner.store.getSnapshot().delivered });
  assert.deepEqual(owner.persisted, ["operaciones"]);
});

test("C-6: FAILED lasts while the boundary is mounted; leaving it by a pathname change reconciles with the URL the owner last saw", () => {
  const route: NavLocation = { kind: "route", path: "/dashboard/informes", module: "informes" };
  const owner = clinicOwner({ location: moduleAt("informes"), explicit: true, storedModule: null });
  owner.store.mount();
  owner.settle();

  // "Abrir módulo completo" is the control's own push: an external commit.
  owner.commit(route);
  owner.send({ type: "NAV_FAILED", reason: "unknown" });
  assert.equal(owner.store.getSnapshot().state.tag, "FAILED");

  // Back to /dashboard: the commit is ignored in FAILED but remembered, and
  // the boundary's cleanup resets with it.
  owner.send({ type: "TRAVERSE_STARTED", destination: moduleAt("informes") });
  owner.commit(moduleAt("informes"));
  assert.equal(owner.store.getSnapshot().state.tag, "FAILED");
  owner.send({ type: "RESET", location: owner.store.getSnapshot().delivered });
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("informes"));
  assert.deepEqual(owner.navigations, []);
  assert.equal(owner.timers.size, 0);

  owner.send({ type: "SELECT_MODULE", module: "tokens" });
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_PUSH", to: moduleAt("tokens") }], "the next click navigates");
});

function withWindow<T>(run: () => Promise<T>): Promise<T> {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previous = globals.window;
  globals.window = globalThis;
  return run().finally(() => {
    if (hadWindow) globals.window = previous;
    else delete globals.window;
  });
}

test("adapter: a clinic request goes to the navigation owner, whose answer is the claim (DT-10)", () =>
  withWindow(async () => {
    const clinic = await import("../../frontend/src/lib/clinic-hub-reset.ts");

    assert.equal(clinic.requestClinicModuleActivate("tokens"), false, "no owner: the caller navigates");
    clinic.requestClinicHubReset();

    const heard: string[] = [];
    let takes = false;
    const unregister = clinic.registerClinicNavigationOwner({
      selectModule(moduleId) {
        heard.push(moduleId);
        return takes;
      },
      selectHub() {
        heard.push("hub");
      },
    });
    assert.deepEqual(heard, [], "nothing asked before the owner registered is replayed to it");

    // BOOTING, FAILED or an unknown module: the owner declines, the caller keeps its navigation.
    assert.equal(clinic.requestClinicModuleActivate("perfil"), false);
    takes = true;
    assert.equal(clinic.requestClinicModuleActivate("informes"), true, "the owner took it: the caller must not navigate");
    clinic.requestClinicHubReset();
    assert.deepEqual(heard, ["perfil", "informes", "hub"]);

    // PR-NAV-05: the owner is the only thing a request reaches. No bus, no
    // listener, no replay and no hand-over are left to export.
    assert.deepEqual(
      Object.keys(clinic).sort(),
      ["registerClinicNavigationOwner", "requestClinicHubReset", "requestClinicModuleActivate"],
      "the adapter exports the owner registration and the two requests, nothing else",
    );

    // A newer owner replaces the previous one; the stale unregister is inert.
    const next: string[] = [];
    const unregisterNext = clinic.registerClinicNavigationOwner({
      selectModule(moduleId) {
        next.push(moduleId);
        return true;
      },
      selectHub() {},
    });
    unregister();
    assert.equal(clinic.requestClinicModuleActivate("perfil"), true);
    assert.deepEqual(next, ["perfil"]);
    unregisterNext();
    assert.equal(clinic.requestClinicModuleActivate("perfil"), false, "an unregistered owner hears nothing");
  }));

const CONTROLLER = "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const PROVIDER = "frontend/src/components/dashboard/DashboardNavigationProvider.tsx";
const ADAPTER = "frontend/src/lib/clinic-hub-reset.ts";

test("ownership: the clinic controller is a view of the machine's display and owns no navigation", () => {
  const controller = read(CONTROLLER);

  assert.ok(
    controller.includes("const navigation = useClinicDashboardNavigation();"),
    "the stage reads the navigation owner",
  );
  for (const retired of [
    "navigationState",
    "hubOverride",
    "historyTraversalStarted",
    "useNavigationFlight",
    "flight.",
    "hasRestoredLastModule",
    "hasManuallyReturnedToHub",
    "clinicNavigationState",
    "historyTraversal",
    "subscribeClinicModuleActivate",
    "subscribeClinicHubReset",
    "readDashboardLastModule",
    "writeDashboardLastModule",
    "useRouter",
    "router.",
    "useState",
    "setActiveModule",
    "popstate",
  ]) {
    assert.equal(controller.includes(retired), false, `the clinic view keeps no navigation authority: ${retired}`);
  }
  assert.equal(
    /history\.(back|forward|go|pushState|replaceState)\(|router\.refresh\(|location\.(assign|replace|reload)\(/.test(controller),
    false,
    "no native history, refresh or document navigation in the view (S9, DT-2)",
  );
  // What the stage shows is what the chrome is told: one value, derived in render.
  assert.ok(
    controller.includes('usePublishStageModule("clinic", isHubActive ? null : activeModule);'),
    "the view relays the display to the clinic chrome",
  );
  // The chrome of `/dashboard` reads the same display itself. The page streams,
  // so the controller can mount a commit later than the band and the bar: read
  // from what the stage publishes alone, they fell back to the URL in between
  // and showed the module a claimed flight had just landed on.
  const selector = read("frontend/src/components/dashboard/useStageModule.ts");
  assert.ok(
    selector.includes("const clinicNavigation = useClinicDashboardNavigation();") &&
      selector.includes("if (clinicNavigation?.hub) return null;") &&
      selector.includes("return clinicNavigation?.module ?? published;"),
    "the clinic chrome follows the machine's display, and the hand-over stage only on a full route",
  );
  assert.ok(
    read("frontend/src/components/dashboard/DashboardNavigationFrame.tsx").includes(
      'const staged = useStageModule("clinic");',
    ),
    "the lateral band of /dashboard reads the display, not the published stage alone",
  );
  assert.ok(
    controller.includes("{navigation?.stalled ? <ClinicNavigationStalledNotice onRetry={navigation.retry} /> : null}") &&
      controller.includes('data-dashboard-navigation-stalled="true"') &&
      controller.includes('role="status"'),
    "STALLED is visible and recoverable (L3)",
  );
});

test("ownership: one provider, one coordinator, one store per surface", () => {
  const provider = read(PROVIDER);

  assert.equal(provider.split("createNavigationCoordinator(").length - 1, 1, "one interpreter for both surfaces");
  assert.equal(provider.split("writeDashboardLastModule(").length - 1, 1, "storage is written by PERSIST only");
  assert.equal(provider.split("readDashboardLastModule(").length - 1, 1, "storage is read once, for HYDRATED");
  assert.equal(provider.split("setTimeout(").length - 1, 1, "the only timer is the budget");
  assert.ok(provider.includes("setTimeout(expire, NAVIGATION_FLIGHT_BUDGET_MS)"), "DT-5: one budget value in the tree");
  assert.equal(
    /history\.(back|forward|go|pushState|replaceState)\(|router\.refresh\(/.test(provider),
    false,
    "the owner navigates through router.push/replace only (S9, DT-2)",
  );
  assert.ok(
    provider.includes("router.push(href, { scroll: false })") && provider.includes("router.replace(href, { scroll: false })"),
    "T2 transport without scroll (DT-1)",
  );

  const clinic = provider.slice(provider.indexOf("const CLINIC_CONFIG"), provider.indexOf("const SURFACES"));
  assert.ok(clinic.length > 0, "the clinic surface is declared");
  for (const part of [
    'surface: "clinic"',
    "modules: CLINIC_MODULE_IDS",
    "defaultModule: DEFAULT_CLINIC_MODULE",
    "storageKey: CLINIC_LAST_MODULE_STORAGE_KEY",
    "parseModule: parseClinicModule",
    "registerOwner: registerClinicNavigationOwner",
    // The default module is spelled as the bare URL; the hub has one URL.
    "clinicModuleHref(ROUTES.dashboard, DEFAULT_CLINIC_MODULE, location.module)",
    'buildHubHref("clinic")',
    "isHubRequested(query)",
  ]) {
    assert.ok(clinic.includes(part), `the clinic surface declares ${part}`);
  }
  for (const adminOnly of ["ADMIN_", "parseAdminModule", "registerAdminNavigationOwner", "adminHref"]) {
    assert.equal(clinic.includes(adminOnly), false, `the clinic surface shares nothing of admin: ${adminOnly}`);
  }
  const admin = provider.slice(provider.indexOf("const ADMIN_CONFIG"), provider.indexOf("const CLINIC_CONFIG"));
  assert.ok(admin.length > 0, "the admin surface is declared");
  for (const clinicOnly of ["CLINIC_", "parseClinicModule", "registerClinicNavigationOwner", "clinicModuleHref"]) {
    assert.equal(admin.includes(clinicOnly), false, `the admin surface shares nothing of clinic: ${clinicOnly}`);
  }

  // DT-10, for both surfaces: the owner declines what the machine would ignore.
  assert.ok(
    provider.includes('if (parsed === null || tag === "BOOTING" || tag === "FAILED") return false;') &&
      provider.includes('store.dispatch({ type: "SELECT_MODULE", module: parsed });') &&
      provider.includes('store.dispatch({ type: "SELECT_HUB" });'),
    "selections reach the machine through the registered owner",
  );
  // §11.3: previewed in render, dispatched in the layout effect of that commit; mounted in a passive effect (A4).
  assert.ok(
    provider.includes("useLayoutEffect(() => {\n    store?.commit(location);\n  }, [store, location]);") &&
      provider.includes("previewDisplay(MACHINE, surface.config, snapshot, source.location)"),
  );
  assert.equal(provider.split("store.mount();").length - 1, 1);
  assert.equal(provider.split("store.unmount();").length - 1, 1);
});

test("every clinic module destination asks the owner first, the hub's own cards included", () => {
  // The hub is a supported surface (`/dashboard?hub=1`) and its cards are module
  // selections. Left as plain links they navigated on their own: the owner saw
  // only the commit, so a slow card stayed on the hub with no budget and no
  // notice, and the next choice was a second push instead of a claim.
  const hub = read("frontend/src/components/dashboard/ClinicModuleHub.tsx");
  assert.ok(
    hub.includes('import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";') &&
      hub.includes("claim: () => requestClinicModuleActivate(entry.moduleId),"),
    "each hub card asks the navigation owner",
  );
  // Both launchers of the hub honour the answer: the grid from 768px up and
  // the tile launcher below it. A declined request keeps the card's own href.
  for (const [path, control] of [
    ["frontend/src/components/dashboard/DashboardModuleHub.tsx", "data-dashboard-module-card={card.moduleId}"],
    ["frontend/src/components/dashboard/AdminMobileLauncherTile.tsx", "data-admin-mobile-hub-tile={card.moduleId}"],
  ] as const) {
    const source = read(path);
    assert.match(
      source,
      /onClick=\{\(event\) => \{\s*if \(card\.claim\?\.\(\)\) event\.preventDefault\(\);\s*\}\}/,
      `${path}: a claimed card must not navigate`,
    );
    assert.ok(
      source.indexOf(control) < source.indexOf("if (card.claim?.()) event.preventDefault();") &&
        source.includes('href={card.href ?? "#"}'),
      `${path}: the claim sits on the routed control, which keeps its href`,
    );
    assert.equal(/useRouter|router\.|history\.|location\./.test(source), false, `${path}: the launcher navigates nothing itself`);
  }
  // No clinic control that names a module navigates without asking.
  for (const path of [
    "frontend/src/components/dashboard/NavigationDrawer.tsx",
    "frontend/src/components/dashboard/NavigationRail.tsx",
    "frontend/src/components/dashboard/DashboardMobileNav.tsx",
    "frontend/src/components/dashboard/DashboardMobileKebabMenu.tsx",
    "frontend/src/components/dashboard/WorkspaceAppBar.tsx",
    "frontend/src/components/dashboard/ClinicModuleHub.tsx",
  ]) {
    assert.ok(read(path).includes("requestClinicModuleActivate("), `${path} asks the clinic owner`);
  }
});

const STAGE = "frontend/src/components/dashboard/ClinicFullRouteModuleStage.tsx";
const CONTROL = "frontend/src/components/dashboard/FullModuleRouteControl.tsx";
const INFORMES_ROUTE: NavLocation = { kind: "route", path: "/dashboard/informes", module: "informes" };

test("adapter: the owner decides, and the full-route hand-over is retired (PR-NAV-05)", () => {
  const adapter = read(ADAPTER);

  assert.ok(adapter.includes("export function registerClinicNavigationOwner("));
  assert.ok(adapter.includes("owner?.selectHub();"), "the hub signal is SELECT_HUB");
  assert.ok(
    adapter.includes("return owner === null ? false : owner.selectModule(moduleId);"),
    "a module request is the owner's answer and nothing else",
  );
  for (const retired of [
    "subscribeClinicHubReset",
    "subscribeClinicModuleActivate",
    "relinquishClinicModuleActivateHandOver",
    "handsOver",
    "unheardActivation",
    "LATE_ACTIVATION_MAX_AGE_MS",
    "isHistoryTraversalDispatch",
    "window",
    "popstate",
    "performance.now()",
    "Listener",
  ]) {
    assert.equal(adapter.includes(retired), false, `the hand-over is gone: ${retired}`);
  }
  assert.equal(/^import /m.test(adapter), false, "the adapter imports nothing");

  // No consumer of the retired bus is left in the surfaces it connected.
  for (const path of [STAGE, CONTROL, CONTROLLER, PROVIDER, "frontend/src/components/dashboard/DashboardNavigationFrame.tsx"]) {
    assert.equal(
      /subscribeClinicModuleActivate|relinquishClinicModuleActivateHandOver|handsOver/.test(read(path)),
      false,
      `${path} keeps no hand-over`,
    );
  }
  assert.equal(
    read("frontend/src/components/dashboard/UploadReportModal.tsx").split("router.refresh()").length - 1,
    1,
    "UploadReportModal keeps its own refresh, outside this cut",
  );
});

test("ownership: the full-route stage is a view of the machine's display and owns no navigation (PR-NAV-05)", () => {
  const stage = read(STAGE);

  assert.ok(stage.includes("const navigation = useClinicDashboardNavigation();"), "the stage reads the navigation owner");
  assert.ok(
    stage.includes("const leaving = navigation !== null && navigation.route !== pathname;"),
    "the route's own content is on stage exactly while the display is this route",
  );
  for (const retired of [
    "useState",
    "useEffect",
    "setLeavingTo",
    "clinic-hub-reset",
    "historyTraversal",
    "popstate",
    "useRouter",
    "router.",
    "setTimeout",
    "readDashboardLastModule",
    "writeDashboardLastModule",
  ]) {
    assert.equal(stage.includes(retired), false, `the full-route view keeps no navigation authority: ${retired}`);
  }
  assert.equal(
    /history\.(back|forward|go|pushState|replaceState)\(|router\.refresh\(|location\.(assign|replace|reload)\(/.test(stage),
    false,
    "no native history, refresh or document navigation in the view (S9, DT-2)",
  );
  // The band of a full route renders outside any boundary and reads what the
  // stage publishes: the machine's display, relayed, not a second decision.
  assert.ok(
    stage.includes("const leavingTo = leaving ? navigation.module : null;") &&
      stage.includes('usePublishStageModule("clinic", leavingTo, leavingTo !== null);'),
    "the view relays the display to the band of the route",
  );
  assert.ok(
    stage.includes("{navigation?.stalled ? <FullRouteNavigationStalledNotice onRetry={navigation.retry} /> : null}") &&
      stage.includes('data-dashboard-navigation-stalled="true"') &&
      stage.includes('role="status"') &&
      stage.includes("Reintentar"),
    "STALLED is visible and recoverable on a full route (L3)",
  );
  assert.ok(
    stage.includes('<div className="relative z-[3] h-0 shrink-0">'),
    "the notice is a zero-height anchor: it never changes the height the workspace measures",
  );
});

test("ownership: Abrir módulo completo dispatches OPEN_ROUTE and reads its pending state from the machine (PR-NAV-05)", () => {
  const control = read(CONTROL);

  assert.ok(control.includes("const navigation = useClinicDashboardNavigation();"));
  assert.ok(
    control.includes("const isPending = navigation?.route === href;"),
    "pending is the display naming this route, not a local flag",
  );
  assert.ok(
    control.includes("if (navigation?.openRoute(href)) event.preventDefault();"),
    "the owner navigates what it took; a declined request keeps the control's own href (DT-10)",
  );
  for (const retired of ["useTransition", "startTransition", "useState", "useRouter", "router.", "setTimeout"]) {
    assert.equal(control.includes(retired), false, `the control keeps no navigation of its own: ${retired}`);
  }
  assert.ok(control.includes("aria-busy={isPending || undefined}"), "the pending state is exposed, not only painted");
  assert.ok(control.includes('"Abriendo módulo…"'), "the pending state is visible");
  assert.ok(
    control.includes("<PublicRouteControl") && control.includes("href={href}"),
    "keeps the route-control pattern, its href and its pre-hydration fallback",
  );

  // The owner's side: only a full route of the surface with a module of its own
  // is dispatched; BOOTING and FAILED decline, as for a module (DT-10).
  const provider = read(PROVIDER);
  assert.ok(
    provider.includes("const target = CLINIC_SURFACE.locate(href, NO_QUERY)?.location;") &&
      provider.includes('if (target?.kind !== "route" || parseClinicModule(target.module) === null) return false;') &&
      provider.includes('if (tag === "BOOTING" || tag === "FAILED") return false;') &&
      provider.includes('store.dispatch({ type: "OPEN_ROUTE", path: target.path, module: target.module });'),
    "OPEN_ROUTE reaches the machine through the clinic owner",
  );
  assert.equal(provider.split('type: "OPEN_ROUTE"').length - 1, 1, "one emitter of OPEN_ROUTE");
});

test("#8, #12, #15: Abrir módulo completo routes with a budget, stalls when it never lands and retries as a document navigation", () => {
  const owner = clinicOwner({ location: moduleAt("informes"), explicit: true, storedModule: null });
  owner.store.mount();
  owner.settle();

  owner.send({ type: "OPEN_ROUTE", path: "/dashboard/informes", module: "informes" });
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_PUSH", to: INFORMES_ROUTE }]);
  assert.equal(owner.store.getSnapshot().state.tag, "ROUTING");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, INFORMES_ROUTE, "the control is pending on the click");
  assert.deepEqual([...owner.timers.keys()], [1]);

  owner.expire(1);
  assert.equal(owner.store.getSnapshot().state.tag, "STALLED");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, INFORMES_ROUTE);
  assert.equal(owner.navigations.length, 1, "the budget re-issues nothing by itself");
  assert.equal(owner.timers.size, 0);

  owner.send({ type: "RETRY" });
  assert.deepEqual(owner.navigations.at(-1), { type: "HARD_NAVIGATE", to: INFORMES_ROUTE, mode: "assign" });
  assert.equal(owner.store.getSnapshot().state.tag, "ROUTING");
  assert.deepEqual([...owner.timers.keys()], [2], "the retry has a budget of its own");

  // A route that names no module of the surface is not a selection (#6, S12).
  const idle = clinicOwner({ location: moduleAt("informes"), explicit: true, storedModule: null });
  idle.store.mount();
  idle.settle();
  idle.send({ type: "OPEN_ROUTE", path: "/dashboard/otra", module: "" });
  assert.equal(idle.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(idle.navigations, []);
  assert.deepEqual(idle.persisted, ["informes"]);
});

test("#5, #12, #16 from a full route: a /dashboard payload that never answers stalls, and the next choice navigates", () => {
  const owner = clinicOwner({ location: INFORMES_ROUTE, explicit: false, storedModule: null });
  owner.store.mount();
  owner.settle();
  assert.deepEqual(owner.persisted, ["informes"], "the route stores its module on entry (#1)");

  owner.send({ type: "SELECT_MODULE", module: "tokens" });
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("tokens"), "the route's stage leaves on the click");
  owner.expire(1);
  assert.equal(owner.store.getSnapshot().state.tag, "STALLED");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("tokens"));

  owner.send({ type: "SELECT_MODULE", module: "perfil" });
  assert.equal(owner.store.getSnapshot().state.tag, "ROUTING", "STALLED is never terminal");
  assert.deepEqual(owner.navigations, [
    { type: "ROUTER_PUSH", to: moduleAt("tokens") },
    { type: "ROUTER_PUSH", to: moduleAt("perfil") },
  ]);
  owner.commit(moduleAt("perfil"));
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("perfil"));
  assert.deepEqual(owner.persisted, ["informes", "perfil"]);
  assert.equal(owner.timers.size, 0, "no budget outlives the flight");

  // Returning to the route the URL still shows is #25: no stall, no budget.
  const back = clinicOwner({ location: INFORMES_ROUTE, explicit: false, storedModule: null });
  back.store.mount();
  back.settle();
  back.send({ type: "SELECT_MODULE", module: "tokens" });
  back.send({ type: "OPEN_ROUTE", path: "/dashboard/informes", module: "informes" });
  assert.equal(back.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(back.store.getSnapshot().ctx.display, INFORMES_ROUTE, "the route's own content is back on stage");
  assert.equal(back.timers.size, 0);
});

test("C-8 / L6 between a full route and the shell: Back then Forward, and Back then the committed module, never stall", () => {
  const owner = clinicOwner({ location: moduleAt("informes"), explicit: true, storedModule: null });
  owner.store.mount();
  owner.settle();
  owner.send({ type: "OPEN_ROUTE", path: "/dashboard/informes", module: "informes" });
  owner.commit(INFORMES_ROUTE);
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");

  // Back towards the shell, then Forward before it commits (#17, #28).
  owner.send({ type: "TRAVERSE_STARTED", destination: moduleAt("informes") });
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("informes"), "the route's stage follows Back on the event");
  owner.send({ type: "TRAVERSE_STARTED", destination: INFORMES_ROUTE });
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, INFORMES_ROUTE);
  assert.equal(owner.timers.size, 0, "no budget is left to expire into STALLED");

  // From the shell: Back towards the route, then the committed module (#25).
  owner.send({ type: "SELECT_MODULE", module: "tokens" });
  owner.commit(moduleAt("tokens"));
  const before = owner.navigations.length;
  owner.send({ type: "TRAVERSE_STARTED", destination: INFORMES_ROUTE });
  assert.equal(owner.store.getSnapshot().state.tag, "TRAVERSING");
  owner.send({ type: "SELECT_MODULE", module: "tokens" });
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("tokens"));
  assert.deepEqual(owner.navigations.slice(before), [{ type: "ROUTER_PUSH", to: moduleAt("tokens") }]);
  assert.equal(owner.timers.size, 0);
});

test("#29–#30 across the pathname: a module chosen while Abrir módulo completo is in flight is claimed and replaces the route's entry", () => {
  const owner = clinicOwner({ location: moduleAt("informes"), explicit: true, storedModule: null });
  owner.store.mount();
  owner.settle();

  owner.send({ type: "OPEN_ROUTE", path: "/dashboard/informes", module: "informes" });
  owner.send({ type: "SELECT_MODULE", module: "tokens" });
  assert.deepEqual(owner.navigations, [{ type: "ROUTER_PUSH", to: INFORMES_ROUTE }], "claimed, not navigated");
  assert.deepEqual(owner.store.getSnapshot().ctx.display, moduleAt("tokens"));

  // The route lands: its stage mounts as a view and shows the claimed module, never its own content.
  assert.deepEqual(previewDisplay(MACHINE, CLINIC, owner.store.getSnapshot(), INFORMES_ROUTE), moduleAt("tokens"));
  owner.commit(INFORMES_ROUTE);
  assert.deepEqual(owner.navigations.at(-1), { type: "ROUTER_REPLACE", to: moduleAt("tokens") });
  owner.commit(moduleAt("tokens"));
  assert.equal(owner.store.getSnapshot().state.tag, "IDLE");
  assert.deepEqual(owner.persisted, ["informes", "tokens"], "the route that only relayed the burst stores nothing");
  assert.equal(owner.timers.size, 0);
});
