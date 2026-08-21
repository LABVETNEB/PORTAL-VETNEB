import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// B07 · NavigationDrawer (256px) + NavigationRail (80px) static contract.
//
// B07 CREATES the two lateral navigation primitives and their geometry ledger.
// It does NOT mount them: the shell keeps `DashboardHorizontalNav` and
// `DashboardModuleRail` until B08 migrates the consumers, and mobile (<768px)
// stays with B09. That boundary is deliberate — mounting a second navigation
// model next to the live one would produce double navigation, move `main`, and
// re-page the 15 adaptive consumers frozen by A03.
//
// Because nothing is mounted, there is no runtime surface to measure in B07:
// the 256/80 ±1px runtime assertion is B08's. This file is therefore the WHOLE
// executable contract for B07 and is written fail-closed — every census
// asserts its own cardinality before iterating, so an empty scan or a renamed
// path fails instead of passing vacuously.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const DRAWER_TSX = "frontend/src/components/dashboard/NavigationDrawer.tsx";
const RAIL_TSX = "frontend/src/components/dashboard/NavigationRail.tsx";
const ICONS_TS = "frontend/src/components/dashboard/dashboardModuleIcons.ts";
const NAVIGATION_BARREL =
  "frontend/src/features/dashboard/presentation/navigation/index.ts";
const MODULE_CATALOG =
  "frontend/src/features/dashboard/config/dashboardModules.ts";
const TOKENS_CSS = "frontend/src/styles/dashboard/tokens.css";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";
const RESPONSIVE_CSS = "frontend/src/styles/dashboard/responsive.css";
const FRONTEND_SRC = "frontend/src";

/**
 * Legacy navigation, after B08 resolved it. The two retirements are NOT
 * symmetric and this file no longer pretends they are:
 *
 *   `DashboardHorizontalNav` is GONE. It was a pure >=768px surface, so the
 *   lateral model replaced it outright with no mobile consequence.
 *
 *   `DashboardModuleRail` SURVIVES below 768px. `ClinicMobileBottomNav`
 *   returns null on `/dashboard`, so the rail is still the clinic module
 *   navigation there; B08 removed it from >=768px only and B09 owns the
 *   deletion.
 */
const RETIRED_BY_B08 =
  "frontend/src/components/dashboard/DashboardHorizontalNav.tsx";
const MOBILE_OWNED_UNTIL_B09 =
  "frontend/src/components/dashboard/DashboardModuleRail.tsx";

/** The single B08 mount site of the two primitives. */
const NAVIGATION_FRAME_TSX =
  "frontend/src/components/dashboard/DashboardNavigationFrame.tsx";

/** Mobile navigation B09 unifies; B07 must not touch it. */
const B09_FENCE = [
  "frontend/src/components/dashboard/AdminMobileBottomNav.tsx",
  "frontend/src/components/dashboard/ClinicMobileBottomNav.tsx",
  "frontend/src/components/dashboard/AdminMobileModuleMenu.tsx",
];

const APP_BAR_TSX = "frontend/src/components/dashboard/WorkspaceAppBar.tsx";

const DASHBOARD_CSS_FILES = [
  "index.css",
  "interactions.css",
  "layout.css",
  "mobile-admin.css",
  "mobile-clinic.css",
  "navigation.css",
  "responsive.css",
  "shell.css",
  "surfaces.css",
  "tables.css",
  "tokens.css",
  "zero-scroll.css",
].map((name) => `frontend/src/styles/dashboard/${name}`);

const TOKEN_BLOCK_START = "/* dashboard-b07-navigation-geometry:start";
const TOKEN_BLOCK_END = "dashboard-b07-navigation-geometry:end */";
const CSS_BLOCK_START = "/* dashboard-b07-navigation-drawer-rail:start */";
const CSS_BLOCK_END = "/* dashboard-b07-navigation-drawer-rail:end */";

