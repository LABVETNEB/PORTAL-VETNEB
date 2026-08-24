import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// B08 · Navigation migration static contract.
//
// B08 MOUNTS the B07 primitives on every surface that depends on the
// desktop/tablet navigation, and retires the legacy navigation from that
// regime. Its two retirements are NOT symmetric, and this file is the place
// that keeps them apart:
//
//   LEGACY_HORIZONTAL_NAV_PHYSICAL_RETIREMENT = REQUIRED
//     `DashboardHorizontalNav` is a pure >=768px surface (`md:block`, plus
//     `display:none !important` under max-width:767px in mobile-admin.css and
//     mobile-clinic.css). Nothing below 768px ever rendered it, so deleting the
//     file changes no mobile behaviour.
//
//   LEGACY_MODULE_RAIL_DESKTOP_RETIREMENT   = REQUIRED
//   LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT  = CLOSED_BY_B09
//     `DashboardModuleRail` was NOT a desktop-only surface. On `/dashboard`,
//     `ClinicMobileBottomNav` returned null, so the rail WAS the clinic module
//     navigation below 768px, and deleting it in B08 would have left that
//     surface with no navigation on phones. B08 therefore removed it from the
//     >=768px regime only and deferred the deletion.
//
//     B09 shipped `DashboardMobileNav`, removed that early return and deleted
//     the rail. What this file still owns is the DESKTOP half: from 768px up
//     exactly one lateral model paints. The mobile half moved to
//     `dashboard-b09-mobile-navigation-unification.test.ts`, which is where the
//     rail's absence is now asserted — this contract only records that B08's
//     deferral is closed and must not re-assert the component's survival.
//
// Written fail-closed: every census asserts its own cardinality before
// iterating, so a renamed path or an empty scan fails instead of passing
// vacuously.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const FRAME_TSX = "frontend/src/components/dashboard/DashboardNavigationFrame.tsx";
const DRAWER_TSX = "frontend/src/components/dashboard/NavigationDrawer.tsx";
const RAIL_TSX = "frontend/src/components/dashboard/NavigationRail.tsx";
const TOPBAR_TSX = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const CLINIC_CONTROLLER_TSX =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
/** Retired by B09 together with the two per-role bottom navs it outlived. */
const MODULE_RAIL_TSX = "frontend/src/components/dashboard/DashboardModuleRail.tsx";
const MOBILE_NAV_TSX = "frontend/src/components/dashboard/DashboardMobileNav.tsx";
const HORIZONTAL_NAV_TSX =
  "frontend/src/components/dashboard/DashboardHorizontalNav.tsx";
const NAVIGATION_BARREL =
  "frontend/src/features/dashboard/presentation/navigation/index.ts";
const MODULE_CATALOG =
  "frontend/src/features/dashboard/config/dashboardModules.ts";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";
const FRONTEND_SRC = "frontend/src";

const CSS_BLOCK_START = "/* dashboard-b08-navigation-migration:start */";
const CSS_BLOCK_END = "/* dashboard-b08-navigation-migration:end */";

/**
 * Every surface that depended on the desktop/tablet navigation and therefore
 * must mount the B08 frame. Two roles, four topologies: the admin shell, the
 * clinic module shell, and the five clinic full routes B10 still owns.
 */
const MOUNT_SURFACES = [
  "frontend/src/app/dashboard/page.tsx",
  "frontend/src/app/dashboard/admin/page.tsx",
  "frontend/src/app/dashboard/informes/page.tsx",
  "frontend/src/app/dashboard/logistica/page.tsx",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  "frontend/src/app/dashboard/logistica/visitas/page.tsx",
];

/** The five clinic full routes B10 unifies; B08 must leave their topology. */
const B10_FENCE = MOUNT_SURFACES.slice(2);

/**
 * The mobile model B08 fenced off and B09 then unified. Four of the six files
 * B08 protected (`AdminMobileBottomNav`, `ClinicMobileBottomNav`,
 * `AdminMobileModuleMenu` and the rail) were replaced by `DashboardMobileNav`;
 * the kebab (ACTION overflow) and the two hub-launcher surfaces (B13's) stayed.
 * The fence is kept — narrowed to what actually still exists — because B08's
 * own postcondition is that IT did not touch this regime.
 */
