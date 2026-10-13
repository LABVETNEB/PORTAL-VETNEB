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
//   3. ownership: the controller is a view, the provider owns one store per
//      surface, and the full-route hand-over stays where it was (PR-NAV-05).

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
      timers.get(navId)?.();
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

    // The full-route stage still hears every request and still never claims (PR-NAV-05 retires it).
    const staged: string[] = [];
    const stopStage = clinic.subscribeClinicModuleActivate(
      (moduleId) => {
        staged.push(moduleId);
        return true;
      },
      { handsOver: true },
    );
    takes = false;
    assert.equal(clinic.requestClinicModuleActivate("logistica"), false, "a handing-over stage never claims");
    takes = true;
    assert.equal(clinic.requestClinicModuleActivate("tokens"), true);
    assert.deepEqual(staged, ["logistica", "tokens"]);
    assert.deepEqual(heard, ["perfil", "informes", "hub", "logistica", "tokens"]);
    stopStage();

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
    clinic.relinquishClinicModuleActivateHandOver();
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

test("adapter: the owner decides; the full-route hand-over is kept for PR-NAV-05", () => {
  const adapter = read(ADAPTER);

  assert.ok(adapter.includes("export function registerClinicNavigationOwner("));
  assert.ok(adapter.includes("owner?.selectHub();"), "the hub signal is SELECT_HUB");
  assert.equal(adapter.includes("subscribeClinicHubReset"), false, "the hub-reset bus is gone with its only listener");
  for (const kept of ["handsOver", "relinquishClinicModuleActivateHandOver", "subscribeClinicModuleActivate"]) {
    assert.ok(adapter.includes(kept), `${kept} stays until PR-NAV-05`);
  }
  assert.equal(/^import /m.test(adapter), false, "the adapter imports nothing");

  const stage = read("frontend/src/components/dashboard/ClinicFullRouteModuleStage.tsx");
  assert.ok(
    stage.includes("{ handsOver: true },") && !stage.includes("DashboardNavigationProvider"),
    "the full-route stage is not migrated here",
  );
  assert.equal(
    read("frontend/src/components/dashboard/UploadReportModal.tsx").split("router.refresh()").length - 1,
    1,
    "UploadReportModal keeps its own refresh, outside this cut",
  );
});