/** The B07 geometry ledger: token name -> the literal it owns. */
const GEOMETRY_TOKENS: Readonly<Record<string, string>> = {
  "--dash-nav-drawer-w": "256px",
  "--dash-nav-rail-w": "80px",
  "--dash-nav-item-h": "40px",
  "--dash-nav-rail-item-h": "56px",
  "--dash-nav-rail-item-radius": "16px",
  "--dash-nav-band": "1px",
};

/**
 * Orphan sidebar tokens left in responsive.css by the pre-audit sidebar
 * (4.5rem = 72px, 15rem = 240px). B07 targets 80/256, so reusing them would
 * silently ship the OLD geometry. They are neither reused nor removed here.
 */
const LEGACY_SIDEBAR_TOKENS = [
  "--dash-sidebar-rail",
  "--dash-sidebar-expanded",
];

/** Layers the primitives must never reach, directly or transitively. */
const FORBIDDEN_PRESENTATION_IMPORTS = ["@/lib/api", "@/app/", "@/app"] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

/**
 * Executable projection. Every "must NOT contain" assertion runs against this:
 * the primitives deliberately DOCUMENT the constructs they are forbidden to
 * use (`?module=`, `next/link`, the legacy sidebar tokens), and failing on that
 * prose would push the contract towards undocumented code.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function sliceBlock(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from !== -1, `missing block start ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing block end ${end}`);
  return source.slice(from, to + end.length);
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let candidateBase: string;
  if (specifier.startsWith("@/")) {
    candidateBase = join(FRONTEND_SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    candidateBase = join(dirname(fromFile), specifier);
  } else {
    return null;
  }

  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = `${candidateBase}${suffix}`.split("\\").join("/");
    const absolute = resolve(REPO_ROOT, candidate);
    if (existsSync(absolute) && /\.(ts|tsx)$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function importSpecifiers(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
    found.push(match[1]);
  }
  for (const match of source.matchAll(/import\("([^"]+)"\)/g)) {
    found.push(match[1]);
  }
  return found;
}

/** Whole first-party import closure of a file, repo-relative. */
function importClosure(entry: string): {
  readonly files: ReadonlySet<string>;
  readonly rawSpecifiers: ReadonlyMap<string, readonly string[]>;
} {
  const files = new Set<string>();
  const rawSpecifiers = new Map<string, readonly string[]>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (files.has(current)) continue;
    files.add(current);

    const specifiers = importSpecifiers(read(current));
    rawSpecifiers.set(current, specifiers);

    for (const specifier of specifiers) {
      const resolved = resolveImport(current, specifier);
      if (resolved && !files.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return { files, rawSpecifiers };
}

/** Ids of a `const NAME = [...] as const;` array in the catalog source. */
function catalogIds(source: string, constantName: string): readonly string[] {
  const match = source.match(
    new RegExp(`export const ${constantName} = \\[([^\\]]*)\\] as const;`),
  );
  assert.ok(match, `${MODULE_CATALOG} must declare ${constantName}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

const CATALOG = read(MODULE_CATALOG);
const ADMIN_MODULE_IDS = catalogIds(CATALOG, "ADMIN_MODULE_IDS");
const CLINIC_MODULE_IDS = catalogIds(CATALOG, "CLINIC_MODULE_IDS");

// ── T1 · Existence, ownership and the client boundary ────────────────────────

test("B07 · the two primitives and the icon owner exist at their canonical paths", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX, ICONS_TS]) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must exist — B07 has no alternative location. The physical implementation lives in components/dashboard so the B01 barrel can keep re-exporting from @/components/dashboard/*`,
    );
    assert.equal(
      relative(REPO_ROOT, resolve(REPO_ROOT, path)).split("\\").join("/"),
      path,
      "contract paths are repo-relative and canonical",
    );
  }

  assert.equal(
    existsSync(
      resolve(
        REPO_ROOT,
        "frontend/src/features/dashboard/presentation/navigation/NavigationDrawer.tsx",
      ),
    ),
    false,
    "presentation/navigation is a re-export boundary, never a physical owner (B01)",
  );
});