const B09_FENCE = [
  MOBILE_NAV_TSX,
  "frontend/src/components/dashboard/AdminMobileKebabMenu.tsx",
  "frontend/src/components/dashboard/AdminMobileHubLauncher.tsx",
  "frontend/src/components/dashboard/AdminMobileHubPager.tsx",
];

const APP_BAR_TSX = "frontend/src/components/dashboard/WorkspaceAppBar.tsx";
const HUB_TSX = "frontend/src/components/dashboard/DashboardModuleHub.tsx";
const ADMIN_CONTROLLER_TSX =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";

/** Geometry the tokens own. No `.tsx` may restate any of them. */
const GEOMETRY_LITERALS = ["256", "80", "40", "56"];

/** Layers a presentation surface must never reach, directly or transitively. */
const FORBIDDEN_PRESENTATION_IMPORTS = ["@/lib/api", "@/app/", "@/app"] as const;

function read(relativePath: string): string {
  const absolute = resolve(REPO_ROOT, relativePath);
  assert.ok(existsSync(absolute), `source not found: ${relativePath}`);
  return readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
}

/**
 * Executable projection. Every "must NOT contain" assertion runs against this:
 * the B08 surfaces deliberately DOCUMENT the constructs they are forbidden to
 * use (`next/link`, `window.location`, the retired component names), and
 * failing on that prose would push the contract towards undocumented code.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function sliceBlock(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from !== -1, `missing block start ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing block end ${end}`);
  return source.slice(from, to + end.length);
}

function listSourceFiles(relativeDir: string): string[] {
  const rootDir = resolve(REPO_ROOT, relativeDir);
  const found: string[] = [];

  const walk = (absoluteDir: string) => {
    for (const entry of readdirSync(absoluteDir)) {
      const absolute = join(absoluteDir, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) {
        found.push(absolute.replace(/\\/g, "/"));
      }
    }
  };

  walk(rootDir);
  return found;
}

/** First-order relative/aliased imports of a frontend source file. */
function importTargets(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}

// ── T0 · Baseline census: the contract knows what it is policing ─────────────

test("B08 · path baseline is complete before anything is asserted", () => {
  assert.equal(MOUNT_SURFACES.length, 7, "seven surfaces depended on the desktop nav");
  assert.equal(B10_FENCE.length, 5, "five clinic full routes stay B10's");
  assert.equal(B09_FENCE.length, 4, "four mobile surfaces are B09's");

  for (const path of [
    FRAME_TSX,
    DRAWER_TSX,
    RAIL_TSX,
    TOPBAR_TSX,
    CLINIC_CONTROLLER_TSX,
    NAVIGATION_BARREL,
    MODULE_CATALOG,
    NAVIGATION_CSS,
    APP_BAR_TSX,
    HUB_TSX,
    ADMIN_CONTROLLER_TSX,
    ...MOUNT_SURFACES,
    ...B09_FENCE,
  ]) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must exist for the B08 contract to mean anything`,
    );
  }
});

// ── T1 · LEGACY_HORIZONTAL_NAV_PHYSICAL_RETIREMENT = REQUIRED ────────────────

test("B08 · DashboardHorizontalNav is physically retired", () => {
  assert.equal(
    existsSync(resolve(REPO_ROOT, HORIZONTAL_NAV_TSX)),
    false,
    `${HORIZONTAL_NAV_TSX} must be deleted by B08: it is a pure >=768px surface (md:block plus display:none under max-width:767px), so the lateral model fully replaces it and nothing below 768px loses navigation`,
  );
});

test("B08 · no runtime source references the retired horizontal nav", () => {
  const files = listSourceFiles(FRONTEND_SRC);
  assert.ok(files.length > 100, "the frontend source scan must not be empty");

  const offenders = files.filter((absolute) =>
    /DashboardHorizontalNav|DashboardNavSurface/.test(
      stripComments(readFileSync(absolute, "utf8")),
    ),
  );

  assert.deepEqual(
    offenders.map((path) => path.slice(path.indexOf("frontend/src"))),
    [],
    "the horizontal nav is retired: no executable reference may survive",
  );
});

test("B08 · the barrel stops exporting the horizontal nav and keeps the primitives", () => {
  const barrel = read(NAVIGATION_BARREL);

  assert.equal(
    stripComments(barrel).includes("DashboardHorizontalNav"),
    false,
    "the B01 barrel must not re-export a retired component",
  );
  assert.equal(
    stripComments(barrel).includes("DashboardNavSurface"),
    false,
    "the horizontal nav's surface type is retired with it",
  );

  for (const expected of [
    'from "@/components/dashboard/NavigationDrawer";',
    'from "@/components/dashboard/NavigationRail";',
    'from "@/components/dashboard/DashboardNavigationFrame";',
  ]) {
    assert.ok(barrel.includes(expected), `the barrel must export ${expected}`);
  }

  // B09 fence: the mobile surfaces the barrel carries stay carried. B09
  // collapsed the two bottom navs and the module menu into one owner; the hub
  // launcher and its pager are B13's and were untouched by both blocks.
  for (const mobileExport of [
    "DashboardMobileNav",
    "AdminMobileHubLauncher",
    "AdminMobileHubPager",
  ]) {
    assert.ok(
      barrel.includes(mobileExport),
      `${mobileExport} is B09's; B08 must not drop it from the barrel`,
    );
  }
});

