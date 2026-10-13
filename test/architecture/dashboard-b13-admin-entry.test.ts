import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../helpers/tracked-source-files.ts";

const CONFIG = "frontend/src/features/dashboard/config/dashboardModules.ts";
const NAVIGATION =
  "frontend/src/features/dashboard/application/dashboardModuleNavigation.ts";
const CONTROLLER =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const PROVIDER = "frontend/src/components/dashboard/DashboardNavigationProvider.tsx";
const MACHINE = "frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts";
const COORDINATOR = "frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts";
const ADAPTER = "frontend/src/lib/admin-hub-reset.ts";
const MOBILE_NAV = "frontend/src/components/dashboard/DashboardMobileNav.tsx";
const DRAWER = "frontend/src/components/dashboard/NavigationDrawer.tsx";
const RAIL = "frontend/src/components/dashboard/NavigationRail.tsx";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";

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

test("B13 · entry precedence preserves URL intent and resolves the retired hub", () => {
  // PR-NAV-03: entry precedence is the navigation machine's (rows #1–#3 of the
  // FSM roadmap §12.4), fed by the provider. The controller is its view.
  const source = read(CONTROLLER);
  const provider = read(PROVIDER);
  const machine = read(MACHINE);

  for (const [path, owner] of [[CONTROLLER, source], [PROVIDER, provider]] as const) {
    assert.ok(
      owner.includes("parseAdminModule(searchParams.get(MODULE_QUERY_PARAM))"),
      `${path}: module parsing remains the URL authority`,
    );
  }
  assert.ok(
    provider.includes(
      "const explicit = searchParams.has(MODULE_QUERY_PARAM) || searchParams.has(HUB_QUERY_PARAM);",
    ),
    "the entry tells the machine whether the URL carried a module or ?hub=1, valid or not",
  );
  assert.ok(
    machine.includes('if (event.location.kind !== "none") return null;'),
    "a URL that resolves to a module wins over storage",
  );
  assert.ok(
    provider.includes(
      "storedModule: parseAdminModule(readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY)),",
    ) &&
      machine.includes(
        'return { kind: "module", module: valid(config, stored) ? stored : config.defaultModule };',
      ) &&
      provider.includes("defaultModule: DEFAULT_ADMIN_MODULE,"),
    "missing, stale, or unavailable storage falls back to the default",
  );
  const hydrate = machine.slice(machine.indexOf("function hydrate("), machine.indexOf("function select("));
  assert.ok(
    hydrate.includes('{ type: "ROUTER_REPLACE", to: target },') &&
      hydrate.includes("ROUTER_PUSH") === false &&
      provider.includes('else if (effect.type === "ROUTER_REPLACE") router.replace(href, { scroll: false });') &&
      provider.includes("buildDashboardModuleHref(ROUTES.dashboardAdmin, location.module)"),
    "the bare landing is canonicalized with replace",
  );
  // Desktop/tablet space pass: the hub is retired at every width, so nothing
  // navigates TO it any more (no back-to-hub control, no hub tiles feeding a
  // two-commit activation buffer). The contracted hub-reset signal is still
  // exported and reaches the navigation owner.
  assert.equal(source.includes("buildAdminHubHref"), false, "no control links or replaces into the hub");
  assert.equal(source.includes("onBack="), false, "modules carry no back-to-hub control");
  assert.equal(source.includes("pendingActivation"), false, "the hub-tile activation buffer left with the tiles");
  assert.ok(
    read(ADAPTER).includes("export function requestAdminHubReset(): void {") &&
      provider.includes('store.dispatch({ type: "SELECT_HUB" });'),
    "the contracted hub-reset signal is still honoured",
  );
  // One owner: the refs that used to classify commits in the controller are
  // gone, not duplicated next to the machine.
  for (const retired of [
    "pendingNavigationIntent",
    "previousUrlModule",
    "currentUrlModule",
    "supersededTargets",
    "pushedFrom",
    "hasRestoredLastModule",
    "useRouter",
    "useNavigationFlight",
    "window.history",
  ]) {
    assert.equal(source.includes(retired), false, `the controller keeps no navigation state of its own: ${retired}`);
  }
  assert.ok(
    source.includes("const activeModule = navigation === null ? urlModule : navigation.module;"),
    "the stage shows the machine's display",
  );
});