test("B07 · both primitives are client components exporting their declared contract", () => {
  const drawer = read(DRAWER_TSX);
  assert.ok(drawer.startsWith('"use client";'), "the drawer is a client component");
  assert.ok(drawer.includes("export function NavigationDrawer({"));
  assert.ok(drawer.includes("export type NavigationDrawerProps ="));

  const rail = read(RAIL_TSX);
  assert.ok(rail.startsWith('"use client";'), "the rail is a client component");
  assert.ok(rail.includes("export function NavigationRail({"));
  assert.ok(rail.includes("export type NavigationRailProps ="));
});

test("B07 · both primitives carry the data contract markers a runtime spec can measure", () => {
  const drawer = read(DRAWER_TSX);
  assert.ok(drawer.includes("data-dashboard-navigation-drawer={surface}"));
  assert.ok(drawer.includes("data-dashboard-navigation-item={item.moduleId}"));

  const rail = read(RAIL_TSX);
  assert.ok(rail.includes("data-dashboard-navigation-rail={surface}"));
  assert.ok(rail.includes("data-dashboard-navigation-item={item.moduleId}"));

  // A04 / security:public-surface — a data-* NAME may not carry a sensitive
  // stem. `tokens` is a legitimate module id and travels as a VALUE.
  for (const source of [drawer, rail]) {
    for (const match of source.matchAll(/\bdata-([a-z0-9-]+)=/g)) {
      assert.equal(
        /(token|secret|password|session|cookie|jwt|email|private)/.test(match[1]),
        false,
        `data-${match[1]} carries a sensitive stem in its NAME`,
      );
    }
  }
});

// ── T2 · The B01 barrel re-exports, it never owns ────────────────────────────

test("B07 · presentation/navigation re-exports both primitives from components/dashboard", () => {
  const barrel = read(NAVIGATION_BARREL);

  assert.ok(
    barrel.includes(
      'export {\n  NavigationDrawer,\n  type NavigationDrawerProps,\n} from "@/components/dashboard/NavigationDrawer";',
    ),
    "the navigation barrel must re-export NavigationDrawer from components/dashboard",
  );
  assert.ok(
    barrel.includes(
      'export {\n  NavigationRail,\n  type NavigationRailProps,\n} from "@/components/dashboard/NavigationRail";',
    ),
    "the navigation barrel must re-export NavigationRail from components/dashboard",
  );

  // The icon owner is an implementation detail of presentation, not a
  // navigation surface: exposing it through the barrel would invite consumers
  // to build their own nav from the icon map.
  assert.equal(
    barrel.includes("dashboardModuleIcons"),
    false,
    "the icon owner is not a navigation surface and stays out of the barrel",
  );
});

// ── T3 · Presentation purity, over the real import closure ───────────────────

test("B07 · neither primitive reaches the data layer or the app layer at any depth", () => {
  for (const entry of [DRAWER_TSX, RAIL_TSX]) {
    const { files, rawSpecifiers } = importClosure(entry);

    assert.ok(files.has(entry), "the closure must contain its own entry point");
    assert.ok(
      files.size > 1,
      `${entry}: the closure resolved to a single file; a primitive that imports nothing first-party would pass this contract vacuously`,
    );

    const violations: string[] = [];
    for (const [file, specifiers] of rawSpecifiers) {
      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN_PRESENTATION_IMPORTS) {
          if (specifier === forbidden || specifier.startsWith(`${forbidden}/`)) {
            violations.push(`${file} imports ${specifier}`);
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `${entry} must stay presentation-pure so B01 can re-export it`,
    );

    for (const file of files) {
      assert.ok(
        file.startsWith(FRONTEND_SRC),
        `${file} escaped the frontend source tree while walking the ${entry} closure`,
      );
    }
  }
});

// ── T4 · The catalog owns ids, labels and order ──────────────────────────────

test("B07 · both primitives derive their items from the canonical label tables", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const source = read(path);
    assert.ok(source.includes("ADMIN_MODULE_NAV_LABELS"), `${path}: admin labels`);
    assert.ok(source.includes("CLINIC_MODULE_NAV_LABELS"), `${path}: clinic labels`);
    assert.ok(source.includes('from "@/features/dashboard/config"'));
  }
});

