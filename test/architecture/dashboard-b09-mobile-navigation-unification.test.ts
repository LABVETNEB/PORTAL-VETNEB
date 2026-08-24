import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// B09 · Mobile navigation unification static contract.
//
// B09 replaces FOUR mobile navigation components with one and closes the
// deferral B08 left behind:
//
//   LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT = CLOSED
//     `DashboardModuleRail`, `AdminMobileBottomNav`, `ClinicMobileBottomNav`
//     and `AdminMobileModuleMenu` are gone. `DashboardMobileNav` owns the whole
//     <768px regime on both roles, mounted once by `DashboardShellRouter`.
//
//   ONE CATALOG
//     The retired components carried FOUR private copies of the module tables:
//     `FIXED_DESTINATIONS` (3 ids/labels/icons), `MODULES` (10 ids/labels/icons,
//     already drifted on the `admin` label), `ADMIN_MOBILE_TITLES` (10 labels)
//     and two duplicate clinic icon maps. B09 leaves the ids/labels/order in
//     `config/dashboardModules.ts`, the glyphs in `dashboardModuleIcons.ts` and
//     the `?module=` grammar in `application/dashboardModuleNavigation.ts`.
//
//   DESTINATIONS ARE NOT ACTIONS
//     `AdminMobileKebabMenu` stays a separate owner. It is the ACTION overflow
//     and its import closure reaches `@/lib/api`; merging it into the navigation
//     owner would drag the data layer across the presentation boundary.
//
// Written fail-closed: every census asserts its own cardinality before
// iterating, so a renamed path or an empty scan fails instead of passing
// vacuously.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const MOBILE_NAV_TSX = "frontend/src/components/dashboard/DashboardMobileNav.tsx";
const SHELL_ROUTER_TSX =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const CLINIC_CONTROLLER_TSX =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const TOPBAR_TSX = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const KEBAB_TSX = "frontend/src/components/dashboard/AdminMobileKebabMenu.tsx";
const NAVIGATION_BARREL =
  "frontend/src/features/dashboard/presentation/navigation/index.ts";
const MODULE_CATALOG =
  "frontend/src/features/dashboard/config/dashboardModules.ts";
const ICON_OWNER = "frontend/src/components/dashboard/dashboardModuleIcons.ts";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";
const TOKENS_CSS = "frontend/src/styles/dashboard/tokens.css";
const MOBILE_ADMIN_CSS = "frontend/src/styles/dashboard/mobile-admin.css";
const MOBILE_CLINIC_CSS = "frontend/src/styles/dashboard/mobile-clinic.css";
const GLOBALS_CSS = "frontend/src/app/globals.css";

/** The four components B09 replaced with one. */
const RETIRED_BY_B09 = [
  "frontend/src/components/dashboard/AdminMobileBottomNav.tsx",
  "frontend/src/components/dashboard/ClinicMobileBottomNav.tsx",
  "frontend/src/components/dashboard/AdminMobileModuleMenu.tsx",
  "frontend/src/components/dashboard/DashboardModuleRail.tsx",
];

/** Selectors the retired components owned. None may survive in `frontend/src`. */
const RETIRED_SELECTORS = [
  "data-admin-mobile-bottom-nav",
  "data-clinic-mobile-bottom-nav",
  "data-admin-mobile-module-menu",
  "data-admin-mobile-module-link",
  "data-dashboard-module-rail",
  "admin-mobile-bottom-nav",
  "clinic-mobile-bottom-nav",
  "dashboard-module-rail",
];

/** The B09 CSS block, authored once in navigation.css. */
const CSS_BLOCK_START = "/* dashboard-b09-mobile-navigation-unification:start */";
const CSS_BLOCK_END = "/* dashboard-b09-mobile-navigation-unification:end */";
const TOKEN_BLOCK_START = "/* dashboard-b09-mobile-navigation-geometry:start";
const TOKEN_BLOCK_END = "/* dashboard-b09-mobile-navigation-geometry:end */";

/** Geometry the tokens own. No `.tsx` may restate any of them. */
const GEOMETRY_LITERALS = ["44px", "3.2rem", "51.2"];