test("B13 · no admin surface links the retired Inicio and persistence is kept", () => {
  // Desktop/tablet space pass: the drawer (>=1280px) and the rail (768-1279px)
  // drop their admin Inicio item with the hub, exactly as the mobile bar did in
  // pre-C05. No admin navigation primitive links `?hub=1` any more; the
  // grammar itself survives in the application layer (first test) because the
  // clinic hub still owns it and legacy admin URLs must keep resolving.
  for (const path of [DRAWER, RAIL]) {
    const source = read(path);
    assert.equal(source.includes("buildAdminHubHref"), false, `${path} must not link the retired admin hub`);
    assert.equal(source.includes("ADMIN_HOME_NAV_ITEM"), false, `${path} must not paint the admin Inicio item`);
    assert.equal(source.includes("DASHBOARD_HOME_ICON"), false, `${path} carries no Inicio glyph`);
  }
  // Pre-C05 mobile space: the mobile bar no longer carries an Inicio slot for
  // any role, so it links no hub URL at all (ADMIN_MOBILE_HOME_ITEM = RETIRED).
  assert.equal(
    read(MOBILE_NAV).includes("buildHubHref("),
    false,
    `${MOBILE_NAV} must not link a hub: the admin mobile Inicio is retired`,
  );

  const mobile = read(MOBILE_NAV);
  assert.equal(
    mobile.includes('writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, "")'),
    false,
    "admin Inicio must not erase the durable last module",
  );
});

test("B13 · at every width the admin hub resolves to the landing module, never paints", () => {
  const source = read(CONTROLLER);

  // Pre-C05 retired the hub below 768px; the desktop/tablet space pass retires
  // it from 768px up, so the resolver is no longer gated on a media query.
  assert.equal(source.includes("matchMedia"), false, "the retirement is not scoped to a width regime");
  assert.equal(source.includes("ADMIN_MOBILE_REGIME_QUERY"), false);
  // PR-NAV-03: the resolver is the machine's `normalization`, reached by rows
  // #3 and `settle`. It replaced the controller's native `replaceState`.
  const machine = read(MACHINE);
  const provider = read(PROVIDER);
  const resolverStart = machine.indexOf("function normalization(");
  assert.ok(resolverStart !== -1, "the null module state has a resolver");
  const resolver = machine.slice(resolverStart, machine.indexOf("function persistable(", resolverStart));
  assert.ok(
    resolver.includes('if (config.surface !== "admin" || location.kind !== "none") return null;'),
    "a module already in the URL wins over the landing fallback",
  );
  assert.ok(
    resolver.includes("module: valid(config, ctx.lastModule) ? ctx.lastModule : config.defaultModule,") &&
      provider.includes("defaultModule: DEFAULT_ADMIN_MODULE,"),
    "the hub lands where a bare route lands: last module, else the default (Resumen)",
  );
  const settle = machine.slice(machine.indexOf("function settle("), machine.indexOf("function issue("));
  assert.ok(
    settle.includes('intent: "restore",') &&
      settle.includes('{ type: "ROUTER_REPLACE", to: target },') &&
      settle.includes("ROUTER_PUSH") === false,
    "the hub URL is replaced, not stacked in history",
  );
  // The fallback is now a router navigation, so what protects a user
  // navigation is no longer "it never enters the router queue": a selection
  // over a pending restore leaves at once (#10) and the restore's own commit is
  // recorded without being painted (#11).
  assert.ok(
    machine.includes('if (state.intent === "restore") {') &&
      machine.includes("return { ctx: { ...ctx, committed: location }, state, effects: [] }; // #11"),
    "a user navigation over the pending fallback wins, and the fallback's late commit never repaints",
  );
  // S9: no native history effect anywhere in the navigation owner.
  for (const path of [CONTROLLER, PROVIDER, COORDINATOR]) {
    assert.equal(
      /history\.(pushState|replaceState|back|forward|go)\(/.test(read(path)),
      false,
      `${path}: the owner navigates through the router only`,
    );
  }
  for (const retired of ["DashboardModuleHub", "DashboardHubHero", "data-admin-hub-surface", "Módulos de administración", "Abrir administración"]) {
    assert.equal(source.includes(retired), false, `the hub surface is gone: ${retired}`);
  }
  assert.ok(source.includes(") : null}\n    </div>\n  );\n}"), "the null module state paints nothing while it resolves");
});

test("B13 · the lateral rail reserves a viewport budget for Inicio", () => {
  const css = read(NAVIGATION_CSS);
  assert.ok(css.includes("max-height: 759.98px"));
});