test("B07 · no primitive re-declares a module id, label or order", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    // The `surface` discriminant is "admin" | "clinic", and "admin" is also a
    // real module id. Those three forms are the discriminant, not a restated
    // id, so they are removed before the census — every other occurrence of
    // any module id still fails.
    const executable = stripComments(read(path))
      .replace(/\bsurface:\s*"(admin|clinic)"/g, "surface: <discriminant>")
      .replace(/\bsurface\s*===\s*"(admin|clinic)"/g, "surface === <discriminant>");

    for (const moduleId of [...ADMIN_MODULE_IDS, ...CLINIC_MODULE_IDS]) {
      assert.equal(
        executable.includes(`"${moduleId}"`),
        false,
        `${path} restates the module id "${moduleId}"; the catalog owns the id list, its order and its labels`,
      );
    }

    // A local label table would be the H1 duplication the catalog exists to
    // prevent, whatever it is called.
    assert.equal(
      /(label|shortLabel)\s*:\s*"/.test(executable),
      false,
      `${path} declares a literal label; labels come from the catalog`,
    );
  }
});

// ── T5 · Deep links go through the application grammar ───────────────────────

test("B07 · every href is built with buildDashboardModuleHref", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const source = read(path);
    const executable = stripComments(source);

    assert.ok(source.includes("buildDashboardModuleHref"));
    assert.ok(source.includes('from "@/features/dashboard/application"'));
    assert.ok(
      source.includes("buildDashboardModuleHref(basePath, item.moduleId)"),
      `${path}: the href must be derived, not assembled`,
    );

    assert.equal(
      executable.includes("?module="),
      false,
      `${path} assembles the query grammar by hand; MODULE_QUERY_PARAM is single-owned by the application layer`,
    );
    assert.ok(
      source.includes("ROUTES.dashboardAdmin") && source.includes("ROUTES.dashboard"),
      `${path}: base paths come from the route table`,
    );
  }
});

// ── T6 · Sanctioned navigation only ──────────────────────────────────────────

test("B07 · navigation uses PublicRouteControl, never a link or a location write", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const source = read(path);
    const executable = stripComments(source);

    assert.ok(
      source.includes(
        'import { PublicRouteControl } from "@/components/public/PublicRouteControl";',
      ),
      `${path}: navigation must use the sanctioned route control`,
    );
    assert.ok(source.includes("<PublicRouteControl"));

    for (const forbidden of [
      'from "next/link"',
      "window.location",
      "location.href",
      "location.assign",
    ]) {
      assert.equal(
        executable.includes(forbidden),
        false,
        `${path} must not navigate with ${forbidden} (AGENTS.md §10, test/unit/ui)`,
      );
    }
    assert.equal(
      /<a[\s>]/.test(executable),
      false,
      `${path} must not use an anchor element to navigate`,
    );
  }
});

// ── T7 · Clinic optimistic activation is preserved ───────────────────────────

test("B07 · clinic navigation keeps the optimistic activation signal", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const source = read(path);
    assert.ok(
      source.includes(
        'import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";',
      ),
      `${path}: the clinic controller swaps on this signal before the URL commit lands`,
    );
    assert.ok(
      source.includes("requestClinicModuleActivate(item.moduleId)"),
      `${path}: the signal must fire on the clinic item click`,
    );
  }
});

// ── T8 · One owner for the 15 module icons ───────────────────────────────────