/** Data attributes the mobile model publishes. */
const B09_ATTRIBUTES = [
  "data-dashboard-mobile-nav",
  "data-dashboard-mobile-nav-item",
  "data-dashboard-mobile-nav-overflow",
  "data-dashboard-mobile-nav-overflow-link",
  "data-dashboard-mobile-nav-overflow-close",
  "data-dashboard-mobile-nav-overflow-page",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function read(repoRelativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, repoRelativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

/** Strips block and line comments so a prose mention never satisfies a guard. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Strips CSS block comments, so prose can never satisfy or break a guard. */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function sliceBlock(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  assert.ok(from !== -1, `missing block start: ${start}`);
  assert.ok(to > from, `missing or misordered block end: ${end}`);
  return source.slice(from, to + end.length);
}

// ── T0 · Baseline census ─────────────────────────────────────────────────────

test("B09 · path baseline is complete before anything is asserted", () => {
  assert.equal(RETIRED_BY_B09.length, 4, "four components collapse into one");
  assert.equal(RETIRED_SELECTORS.length, 8, "eight retired selector stems");
  assert.equal(B09_ATTRIBUTES.length, 6, "six published data attributes");

  for (const path of [
    MOBILE_NAV_TSX,
    SHELL_ROUTER_TSX,
    CLINIC_CONTROLLER_TSX,
    TOPBAR_TSX,
    KEBAB_TSX,
    NAVIGATION_BARREL,
    MODULE_CATALOG,
    ICON_OWNER,
    NAVIGATION_CSS,
    TOKENS_CSS,
    MOBILE_ADMIN_CSS,
    MOBILE_CLINIC_CSS,
  ]) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must exist for the B09 contract to mean anything`,
    );
  }
});

// ── T1 · The four retirements ────────────────────────────────────────────────

test("B09 · the four legacy mobile navigations are physically retired", () => {
  for (const path of RETIRED_BY_B09) {
    assert.equal(
      existsSync(resolve(REPO_ROOT, path)),
      false,
      `${path} is retired: DashboardMobileNav replaced it. Restoring it would put a second navigation owner back on the mobile regime`,
    );
  }

  const barrel = stripComments(read(NAVIGATION_BARREL));
  for (const retired of [
    "AdminMobileBottomNav",
    "ClinicMobileBottomNav",
    "AdminMobileModuleMenu",
    "DashboardModuleRail",
    "CLINIC_MODULE_RAIL_ITEMS",
  ]) {
    assert.equal(
      barrel.includes(retired),
      false,
      `the barrel must not re-export ${retired}: it is retired`,
    );
  }
  assert.ok(
    barrel.includes('from "@/components/dashboard/DashboardMobileNav";'),
    "the barrel exports the single mobile owner",
  );
});

test("B09 · no retired selector survives in frontend/src", () => {
  // `globals.css` is a hard fence for this PR (it is for every navigation
  // block since B08), so its inert no-callout entries are excluded by path,
  // not by weakening the rule. Every OTHER file must be clean.
  for (const path of [
    NAVIGATION_CSS,
    TOKENS_CSS,
    MOBILE_ADMIN_CSS,
    MOBILE_CLINIC_CSS,
    "frontend/src/styles/dashboard/surfaces.css",
    "frontend/src/styles/dashboard/zero-scroll.css",
    MOBILE_NAV_TSX,
    SHELL_ROUTER_TSX,
    CLINIC_CONTROLLER_TSX,
    TOPBAR_TSX,
  ]) {
    const executable = stripComments(read(path));
    for (const selector of RETIRED_SELECTORS) {
      assert.equal(
        executable.includes(selector),
        false,
        `${path} still references the retired selector "${selector}"`,
      );
    }
  }

  // The fence itself is asserted, so "globals.css was excluded" can never
  // quietly become "globals.css was edited".
  assert.ok(
    read(GLOBALS_CSS).includes('[data-clinic-mobile-bottom-nav="true"]'),
    "globals.css is a hard fence for B09: its (now inert) entries stay exactly as they were",
  );
});

// ── T2 · One owner, one mount site ───────────────────────────────────────────

test("B09 · DashboardMobileNav is mounted once, at shell level, per surface", () => {
  const router = stripComments(read(SHELL_ROUTER_TSX));

  assert.ok(
    router.includes(
      'import { DashboardMobileNav } from "./DashboardMobileNav";',
    ),
    "the shell router imports the single mobile owner",
  );
  assert.equal(
    [...router.matchAll(/<DashboardMobileNav[\s/>]/g)].length,
    1,
    "exactly one mount site",
  );
  assert.ok(
    router.includes("<DashboardMobileNav surface={surface} />"),
    "the surface the shell already resolved is passed straight through",
  );

  // A sibling of the frame, never inside `main`: that is what makes the shell
  // SUBTRACT the bar's height instead of letting it cover the last row. The
  // retired rail was rendered inside the clinic stage and was the only mobile
  // navigation that spent vertical budget inside `main`.
  assert.ok(
    router.indexOf("data-vetneb-app-shell-frame") <
      router.indexOf("<DashboardMobileNav"),
    "the bar is a sibling that follows the frame, not a child of it",
  );
  const controller = stripComments(read(CLINIC_CONTROLLER_TSX));
  for (const navigationOwner of [
    "DashboardModuleRail",
    "DashboardMobileNav",
    "NavigationDrawer",
    "NavigationRail",
  ]) {
    assert.equal(
      controller.includes(navigationOwner),
      false,
      `the clinic stage must render no navigation of its own: ${navigationOwner} belongs to the shell`,
    );
  }
});

// ── T3 · One catalog: no private module table came back ──────────────────────

test("B09 · the mobile model derives every id, label, order and glyph", () => {
  const executable = stripComments(read(MOBILE_NAV_TSX));

  for (const owner of [
    "ADMIN_MODULE_NAV_LABELS",
    "CLINIC_MODULE_NAV_LABELS",
    "ADMIN_MOBILE_PRIMARY_MODULE_IDS",
    "ADMIN_MODULE_ICONS",
    "CLINIC_MODULE_ICONS",
    "buildDashboardModuleHref",
    "MODULE_QUERY_PARAM",
    "parseAdminModule",
    "parseClinicModule",
  ]) {
    assert.ok(
      executable.includes(owner),
      `${owner} is the canonical owner; the mobile model must derive from it`,
    );
  }

  // No hand-built `?module=` string, which is exactly how the retired surfaces
  // drifted from the grammar they were supposed to share.
  assert.equal(
    /\?module=/.test(executable),
    false,
    "hrefs come from buildDashboardModuleHref, never from a template literal",
  );

  // No private id/label table: every admin module id that appears must appear
  // through the catalog, not as a literal list inside the component.
  for (const moduleId of [
    "admin-report-upload",
    "admin-health",
    "admin-particular-tokens",
    "admin-pricing",
    "admin-users-roles",
    "admin-maintenance",
  ]) {
    assert.equal(
      executable.includes(`"${moduleId}"`),
      false,
      `${moduleId} must not be restated in the component: the catalog owns the module list`,
    );
  }

  // Geometry stays in tokens.css.
  for (const literal of GEOMETRY_LITERALS) {
    assert.equal(
      executable.includes(literal),
      false,
      `${literal} is geometry: tokens.css owns it, the component may not restate it`,
    );
  }

  // Navigation goes through the route-control pattern, never next/link or <a>.
  assert.ok(executable.includes("PublicRouteControl"));
  assert.equal(/from "next\/link"/.test(executable), false);
  assert.equal(/<a[\s>]/.test(executable), false);
});

test("B09 · the primary-slot cut is catalog data, not a component literal", () => {
  const catalog = read(MODULE_CATALOG);
  const block = catalog.slice(catalog.indexOf("ADMIN_MOBILE_PRIMARY_MODULE_IDS"));

  for (const moduleId of ["admin-clinics", "audit-log", "admin-sessions"]) {
    assert.ok(
      block.includes(`"${moduleId}"`),
      `${moduleId} is a shipped primary destination and must stay in the cut`,
    );
  }

  // The cut is NOT the head of the catalog — it is a curated product decision,
  // which is precisely why it has to be declared as data instead of derived.
  assert.equal(
    catalog.indexOf('"admin-clinics"') > catalog.indexOf('"admin-report-upload"'),
    true,
    "the promoted modules are not the first three of the canonical order",
  );

  // Labels and glyphs are NOT duplicated alongside the cut.
  assert.equal(
    /ADMIN_MOBILE_PRIMARY_MODULE_IDS[\s\S]*label:/.test(catalog),
    false,
    "the cut carries ids only; labels stay in ADMIN_MODULE_NAV_LABELS",
  );
  assert.ok(
    read(ICON_OWNER).includes("ADMIN_MODULE_ICONS"),
    "glyphs stay in the B07 icon owner",
  );
});

test("B09 · the admin mobile context title is derived, not declared", () => {
  const topbar = stripComments(read(TOPBAR_TSX));

  assert.equal(
    topbar.includes("ADMIN_MOBILE_TITLES"),
    false,
    "the private ten-entry label table is retired",
  );
  assert.ok(
    topbar.includes("ADMIN_MODULE_NAV_LABELS"),
    "the title reads the canonical catalog",
  );
  assert.ok(
    topbar.includes("parseAdminModule(searchParams.get(MODULE_QUERY_PARAM))"),
    "the title resolves `?module=` through the canonical parser, so aliases and unknown values behave like everywhere else",
  );
});

// ── T4 · Unknown `?module=` converges on the hub ─────────────────────────────

test("B09 · an unknown admin module resolves to the hub, never to the overflow", () => {
  const executable = stripComments(read(MOBILE_NAV_TSX));

  // The retired bar read `?module=` RAW, so an unknown value produced a
  // non-null activeModule that matched no primary destination — which lit
  // `aria-current` on "Más" while the controller painted the hub. Parsing
  // first is what makes both converge.
  assert.ok(
    executable.includes("parseAdminModule(urlModule)"),
    "the raw query value must pass through the catalog parser",
  );
  assert.equal(
    /new URLSearchParams\(window\.location\.search\)/.test(executable),
    false,
    "the active module comes from the router, not from a raw location read",
  );
  assert.ok(
    /overflowIsCurrent =\s*\n?\s*hasOverflow &&\s*\n?\s*activeModule !== null/.test(
      executable,
    ),
    "the overflow entry reports current only for a REAL module that is off the bar",
  );
});

// ── T5 · Destinations and actions stay separate owners ───────────────────────

test("B09 · the action overflow is a separate owner and keeps every action", () => {
  assert.ok(
    existsSync(resolve(REPO_ROOT, KEBAB_TSX)),
    "AdminMobileKebabMenu survives B09: it is the ONLY carrier of theme, notifications, password, public site and logout on admin mobile",
  );

  const kebab = read(KEBAB_TSX);
  for (const action of [
    "Apariencia",
    "Notificaciones",
    "Cambiar contraseña",
    "Ver sitio público",
    "Cerrar sesión",
  ]) {
    assert.ok(kebab.includes(action), `${action} must survive B09`);
  }

  // It stays out of the navigation barrel because its closure reaches the data
  // layer; merging it into the navigation owner would break the boundary.
  assert.equal(
    stripComments(read(NAVIGATION_BARREL)).includes("AdminMobileKebabMenu"),
    false,
    "the action overflow must not enter presentation/navigation",
  );
  assert.equal(
    stripComments(read(MOBILE_NAV_TSX)).includes("AdminMobileKebabMenu"),
    false,
    "the navigation owner must not compose the action overflow",
  );

  // The kebab is injected through the app bar's overflow slot, as B06 designed.
  assert.ok(
    stripComments(read(TOPBAR_TSX)).includes(
      "overflow={isAdmin ? <AdminMobileKebabMenu /> : null}",
    ),
    "the action overflow is injected as an app-bar slot, not mounted ad hoc",
  );
});

// ── T6 · CSS: one grammar, one block ─────────────────────────────────────────

test("B09 · the mobile navigation grammar is authored once, in navigation.css", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  // Unlayered, like the B07 and B08 blocks: a layered rule would lose the
  // cascade against the Tailwind utilities the component composes.
  assert.equal(
    stripCssComments(block).includes("@layer"),
    false,
    "the B09 block must stay unlayered",
  );

  // Real flow item, never an overlay: this is what keeps `main` shorter than
  // the viewport instead of letting the bar cover its last row.
  assert.match(
    block,
    /\.dashboard-mobile-nav \{[^}]*position:\s*relative/,
    "the bar is a flow sibling of main",
  );
  assert.equal(
    /\.dashboard-mobile-nav \{[^}]*position:\s*fixed/.test(block),
    false,
    "a fixed bar would leave main at full height and cover content",
  );
  assert.match(
    block,
    /\.dashboard-mobile-nav \{[^}]*flex:\s*0 0 auto/,
    "the shell must be able to subtract the band",
  );

  // Safe area: added to the band, subtracted as padding, so the touch row keeps
  // its full height on a notched device.
  assert.match(
    block,
    /height:\s*calc\(var\(--dash-mobile-nav-h\) \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(block, /padding-bottom:\s*env\(safe-area-inset-bottom\)/);

  // No size animation (R11/A03): a transitioned size feeds the ResizeObserver
  // behind the adaptive capacity engine.
  assert.equal(
    /transition[^;]*(width|height|inline-size|block-size|flex-basis)/.test(
      stripCssComments(block),
    ),
    false,
    "the B09 block must not transition a structural size",
  );

  // Roles differ by ONE custom property, never by a forked rule.
  assert.equal(
    [...block.matchAll(/--dash-mobile-nav-label-size:/g)].length,
    2,
    "exactly one parameterised property, bound once per surface",
  );

  // The retired per-role blocks are gone from the mobile stylesheets.
  for (const path of [MOBILE_ADMIN_CSS, MOBILE_CLINIC_CSS]) {
    assert.equal(
      stripCssComments(read(path)).includes("bottom-nav"),
      false,
      `${path} must not keep a bottom-nav grammar of its own`,
    );
  }
});

test("B09 · geometry and the touch floor live in tokens.css", () => {
  const tokens = sliceBlock(read(TOKENS_CSS), TOKEN_BLOCK_START, TOKEN_BLOCK_END);

  assert.match(tokens, /--dash-mobile-nav-h:\s*clamp\(/);
  assert.match(tokens, /--dash-mobile-nav-touch-min:\s*44px/);

  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  // B09_TOUCH_POLICY = OPTION_A. The floor is AUTHORED on every control the
  // model owns, not merely a consequence of dividing the band by five or six
  // stretched items — which is how the retired bars happened to clear it.
  for (const owned of [
    ".dashboard-mobile-nav-item",
    ".dashboard-mobile-nav-overflow-link",
    ".dashboard-mobile-nav-page-button",
    ".dashboard-mobile-nav-icon-button",
  ]) {
    const rule = block.slice(block.indexOf(`${owned} {`));
    assert.ok(
      block.includes(`${owned} {`),
      `${owned} must have a rule in the B09 block`,
    );
    assert.match(
      rule.slice(0, rule.indexOf("}")),
      /--dash-mobile-nav-touch-min/,
      `${owned} must declare the B09 touch floor`,
    );
  }

  // The kebab surfaces take the same floor from the same token.
  const kebabCss = read(MOBILE_ADMIN_CSS);
  assert.match(
    kebabCss,
    /\.admin-mobile-kebab-trigger \{[^}]*inline-size:\s*var\(--dash-mobile-nav-touch-min\)/,
    "the kebab trigger takes the B09 floor (it was 36px)",
  );
  assert.match(
    kebabCss,
    /\.admin-mobile-kebab-action \{[\s\S]{0,400}?min-block-size:\s*var\(--dash-mobile-nav-touch-min\)/,
    "the kebab rows/actions take the B09 floor (they were 40px)",
  );
});

test("B09 · admin mobile app bar is 48px so the trigger seats with margin", () => {
  const css = read(MOBILE_ADMIN_CSS);

  // B09_ADMIN_MOBILE_APPBAR_H = 48px. The clamp resolved to its 44px floor on
  // every phone in the matrix, and a 44x44 trigger exactly filled it.
  assert.match(
    css,
    /--admin-mobile-appbar-h:\s*3rem;/,
    "the admin mobile app bar band is 48px",
  );
  assert.equal(
    css.includes("--admin-mobile-appbar-h: clamp(2.75rem"),
    false,
    "the 44px clamp is retired",
  );
});

// ── T7 · Regime boundary: exactly one model per width ────────────────────────

test("B09 · the mobile model owns <768px and nothing else", () => {
  const css = read(NAVIGATION_CSS);

  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*\.dashboard-mobile-nav \{/,
    "the bar is authored inside the mobile regime",
  );
  assert.match(
    css,
    /@media \(min-width: 768px\)[^@]*\.dashboard-mobile-nav[^{]*\{[^}]*display:\s*none/,
    "the bar must not paint from 768px up, where the B07/B08 lateral band owns navigation",
  );

  // And the mirror, still owned by the B07 block: both primitives default to
  // `display: none` and are REVEALED by min-width queries, so below 768px
  // neither paints and the two models can never overlap.
  const b07 = sliceBlock(
    css,
    "/* dashboard-b07-navigation-drawer-rail:start",
    "/* dashboard-b07-navigation-drawer-rail:end */",
  );
  assert.match(
    b07,
    /\.dashboard-navigation-drawer,[\s\S]{0,80}?\.dashboard-navigation-rail \{[^}]*display:\s*none/,
    "both lateral primitives default to display:none",
  );
  assert.match(
    b07,
    /@media \(min-width: 768px\) and \(max-width: 1279\.98px\)[^@]*\.dashboard-navigation-rail \{\s*display:\s*flex/,
    "the compact rail is revealed only from 768px",
  );
  assert.match(
    b07,
    /@media \(min-width: 1280px\)[^@]*\.dashboard-navigation-drawer \{\s*display:\s*flex/,
    "the drawer is revealed only from 1280px",
  );
});

// ── T8 · Scope fences: B10 and B13 ───────────────────────────────────────────

test("B09 · the clinic full-route topology B10 owns is intact", () => {
  const fullRoutes = [
    "frontend/src/app/dashboard/informes/page.tsx",
    "frontend/src/app/dashboard/logistica/page.tsx",
    "frontend/src/app/dashboard/logistica/metricas/page.tsx",
    "frontend/src/app/dashboard/logistica/rutas/page.tsx",
    "frontend/src/app/dashboard/logistica/visitas/page.tsx",
  ];
  assert.equal(fullRoutes.length, 5, "five clinic full routes stay B10's");

  for (const path of fullRoutes) {
    const source = stripComments(read(path));
    // B10 gave the six clinic routes ONE shell owner, so the topbar is no
    // longer declared here. What B09 actually fenced off is untouched: these
    // are real routes and must not become `?module=` state of the clinic
    // controller.
    assert.ok(
      source.includes("<ClinicDashboardShell"),
      `${path} reaches its chrome through the shared clinic shell (B10)`,
    );
    assert.equal(
      source.includes("ClinicDashboardWorkspaceController"),
      false,
      `${path} must not be converted to the module controller: it is a real route, not a ?module= state`,
    );
    // B09 changed nothing about these routes: the bar reaches them because it
    // is mounted at shell level, which is where it already was.
    assert.equal(
      source.includes("DashboardMobileNav"),
      false,
      `${path} must not mount the mobile bar itself: the shell router does`,
    );
  }
});

test("B09 · the admin hub B13 owns is intact", () => {
  const hub = "frontend/src/components/dashboard/DashboardModuleHub.tsx";
  const launcher =
    "frontend/src/components/dashboard/AdminMobileHubLauncher.tsx";

  for (const path of [hub, launcher]) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must survive B09: degrading the hub to "Inicio" is B13`,
    );
  }

  // A null admin module is still the hub, and the bar reports it on "Inicio"
  // rather than inventing a default module — which would be B13's call.
  const executable = stripComments(read(MOBILE_NAV_TSX));
  assert.ok(
    executable.includes('data-dashboard-mobile-nav-item="home"'),
    "the hub/home entry is a real destination, not a defaulted module",
  );
  assert.ok(
    executable.includes("requestAdminHubReset"),
    "the synchronous hub-reset signal survives: the controller paints from state ahead of the URL",
  );
});

// ── T9 · Behaviour the retired components carried ────────────────────────────

test("B09 · every preserved behaviour has a carrier in the new owner", () => {
  const executable = stripComments(read(MOBILE_NAV_TSX));

  for (const behaviour of [
    "requestAdminModuleActivate",
    "requestClinicModuleActivate",
    "requestAdminHubReset",
    "requestClinicHubReset",
    "subscribeClinicModuleActivate",
    "subscribeClinicHubReset",
    "writeDashboardLastModule",
    "ADMIN_LAST_MODULE_STORAGE_KEY",
    "CLINIC_LAST_MODULE_STORAGE_KEY",
    "aria-current",
    "aria-expanded",
    "aria-controls",
    "Escape",
  ]) {
    assert.ok(
      executable.includes(behaviour),
      `${behaviour} was carried by a retired component and must survive in the owner`,
    );
  }

  // B09_CLINIC_HOME_ITEM = PRESERVE. Clinic keeps Inicio next to its five
  // modules, so it renders six primary slots and never an overflow.
  assert.match(
    executable,
    /if \(surface !== "admin"\) \{\s*return all;/,
    "clinic promotes every module to the bar: six slots, no overflow",
  );

  // The rail's prev/next MODULE pager is NOT reproduced: it was a second
  // grammar over the same ordered modules, and B07 already declined to carry it
  // forward. The destination overflow still paginates — that is a different
  // thing (pages of a list, not steps through the modules) and the retired
  // module menu did it too.
  for (const railAffordance of [
    "data-dashboard-module-rail-prev",
    "data-dashboard-module-rail-next",
    "data-dashboard-pager",
    "scrollIntoView",
    "Módulo anterior",
    "Módulo siguiente",
  ]) {
    assert.equal(
      executable.includes(railAffordance),
      false,
      `${railAffordance} was a rail affordance, not a destination; it must not be recreated`,
    );
  }
  assert.ok(
    executable.includes('aria-label="Página siguiente de módulos"'),
    "the destination overflow keeps the pagination the retired module menu shipped",
  );
});