// ── T2 · LEGACY_MODULE_RAIL: B08 deferred the deletion, B09 closed it ────────

test("B08 · LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT is closed by B09", () => {
  assert.equal(
    existsSync(resolve(REPO_ROOT, MODULE_RAIL_TSX)),
    false,
    `${MODULE_RAIL_TSX} is retired. B08 deferred the deletion because ClinicMobileBottomNav returned null on /dashboard, which made the rail that surface's only navigation below 768px; B09 removed the early return, shipped DashboardMobileNav and deleted the component. Restoring it would put two module navigations back on the same surface`,
  );

  const controller = stripComments(read(CLINIC_CONTROLLER_TSX));
  assert.equal(
    controller.includes("DashboardModuleRail"),
    false,
    "the clinic controller must not render module navigation inside the stage: below 768px DashboardMobileNav owns it at shell level, above 768px the lateral band does",
  );
  assert.equal(
    stripComments(read(NAVIGATION_BARREL)).includes("DashboardModuleRail"),
    false,
    "the barrel must not re-export a retired component",
  );
});

test("B08 · LEGACY_MODULE_RAIL_DESKTOP_RETIREMENT survives as a >=768px invariant", () => {
  // B08 achieved the desktop retirement with `display: none` on the rail from
  // 768px up. B09 deleted the rail, so that rule went with it and the invariant
  // is now carried by the ONE thing that can still break it: no source may
  // reintroduce the selector, and the B09 block owns the mirror-image rule that
  // keeps the MOBILE model out of the >=768px regime.
  const css = read(NAVIGATION_CSS);

  assert.equal(
    css.includes(".dashboard-module-rail {"),
    false,
    "the retired rail must not keep a rule in the navigation stylesheet",
  );

  assert.match(
    css,
    /@media \(min-width: 768px\)[^@]*\.dashboard-mobile-nav[^{]*\{[^}]*display:\s*none/,
    "from 768px up exactly one navigation model may paint: the mobile bar must resolve to display:none there, leaving the B07 rail or drawer",
  );
});

// ── T3 · The topbar drops the nav and keeps everything else ──────────────────

test("B08 · DashboardTopbar drops the horizontal nav and preserves its chrome", () => {
  const topbar = read(TOPBAR_TSX);
  const executable = stripComments(topbar);

  assert.equal(
    executable.includes("DashboardHorizontalNav"),
    false,
    "the topbar must neither import nor render the retired nav",
  );

  for (const preserved of [
    "handleLogout",
    "logoutAdmin",
    "ThemeModeToggle",
    "DashboardTopbarNotifications",
    "AdminMobileKebabMenu",
    "AdminMobileContextTitle",
    "<WorkspaceAppBar",
  ]) {
    assert.ok(
      executable.includes(preserved),
      `${preserved} is outside B08's scope and must survive untouched`,
    );
  }

  // B08 pinned `ADMIN_MOBILE_TITLES` here — a private ten-entry label table —
  // precisely because the mobile context title was B09's to own. B09 owns it
  // now: the table is gone and the title is DERIVED from the canonical catalog,
  // so what B08 still guards is that the title survived at all and that no
  // fourth private copy of the admin labels came back with it.
  assert.equal(
    executable.includes("ADMIN_MOBILE_TITLES"),
    false,
    "the private admin label table is retired: B09 derives the title from ADMIN_MODULE_NAV_LABELS",
  );
  assert.ok(
    executable.includes("ADMIN_MODULE_NAV_LABELS") &&
      executable.includes("parseAdminModule"),
    "the mobile context title must read the canonical catalog through the canonical parser",
  );
});

// ── T4 · The B08 frame: one mount, both primitives, presentation-pure ────────

test("B08 · the navigation frame mounts exactly one lateral model per regime", () => {
  const frame = stripComments(read(FRAME_TSX));

  assert.ok(frame.includes("<NavigationDrawer"), "the frame mounts the drawer");
  assert.ok(frame.includes("<NavigationRail"), "the frame mounts the rail");
  assert.equal(
    [...frame.matchAll(/<NavigationDrawer[\s/>]/g)].length,
    1,
    "exactly one drawer mount site",
  );
  assert.equal(
    [...frame.matchAll(/<NavigationRail[\s/>]/g)].length,
    1,
    "exactly one rail mount site",
  );
  assert.equal(
    frame.includes("DashboardModuleRail"),
    false,
    "the frame must not resurrect the legacy rail",
  );
  assert.equal(
    /ChevronLeft|ChevronRight|M[oó]dulo \{/.test(frame),
    false,
    "the prev/next pager of DashboardModuleRail must not be reproduced",
  );
});

test("B08 · exactly one surface in frontend/src mounts the primitives", () => {
  const files = listSourceFiles(FRONTEND_SRC);
  const mounts = files.filter((absolute) =>
    /<NavigationDrawer[\s/>]|<NavigationRail[\s/>]/.test(
      stripComments(readFileSync(absolute, "utf8")),
    ),
  );

  assert.deepEqual(
    mounts.map((path) => path.slice(path.indexOf("frontend/src"))),
    [FRAME_TSX],
    "a second mount site would ship a duplicate desktop/tablet navigation model",
  );
});

test("B08 · the frame stays presentation-pure", () => {
  const frame = read(FRAME_TSX);

  for (const forbidden of FORBIDDEN_PRESENTATION_IMPORTS) {
    assert.equal(
      importTargets(stripComments(frame)).some((target) =>
        target.startsWith(forbidden),
      ),
      false,
      `the frame must not import ${forbidden}: it lives behind the B01 boundary`,
    );
  }

  assert.equal(
    /from "next\/link"|<a[\s>]|window\.location|location\.href/.test(
      stripComments(frame),
    ),
    false,
    "navigation uses the route-control pattern; next/link, <a> and window.location are forbidden",
  );
});

// ── T5 · The frame owns no catalog and no geometry ───────────────────────────

test("B08 · no consumer declares a private catalog of module ids or labels", () => {
  const catalog = read(MODULE_CATALOG);
  const adminIds = [
    ...sliceIds(catalog, "ADMIN_MODULE_IDS"),
  ];
  const clinicIds = [...sliceIds(catalog, "CLINIC_MODULE_IDS")];

  assert.equal(adminIds.length, 10, "the admin catalog must still hold 10 ids");
  assert.equal(clinicIds.length, 5, "the clinic catalog must still hold 5 ids");

  // The surface discriminant is not a module catalog: `"admin"` is both a role
  // and a module id, so the discriminant occurrences are neutralised BEFORE the
  // scan. Any other occurrence of the literal still fails.
  const frame = stripComments(read(FRAME_TSX)).replace(
    /surface(:\s*|\s*===?\s*|=)"(admin|clinic)"/g,
    "surface<discriminant>",
  );

  for (const moduleId of [...adminIds, ...clinicIds]) {
    assert.equal(
      frame.includes(`"${moduleId}"`),
      false,
      `the frame restates the module id "${moduleId}"; ids, order and labels stay owned by dashboardModules.ts`,
    );
  }

  assert.equal(
    /ADMIN_MODULE_NAV_LABELS|CLINIC_MODULE_NAV_LABELS/.test(frame),
    false,
    "the frame renders the primitives; the label tables are the primitives' input, not the frame's",
  );
});

test("B08 · the canonical config still owns ids and order", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const source = stripComments(read(path));
    assert.ok(
      source.includes('from "@/features/dashboard/config"'),
      `${path} must read ids/labels/order from the catalog`,
    );
    assert.ok(
      source.includes("buildDashboardModuleHref"),
      `${path} must build every href through the application layer`,
    );
  }

  assert.ok(
    stripComments(read(DRAWER_TSX)).includes("requestClinicModuleActivate"),
    "clinic keeps its optimistic activation signal",
  );
  assert.ok(
    stripComments(read(RAIL_TSX)).includes("requestClinicModuleActivate"),
    "clinic keeps its optimistic activation signal",
  );
});