test("B07 · the icon owner covers the canonical 10 admin + 5 clinic modules", () => {
  assert.equal(ADMIN_MODULE_IDS.length, 10, "the admin catalog must carry 10 modules");
  assert.equal(CLINIC_MODULE_IDS.length, 5, "the clinic catalog must carry 5 modules");
  assert.equal(
    ADMIN_MODULE_IDS.length + CLINIC_MODULE_IDS.length,
    15,
    "B07 covers the 15 canonical `?module=` surfaces",
  );

  const icons = read(ICONS_TS);
  assert.ok(icons.includes("export const ADMIN_MODULE_ICONS: Record<AdminModule, LucideIcon> = {"));
  assert.ok(icons.includes("export const CLINIC_MODULE_ICONS: Record<ClinicModule, LucideIcon> = {"));

  // Exhaustiveness is a TYPE property (Record<AdminModule, …> fails typecheck
  // on a missing id); this census proves the keys are really there today.
  for (const moduleId of [...ADMIN_MODULE_IDS, ...CLINIC_MODULE_IDS]) {
    const key = /^[a-z][a-z0-9]*$/.test(moduleId) ? moduleId : `"${moduleId}"`;
    assert.ok(
      new RegExp(`(^|[\\s{,])${key}:\\s*[A-Z]`, "m").test(icons),
      `${ICONS_TS} has no icon for "${moduleId}"`,
    );
  }
});

test("B07 · the primitives consume the icon owner and declare no icon map", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const source = read(path);
    const executable = stripComments(source);

    assert.ok(
      source.includes('from "./dashboardModuleIcons"'),
      `${path}: icons come from the single owner`,
    );
    assert.equal(
      executable.includes('from "lucide-react"'),
      false,
      `${path} imports icon components directly; a second icon map is exactly the duplication the owner exists to prevent`,
    );
    assert.equal(
      /Record<\s*(Admin|Clinic)Module/.test(executable),
      false,
      `${path} declares a per-module map; that belongs to ${ICONS_TS}`,
    );
  }
});

test("B07 · the icon owner stays an icon owner (no labels, order, href or parsing)", () => {
  const executable = stripComments(read(ICONS_TS));

  for (const forbidden of [
    "label",
    "shortLabel",
    "buildDashboardModuleHref",
    "?module=",
    "parseAdminModule",
    "parseClinicModule",
    "ROUTES",
  ]) {
    assert.equal(
      executable.includes(forbidden),
      false,
      `${ICONS_TS} must not own "${forbidden}" — it maps module id -> icon and nothing else`,
    );
  }
});

// ── T9 · Geometry literals have exactly one owner ────────────────────────────

test("B07 · the drawer/rail geometry is declared once, in the tokens ledger", () => {
  const tokens = read(TOKENS_CSS);
  const block = sliceBlock(tokens, TOKEN_BLOCK_START, TOKEN_BLOCK_END);

  const entries = Object.entries(GEOMETRY_TOKENS);
  assert.equal(entries.length, 6, "the B07 ledger declares six geometry tokens");

  for (const [token, literal] of entries) {
    assert.ok(
      block.includes(`${token}: ${literal};`),
      `the B07 token block must declare ${token}: ${literal};`,
    );

    const declarations = [...tokens.matchAll(new RegExp(`${token}:\\s*[^;]+;`, "g"))];
    assert.equal(
      declarations.length,
      1,
      `${token} must be declared exactly once in tokens.css`,
    );

    for (const cssFile of DASHBOARD_CSS_FILES) {
      if (cssFile === TOKENS_CSS) continue;
      assert.equal(
        new RegExp(`${token}:\\s`).test(read(cssFile)),
        false,
        `${cssFile} re-declares ${token}; tokens.css is the single owner`,
      );
    }
  }
});

test("B07 · no primitive restates a geometry literal the tokens own", () => {
  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const executable = stripComments(read(path));
    for (const literal of ["256px", "80px", "40px", "56px", "16px"]) {
      assert.equal(
        executable.includes(literal),
        false,
        `${path} restates "${literal}"; the geometry ledger in tokens.css owns it`,
      );
    }
  }
});

test("B07 · the orphan 72/240 sidebar tokens are neither reused nor removed", () => {
  const responsive = read(RESPONSIVE_CSS);
  // Comments stripped: both blocks NAME these tokens to explain why they are
  // not reused, and failing on that prose would forbid documenting the debt.
  const b07Css = stripComments(
    sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END),
  );
  const b07Tokens = stripComments(
    sliceBlock(read(TOKENS_CSS), TOKEN_BLOCK_START, TOKEN_BLOCK_END),
  );

  for (const token of LEGACY_SIDEBAR_TOKENS) {
    assert.ok(
      responsive.includes(`${token}:`),
      `${token} is pre-existing debt in ${RESPONSIVE_CSS}; B07 documents it, it does not delete it`,
    );
    for (const [label, source] of [
      ["the B07 CSS block", b07Css],
      ["the B07 token block", b07Tokens],
    ] as const) {
      assert.equal(
        source.includes(token),
        false,
        `${label} reuses ${token} (72px/240px); B07 targets 80px/256px`,
      );
    }
  }
});

// ── T10-T11 · Structural geometry, as a band ─────────────────────────────────

test("B07 · both containers are bounded by the token band, with no radius or elevation", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  for (const [selector, token] of [
    [".dashboard-navigation-drawer", "--dash-nav-drawer-w"],
    [".dashboard-navigation-rail", "--dash-nav-rail-w"],
  ] as const) {
    assert.ok(
      block.includes(`min-inline-size: calc(var(${token}) - var(--dash-nav-band));`),
      `${selector}: the lower bound must be derived from ${token}`,
    );
    assert.ok(
      block.includes(`max-inline-size: calc(var(${token}) + var(--dash-nav-band));`),
      `${selector}: the upper bound must be derived from ${token}`,
    );
  }

  assert.ok(block.includes("block-size: 100%;"), "the containers span the shell height");
  assert.ok(block.includes("border-inline-end: 1px solid var(--dash-color-outline-subtle);"));
  assert.ok(block.includes("border-radius: var(--dash-shape-none);"));
  assert.ok(block.includes("box-shadow: var(--dash-elevation-none);"));

  // A width pinned outside the band would make the token a decoration.
  assert.equal(
    /(^|[^-])(inline-size|width):\s/m.test(block.replace(/(min|max)-inline-size:/g, "")),
    false,
    "the B07 block must not pin a structural width outside the min/max band",
  );

  // An internal scroller is the forbidden primary solution (AGENTS.md §10).
  assert.equal(
    /overflow-y:\s*auto|overflow:\s*auto/.test(block),
    false,
    "the B07 block must not resolve height pressure with an internal scroller",
  );
});

test("B07 · the item geometry follows the canonical 40 / 56 spec through tokens", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  for (const [selector, token] of [
    [".dashboard-navigation-drawer-item", "--dash-nav-item-h"],
    [".dashboard-navigation-rail-item", "--dash-nav-rail-item-h"],
  ] as const) {
    assert.ok(block.includes(selector), `the B07 block must style ${selector}`);
    assert.ok(
      block.includes(`min-block-size: var(${token});`),
      `${selector}: item height comes from ${token}`,
    );
    assert.ok(
      block.includes(`max-block-size: var(${token});`),
      `${selector}: item height comes from ${token}`,
    );
  }

  // Drawer item: 100% - 16, padding 0 12px, pill.
  assert.ok(block.includes("padding-inline: var(--dash-space-3);"), "drawer item inset = 12px");
  assert.ok(block.includes("border-radius: var(--dash-shape-full);"), "drawer item is a pill");
  // Rail item: 100%, padding 8px 0, radius 16.
  assert.ok(block.includes("padding-block: var(--dash-space-2);"), "rail item inset = 8px");
  assert.ok(
    block.includes("border-radius: var(--dash-nav-rail-item-radius);"),
    "rail item radius comes from the ledger",
  );
});

// ── T12 · Responsive contract ────────────────────────────────────────────────