test("B08 · no .tsx restates the geometry the tokens own", () => {
  for (const path of [FRAME_TSX, DRAWER_TSX, RAIL_TSX]) {
    const source = stripComments(read(path));
    for (const literal of GEOMETRY_LITERALS) {
      assert.equal(
        new RegExp(`\\b${literal}(px|rem)?\\b`).test(source),
        false,
        `${path} restates the geometry literal ${literal}; 256/80/40/56 live in tokens.css`,
      );
    }
  }
});

// ── T6 · Admin hub: a null active module is legal, aria-current is not faked ─

test("B08 · the admin surface supports a null active module", () => {
  const drawer = read(DRAWER_TSX);
  const rail = read(RAIL_TSX);

  for (const [path, source] of [
    [DRAWER_TSX, drawer],
    [RAIL_TSX, rail],
  ] as const) {
    assert.match(
      source,
      /surface:\s*"admin";\s*readonly activeModule:\s*AdminModule \| null/,
      `${path} must accept a null admin module: /dashboard/admin without ?module= is the hub, and inventing an active item there would be B13`,
    );
    assert.match(
      source,
      /surface:\s*"clinic";\s*readonly activeModule:\s*ClinicModule/,
      `${path} must keep the clinic module non-null: the clinic surface always resolves to a module`,
    );
    assert.ok(
      source.includes('aria-current={isActive ? "page" : undefined}'),
      `${path} must mark only the active module`,
    );
  }

  const frame = stripComments(read(FRAME_TSX));
  assert.ok(
    frame.includes("parseAdminModule"),
    "the frame resolves the admin module through the catalog parser, which yields null on the hub",
  );
  assert.equal(
    /activeModule=\{[^}]*\?\?\s*"admin"/.test(frame),
    false,
    "the frame must not substitute a default admin module for the hub state",
  );
});