test("B07 · rail owns 768-1279, drawer owns >=1280, and neither exists below 768", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  const railQuery = "@media (min-width: 768px) and (max-width: 1279.98px)";
  const drawerQuery = "@media (min-width: 1280px)";

  assert.ok(block.includes(railQuery), "the rail breakpoint must be declared");
  assert.ok(block.includes(drawerQuery), "the drawer breakpoint must be declared");

  const railScope = block.slice(
    block.indexOf(railQuery),
    block.indexOf(drawerQuery) > block.indexOf(railQuery)
      ? block.indexOf(drawerQuery)
      : block.length,
  );
  assert.ok(
    railScope.includes(".dashboard-navigation-rail {"),
    "the 768-1279 scope must reveal the rail",
  );
  assert.equal(
    railScope.includes(".dashboard-navigation-drawer {"),
    false,
    "the drawer must not appear in the rail scope: two lateral navs at once is double navigation",
  );

  const drawerScope = block.slice(block.indexOf(drawerQuery));
  assert.ok(
    drawerScope.includes(".dashboard-navigation-drawer {"),
    ">=1280 must reveal the drawer",
  );

  // Base state: hidden. <768 is B09's mobile model, not B07's.
  const baseScope = block.slice(0, block.indexOf(railQuery));
  assert.ok(
    /\.dashboard-navigation-drawer,\s*\n[^{]*\.dashboard-navigation-rail\s*\{[^}]*display:\s*none;/m.test(
      baseScope,
    ),
    "both primitives must be hidden by default so <768px keeps the B09 mobile model",
  );
  assert.equal(
    /max-width:\s*767/.test(block),
    false,
    "B07 must not author a <768px rule; mobile navigation belongs to B09",
  );
});

test("B07 · the primitives ship no persisted expand/collapse state", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  for (const path of [DRAWER_TSX, RAIL_TSX]) {
    const executable = stripComments(read(path));
    for (const forbidden of ["localStorage", "sessionStorage", "useState", "useEffect"]) {
      assert.equal(
        executable.includes(forbidden),
        false,
        `${path} introduces "${forbidden}"; B07 is a stateless presentation primitive — the expanded/compact choice is the viewport's, not a persisted preference`,
      );
    }
  }

  assert.equal(
    /data-\w*(collapsed|expanded)/.test(block),
    false,
    "the B07 block must not encode a manual collapse state",
  );
});

test("B07 · active navigation keeps its active colors while hovered", () => {
  // Whitespace-agnostic: the CSS file is CRLF and prettier may wrap the selector
  // list, so the contract is read off a flattened copy of the B07 block.
  const flat = stripComments(sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END))
    .replace(/\s+/g, " ")
    .trim();

  for (const primitive of ["drawer", "rail"]) {
    assert.ok(
      flat.includes(
        `.dashboard-navigation-${primitive}-item.dashboard-navigation-item-active:hover`,
      ),
      `the B07 block must declare an active :hover rule for the ${primitive}: the generic ".dashboard-navigation-${primitive}-item:hover" outranks the single-class active rule and would repaint the selected module with the inactive state layer`,
    );
  }

  const ACTIVE_HOVER_SELECTOR =
    ".dashboard-app-shell .dashboard-navigation-drawer-item.dashboard-navigation-item-active:hover, .dashboard-app-shell .dashboard-navigation-rail-item.dashboard-navigation-item-active:hover {";
  const ruleStart = flat.indexOf(ACTIVE_HOVER_SELECTOR);

  assert.notEqual(
    ruleStart,
    -1,
    "drawer and rail must share one active-:hover rule that restates the active colors",
  );

  const declarations = flat.slice(
    ruleStart + ACTIVE_HOVER_SELECTOR.length,
    flat.indexOf("}", ruleStart),
  );

  assert.ok(
    declarations.includes("background-color: var(--dash-color-surface-muted);"),
    "the hovered active item must keep the active background token, not the hover one",
  );
  assert.ok(
    declarations.includes("color: var(--dash-color-primary);"),
    "the hovered active item must keep the active foreground token, not the hover one",
  );
  assert.equal(
    declarations.includes("!important"),
    false,
    "the active-:hover rule wins by specificity, never by !important",
  );

  assert.ok(
    flat.indexOf(".dashboard-navigation-drawer-item:hover") < ruleStart,
    "the active-:hover rule must follow the generic :hover rule it overrides",
  );
});

// ── T13 · No structural size transitions ─────────────────────────────────────