test("B08 · the B13 hub survives", () => {
  assert.ok(existsSync(resolve(REPO_ROOT, HUB_TSX)), "DashboardModuleHub is B13's");
  assert.ok(
    stripComments(read(ADMIN_CONTROLLER_TSX)).includes("<DashboardModuleHub"),
    "the admin hub must still render: degrading it to an 'Inicio' item is B13",
  );
});

// ── T7 · Every surface that lost the horizontal nav mounts the frame ─────────

test("B08 · all seven surfaces mount the navigation frame around main", () => {
  for (const path of MOUNT_SURFACES) {
    const source = stripComments(read(path));

    assert.ok(
      source.includes("<DashboardNavigationFrame"),
      `${path} lost the horizontal nav and must mount the B08 frame`,
    );
    assert.ok(
      source.includes("</DashboardNavigationFrame>"),
      `${path} must wrap its main region, not self-close the frame`,
    );
    assert.match(
      source,
      /<DashboardNavigationFrame[\s\S]*?<main[\s\S]*?<\/main>[\s\S]*?<\/DashboardNavigationFrame>/,
      `${path}: main must live INSIDE the frame so the lateral navigation takes inline size, never vertical budget`,
    );
    assert.ok(
      source.includes("<DashboardTopbar"),
      `${path} keeps the B06 app bar above the frame, full width`,
    );
    assert.match(
      source,
      /<DashboardTopbar[\s\S]*?<DashboardNavigationFrame/,
      `${path}: the app bar stays ABOVE the lateral band`,
    );
  }
});

test("B08 · the active module mapping is declared per route, not guessed", () => {
  const clinicShell = stripComments(read("frontend/src/app/dashboard/page.tsx"));
  assert.match(
    clinicShell,
    /<DashboardNavigationFrame\s+surface="clinic"/,
    "/dashboard is the clinic module shell",
  );

  const admin = stripComments(read("frontend/src/app/dashboard/admin/page.tsx"));
  assert.match(
    admin,
    /<DashboardNavigationFrame\s+surface="admin"/,
    "/dashboard/admin is the admin shell; the frame reads ?module= itself",
  );

  const informes = stripComments(read("frontend/src/app/dashboard/informes/page.tsx"));
  assert.match(
    informes,
    /<DashboardNavigationFrame\s+surface="clinic"\s+module="informes"/,
    "/dashboard/informes presents Informes as the active module",
  );

  for (const path of B10_FENCE.slice(1)) {
    assert.match(
      stripComments(read(path)),
      /<DashboardNavigationFrame\s+surface="clinic"\s+module="logistica"/,
      `${path} presents Logística as the active module`,
    );
  }
});

// ── T8 · Scope fences: B09, B10, B06 ─────────────────────────────────────────

test("B08 · the mobile model B09 owns is intact", () => {
  for (const path of B09_FENCE) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must exist: the <768px model belongs to B09`,
    );
  }

  // The frame is the DESKTOP mount site and stays that way. Reaching into the
  // mobile model from here would put two owners on one regime again — the exact
  // defect B08 deferred and B09 closed.
  const frame = stripComments(read(FRAME_TSX));
  for (const mobileSurface of [
    "DashboardMobileNav",
    "AdminMobileKebabMenu",
    "AdminMobileHubLauncher",
    "AdminMobileHubPager",
  ]) {
    assert.equal(
      frame.includes(mobileSurface),
      false,
      `the B08 frame must not reach into ${mobileSurface}: B09 owns it`,
    );
  }
});

test("B08 · the clinic full-route topology B10 owns is intact", () => {
  for (const path of B10_FENCE) {
    const source = stripComments(read(path));
    assert.ok(
      source.includes("<DashboardTopbar"),
      `${path} keeps its own shell: folding it into the /dashboard controller is B10`,
    );
    assert.equal(
      source.includes("ClinicDashboardWorkspaceController"),
      false,
      `${path} must not be converted to the module controller: that is B10`,
    );
  }
});

test("B08 · the B06 workspace app bar is untouched", () => {
  assert.ok(existsSync(resolve(REPO_ROOT, APP_BAR_TSX)));
  assert.ok(
    stripComments(read(TOPBAR_TSX)).includes("<WorkspaceAppBar"),
    "the app bar stays the topbar's single band",
  );

  const tokens = read("frontend/src/styles/dashboard/tokens.css");
  assert.equal(
    [...tokens.matchAll(/--dash-app-bar-h:\s*[^;]+;/g)].length,
    1,
    "--dash-app-bar-h stays declared exactly once",
  );

  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);
  assert.equal(
    block.includes("--dash-app-bar"),
    false,
    "the B08 block must not restate the B06 app-bar geometry",
  );
});

// ── T9 · The B08 CSS block animates nothing structural ───────────────────────

test("B08 · the frame block never animates a structural size", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  for (const property of [
    "width",
    "inline-size",
    "height",
    "block-size",
    "flex-basis",
  ]) {
    assert.equal(
      new RegExp(`transition[^;]*:(?![^;]*none)[^;]*\\b${property}\\b`).test(block),
      false,
      `the B08 block animates ${property}; a size transition feeds the ResizeObserver behind the adaptive capacity engine (R11/A03)`,
    );
  }

  assert.equal(
    /position:\s*(fixed|absolute)/.test(block),
    false,
    "the lateral band participates in the real layout; simulating it with fixed/absolute would overlap main",
  );

  for (const orphan of ["--dash-sidebar-rail", "--dash-sidebar-expanded"]) {
    assert.equal(
      block.includes(orphan),
      false,
      `${orphan} is pre-audit sidebar debt (72/240px); B08 must not adopt it`,
    );
  }
});

/** Read a canonical id tuple out of the catalog source. */
function sliceIds(catalog: string, constName: string): string[] {
  const start = catalog.indexOf(`export const ${constName} = [`);
  assert.ok(start !== -1, `${constName} not found in the catalog`);
  const end = catalog.indexOf("] as const;", start);
  assert.ok(end > start, `${constName} is not a frozen tuple`);
  return [...catalog.slice(start, end).matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
}