test("B07 · nothing in the block animates a structural size", () => {
  const block = sliceBlock(read(NAVIGATION_CSS), CSS_BLOCK_START, CSS_BLOCK_END);

  for (const property of ["width", "inline-size", "height", "block-size", "flex-basis"]) {
    assert.equal(
      new RegExp(`transition[^;]*:(?![^;]*none)[^;]*\\b${property}\\b`).test(block),
      false,
      `the B07 block animates ${property}; a size transition feeds the ResizeObserver behind the adaptive capacity engine (R11/A03)`,
    );
  }

  assert.ok(
    block.includes("@media (prefers-reduced-motion: reduce)"),
    "the block must honour reduced motion",
  );
  assert.ok(
    block.includes("@media (forced-colors: active)"),
    "the block must survive forced colors",
  );
  assert.ok(
    block.includes("outline: 2px solid var(--dash-color-focus-ring);") &&
      block.includes("outline-offset: 2px;"),
    "focus must be a real, visible outline — never `outline-style: none`",
  );
  assert.equal(
    /outline(-style)?:\s*none/.test(stripComments(block)),
    false,
    "the B07 block must not suppress the focus outline",
  );
});

// ── T14-T16 · Scope fences: B08, B09 and B06 are untouched ───────────────────

test("B07 · B08 resolved the legacy navigation asymmetrically", () => {
  const barrel = read(NAVIGATION_BARREL);

  assert.equal(
    existsSync(resolve(REPO_ROOT, RETIRED_BY_B08)),
    false,
    `${RETIRED_BY_B08} was retired physically by B08: it only ever rendered at >=768px, which is exactly the regime the drawer and the rail now own`,
  );
  assert.equal(
    stripComments(barrel).includes("DashboardHorizontalNav"),
    false,
    "the barrel must not re-export a retired component",
  );

  assert.ok(
    existsSync(resolve(REPO_ROOT, MOBILE_OWNED_UNTIL_B09)),
    `${MOBILE_OWNED_UNTIL_B09} must survive: below 768px it is still the clinic module navigation on /dashboard, and deleting it before B09 ships a replacement would strand that surface`,
  );
  assert.ok(barrel.includes('from "@/components/dashboard/DashboardModuleRail";'));
});

test("B07 · the mobile navigation B09 unifies is untouched", () => {
  for (const path of B09_FENCE) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must survive B07: the <768px model belongs to B09`,
    );
  }
});

test("B07 · the B06 app bar keeps its own geometry ledger", () => {
  const tokens = read(TOKENS_CSS);

  assert.ok(existsSync(resolve(REPO_ROOT, APP_BAR_TSX)));
  assert.ok(
    tokens.includes("--dash-app-bar-h: 56px;"),
    "B07 must not disturb the B06 band declaration",
  );
  assert.equal(
    [...tokens.matchAll(/--dash-app-bar-h:\s*[^;]+;/g)].length,
    1,
    "--dash-app-bar-h stays declared exactly once",
  );

  const b07Block = sliceBlock(tokens, TOKEN_BLOCK_START, TOKEN_BLOCK_END);
  assert.equal(
    b07Block.includes("--dash-app-bar"),
    false,
    "the B07 ledger must not restate the B06 app-bar geometry",
  );
});

// ── T17 · The primitives are mounted exactly once (B08 closed G-1) ───────────

test("B07 · the primitives have exactly one mount site, and it is the B08 frame", () => {
  assert.ok(
    existsSync(resolve(REPO_ROOT, NAVIGATION_FRAME_TSX)),
    "B08 mounts the primitives through DashboardNavigationFrame",
  );

  const frame = stripComments(read(NAVIGATION_FRAME_TSX));
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

  // No OTHER surface may mount them: a second mount site would ship two lateral
  // navigations at once and move `main` against the A03 freeze. The chrome and
  // mobile surfaces below are the ones that could plausibly try.
  const consumers: string[] = [];
  for (const path of [MOBILE_OWNED_UNTIL_B09, ...B09_FENCE, APP_BAR_TSX]) {
    if (/<NavigationDrawer[\s/>]|<NavigationRail[\s/>]/.test(read(path))) {
      consumers.push(path);
    }
  }

  assert.deepEqual(
    consumers,
    [],
    "the primitives are mounted by the B08 frame and by nothing else",
  );
});
