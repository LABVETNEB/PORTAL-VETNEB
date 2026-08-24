import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// B10 · Clinic app-shell unification static contract.
//
// B08 and B09 already removed the two BANDS that P0-04 measured (the horizontal
// nav and the module rail), so at the B10 base the ten clinic surfaces already
// shared one topbar and one identically positioned `main`. What survived was
// not a second shell but a second DECLARATION of the first: each of the six
// clinic routes re-stated `DashboardTopbar` + `DashboardNavigationFrame` +
// `<main className="dashboard-main">` for itself.
//
//   ONE OWNER
//     `ClinicDashboardShell` owns those three, and only those three. The six
//     routes mount it and stop declaring them.
//
//   NOT A SCAFFOLD (B11/B15 fence)
//     The shell renders no module header, toolbar, filter region, collection
//     region or side panel. `DashboardPageHeader` and `DashboardModuleWorkspace`
//     keep their current consumers: unifying them changes the module header's
//     geometry and its permanent description (B11) and folding both into one
//     scaffold is B15 (audit §14.2, §49).
//
//   NOT A NAVIGATION OWNER (B09 fence)
//     The shell does not reach into `DashboardMobileNav`; the shell router
//     still mounts it. B10 deliberately preserves the existing full-route
//     `aria-current` behaviour below 768px.
//
//   NO GEOMETRY OF ITS OWN (A03/A08 fence)
//     No wrapper between the frame and `<main>`, no overflow/height/min-height/
//     flex-basis, no transition, no CSS. The rows canvas every adaptive
//     consumer measures is left exactly where it was.
//
// Written fail-closed: every census asserts its own cardinality before
// iterating, so a renamed path or an empty scan fails instead of passing
// vacuously.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const SHELL_TSX = "frontend/src/components/dashboard/ClinicDashboardShell.tsx";
const TOPBAR_TSX = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const FRAME_TSX =
  "frontend/src/components/dashboard/DashboardNavigationFrame.tsx";
const PAGE_HEADER_TSX =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";
const MODULE_WORKSPACE_TSX =
  "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx";
const MOBILE_MODULE_FRAME_TSX =
  "frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx";
const SHELL_ROUTER_TSX =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const CLINIC_CONTROLLER_TSX =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const ADMIN_ROUTE = "frontend/src/app/dashboard/admin/page.tsx";
const PRESENTATION_ROOT = "frontend/src/features/dashboard/presentation";
const FRONTEND_SRC = "frontend/src";

/** The six clinic routes B10 unifies, in route order. */
const CLINIC_ROUTES = [
  "frontend/src/app/dashboard/page.tsx",
  "frontend/src/app/dashboard/informes/page.tsx",
  "frontend/src/app/dashboard/logistica/page.tsx",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  "frontend/src/app/dashboard/logistica/visitas/page.tsx",
];

/** The module each full route declares; `/dashboard` lets the URL decide. */
const ROUTE_MODULE: Readonly<Record<string, string | null>> = Object.freeze({
  "frontend/src/app/dashboard/page.tsx": null,
  "frontend/src/app/dashboard/informes/page.tsx": "informes",
  "frontend/src/app/dashboard/logistica/page.tsx": "logistica",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx": "logistica",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx": "logistica",
  "frontend/src/app/dashboard/logistica/visitas/page.tsx": "logistica",
});

/**
 * The FIRST direct child of `<main>` per route, which B10 must not reorder.
 * Two shipped rules read that position: the rhythm owl
 * `.dashboard-main > :not([hidden]) ~ :not([hidden])` (responsive.css) and
 * `.dashboard-main:has(> [data-sticky-action-bar="true"])` (zero-scroll.css).
 */
const ROUTE_FIRST_CHILD: Readonly<Record<string, string>> = Object.freeze({
  "frontend/src/app/dashboard/page.tsx": "<Suspense>",
  "frontend/src/app/dashboard/informes/page.tsx": "<DashboardPageHeader",
  "frontend/src/app/dashboard/logistica/page.tsx": "<DashboardPageHeader",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx": "<div",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx": "<div",
  "frontend/src/app/dashboard/logistica/visitas/page.tsx": "<div",
});

/** Chrome the shell must NOT absorb: B11 owns the header, B15 the scaffold. */
const SCAFFOLD_SURFACES = [
  "DashboardPageHeader",
  "DashboardModuleWorkspace",
  "WorkspaceHeader",
  "WorkspaceToolbar",
  "WorkspaceScaffold",
  "FilterBar",
  "CollectionWorkspace",
  "UtilitySidePanel",
  "ModuleSurface",
  "ClinicMobileModuleFrame",
];

/** Navigation owners B09 and the shell router keep. */
const NAVIGATION_OWNERS = [
  "DashboardMobileNav",
  "AdminMobileKebabMenu",
  "NavigationDrawer",
  "NavigationRail",
];

/** Geometry the stylesheets own. The shell may not restate any of it. */
const FORBIDDEN_STYLE_PROPERTIES = [
  "overflow",
  "height",
  "minHeight",
  "min-height",
  "flexBasis",
  "flex-basis",
  "transition",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function read(repoRelativePath: string): string {
  const absolute = resolve(REPO_ROOT, repoRelativePath);
  assert.ok(existsSync(absolute), `source not found: ${repoRelativePath}`);
  return readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
}

/** Strips block and line comments so a prose mention never satisfies a guard. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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
      if (absolute.endsWith(".ts") || absolute.endsWith(".tsx")) {
        found.push(absolute);
      }
    }
  };

  walk(rootDir);
  return found;
}

/** Normalises separators FIRST: on Windows the walker yields `frontend\src`. */
function repoRelative(absolute: string): string {
  const posix = absolute.replace(/\\/g, "/");
  return posix.slice(posix.indexOf("frontend/src"));
}

// ── T0 · The census itself ───────────────────────────────────────────────────

test("B10 · the contract census is complete and every path exists", () => {
  assert.equal(CLINIC_ROUTES.length, 6, "six clinic routes are B10's");
  assert.equal(
    new Set(CLINIC_ROUTES).size,
    CLINIC_ROUTES.length,
    "clinic route census must not contain duplicates",
  );
  assert.equal(Object.keys(ROUTE_MODULE).length, CLINIC_ROUTES.length);
  assert.equal(Object.keys(ROUTE_FIRST_CHILD).length, CLINIC_ROUTES.length);

  for (const path of [
    SHELL_TSX,
    TOPBAR_TSX,
    FRAME_TSX,
    PAGE_HEADER_TSX,
    MODULE_WORKSPACE_TSX,
    MOBILE_MODULE_FRAME_TSX,
    SHELL_ROUTER_TSX,
    CLINIC_CONTROLLER_TSX,
    ADMIN_ROUTE,
    ...CLINIC_ROUTES,
  ]) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must exist for the B10 contract to mean anything`,
    );
  }
});

// ── T1 · One owner, and it is a server component ─────────────────────────────

test("B10 · ClinicDashboardShell is the single clinic shell owner", () => {
  const shell = stripComments(read(SHELL_TSX));

  assert.ok(
    shell.includes("export function ClinicDashboardShell("),
    "the shell must export its component",
  );
  assert.ok(
    shell.includes("export type ClinicDashboardShellProps = {"),
    "the shell must export typed props",
  );
  // Comment-stripped: the header prose explains WHY there is no directive, and
  // a prose mention must never satisfy or break a guard.
  assert.equal(
    shell.includes('"use client"'),
    false,
    "the shell is a server component: the topbar and the frame stay the client leaves",
  );

  const files = listSourceFiles(FRONTEND_SRC);
  assert.ok(files.length > 100, "the frontend source scan must not be empty");

  const definitions = files.filter((absolute) =>
    /export function ClinicDashboardShell\(/.test(
      stripComments(readFileSync(absolute, "utf8")),
    ),
  );
  assert.deepEqual(
    definitions.map(repoRelative),
    [SHELL_TSX],
    "exactly one implementation of the clinic shell may exist",
  );
});

test("B10 · the shell renders the topbar, the frame and main, in that order", () => {
  const shell = stripComments(read(SHELL_TSX));

  assert.match(
    shell,
    /<DashboardTopbar[\s\S]*?<DashboardNavigationFrame[\s\S]*?<main[\s\S]*?<\/main>[\s\S]*?<\/DashboardNavigationFrame>/,
    "the app bar stays ABOVE the lateral band and main lives INSIDE the frame",
  );
  assert.ok(
    shell.includes('notifications="clinic"'),
    "the shell owns the clinic notification role once, for all six routes",
  );
  assert.ok(
    shell.includes('surface="clinic"'),
    "the shell declares the clinic surface to the frame",
  );
  assert.ok(
    shell.includes('className="dashboard-main"'),
    "the shell owns the main region class",
  );
  assert.ok(
    shell.includes("{children}"),
    "route content is the direct child of main",
  );

  // No wrapper may sit between the frame and main: an extra box would change
  // the height ledger the adaptive canvas is measured against.
  const between = shell.slice(
    shell.indexOf("<DashboardNavigationFrame"),
    shell.indexOf("<main"),
  );
  assert.equal(
    /<[A-Za-z]/.test(between.replace(/<DashboardNavigationFrame/, "")),
    false,
    "no element may sit between DashboardNavigationFrame and main",
  );
});

test("B10 · the shell declares no geometry and no styling of its own", () => {
  const shell = stripComments(read(SHELL_TSX));

  for (const property of FORBIDDEN_STYLE_PROPERTIES) {
    assert.equal(
      shell.includes(`${property}:`),
      false,
      `the shell must not restate ${property}: the dashboard stylesheets own the height ledger (A03/A08)`,
    );
  }
  assert.equal(
    shell.includes("className={"),
    false,
    "the shell composes no dynamic class: main's class is the shipped literal",
  );
  assert.equal(
    /import\s+["'].*\.css["']/.test(shell),
    false,
    "B10 introduces no stylesheet",
  );
});

// ── T2 · Scope fences: B11, B15, B09 ─────────────────────────────────────────

test("B10 · the shell is not a workspace scaffold (B11/B15 fence)", () => {
  const shell = stripComments(read(SHELL_TSX));

  for (const surface of SCAFFOLD_SURFACES) {
    assert.equal(
      shell.includes(surface),
      false,
      `the shell must not render ${surface}: the module header is B11 and the scaffold is B15`,
    );
  }
});

test("B10 · the shell is not a navigation owner (B09 fence)", () => {
  const shell = stripComments(read(SHELL_TSX));

  for (const owner of NAVIGATION_OWNERS) {
    assert.equal(
      shell.includes(owner),
      false,
      `the shell must not reach into ${owner}: the shell router and the frame own them`,
    );
  }

  // The mobile bar keeps its single mount site, and it keeps deriving its
  // active module from the URL alone. B10 preserves that behaviour on the full
  // routes deliberately; changing it is a separate, declared follow-up.
  assert.ok(
    stripComments(read(SHELL_ROUTER_TSX)).includes("<DashboardMobileNav"),
    "the shell router stays the single mount site of the mobile bar",
  );
});

test("B10 · the header owners B11 and B15 inherit are untouched", () => {
  for (const path of [PAGE_HEADER_TSX, MODULE_WORKSPACE_TSX]) {
    assert.ok(
      existsSync(resolve(REPO_ROOT, path)),
      `${path} must survive B10: consolidating the module header is B11/B15`,
    );
  }

  // DashboardPageHeader keeps all three of its consumers: two clinic full
  // routes plus the admin hub state.
  const consumers = [
    "frontend/src/app/dashboard/informes/page.tsx",
    "frontend/src/app/dashboard/logistica/page.tsx",
    ADMIN_ROUTE,
  ];
  for (const path of consumers) {
    assert.ok(
      stripComments(read(path)).includes("<DashboardPageHeader"),
      `${path} keeps its page header: retiring it is B11/B15`,
    );
  }

  // The clinic module shell still has NO page-header band, and the clinic
  // stage still owns the module header through DashboardModuleWorkspace.
  assert.equal(
    stripComments(read(CLINIC_ROUTES[0])).includes("<DashboardPageHeader"),
    false,
    "/dashboard opens straight into the workspace controller, with no landing header band",
  );
  assert.ok(
    stripComments(read(CLINIC_CONTROLLER_TSX)).includes(
      "<DashboardModuleWorkspace",
    ),
    "the clinic stage keeps the module workspace as its header owner",
  );
});

// ── T3 · The six routes mount the shell and stop declaring the triple ────────

test("B10 · all six clinic routes mount the shared shell", () => {
  for (const path of CLINIC_ROUTES) {
    const source = stripComments(read(path));

    assert.ok(
      source.includes(
        'import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";',
      ),
      `${path} must import the shared clinic shell`,
    );
    assert.ok(
      source.includes("<ClinicDashboardShell"),
      `${path} must mount the shared clinic shell`,
    );
    assert.ok(
      source.includes("</ClinicDashboardShell>"),
      `${path} must wrap its content, not self-close the shell`,
    );
    assert.match(
      source,
      /<ClinicDashboardShell[\s\S]*<\/ClinicDashboardShell>/,
      `${path}: the shell must enclose the route content`,
    );
  }
});

test("B10 · no clinic route re-declares the topbar, the frame or main", () => {
  for (const path of CLINIC_ROUTES) {
    const source = stripComments(read(path));

    for (const declaration of [
      "<DashboardTopbar",
      "<DashboardNavigationFrame",
      "dashboard-main",
    ]) {
      assert.equal(
        source.includes(declaration),
        false,
        `${path} must not re-declare ${declaration}: ClinicDashboardShell owns it`,
      );
    }
    assert.equal(
      source.includes('notifications="clinic"'),
      false,
      `${path} must not restate the notification role: the shell owns it`,
    );
  }
});

test("B10 · the admin shell is untouched and still declares its own triple", () => {
  const admin = stripComments(read(ADMIN_ROUTE));

  // B10 unifies CLINIC. Admin differs in notification role, overflow menu,
  // mobile context title and hub null state; folding it in is a second scope.
  assert.ok(admin.includes("<DashboardTopbar"), "admin keeps its own app bar");
  assert.match(
    admin,
    /<DashboardNavigationFrame\s+surface="admin"/,
    "admin keeps its own frame, reading ?module= itself",
  );
  assert.ok(
    admin.includes('<main className="dashboard-main">'),
    "admin keeps its own main region",
  );
  assert.equal(
    admin.includes("ClinicDashboardShell"),
    false,
    "the clinic shell must not be mounted by the admin route",
  );
});

// ── T4 · Per-route declarations survive the move ─────────────────────────────

test("B10 · every route declares the same active module it declared before", () => {
  for (const path of CLINIC_ROUTES) {
    const source = stripComments(read(path));
    const expected = ROUTE_MODULE[path];

    if (expected === null) {
      assert.equal(
        /<ClinicDashboardShell[\s\S]*?module=/.test(
          source.slice(source.indexOf("<ClinicDashboardShell"), source.indexOf(">", source.indexOf("<ClinicDashboardShell"))),
        ),
        false,
        `${path} is the clinic module shell: the frame must read ?module= from the URL`,
      );
      continue;
    }

    assert.ok(
      source.includes(`module="${expected}"`),
      `${path} must keep presenting "${expected}" as the active module`,
    );
  }
});

test("B10 · each route keeps its first direct child of main", () => {
  for (const path of CLINIC_ROUTES) {
    const source = stripComments(read(path));
    const openTagEnd = source.indexOf(">", source.indexOf("<ClinicDashboardShell"));
    assert.ok(openTagEnd > 0, `${path}: the shell open tag must close`);

    const body = source.slice(openTagEnd + 1);
    const firstElement = body.slice(0, body.indexOf("\n", body.indexOf("<")) + 1);

    assert.ok(
      firstElement.includes(ROUTE_FIRST_CHILD[path]),
      `${path}: the first direct child of main must stay ${ROUTE_FIRST_CHILD[path]} — the rhythm owl and the sticky-action :has() rule read that position`,
    );
  }
});

test("B10 · logistica keeps its adaptive reservation and sticky-action ledger", () => {
  const logistica = stripComments(
    read("frontend/src/app/dashboard/logistica/page.tsx"),
  );

  assert.ok(
    logistica.includes("mainAdaptiveReservation"),
    "the logistics hub keeps declaring main as the adaptive reservation root (A05)",
  );
  assert.ok(
    logistica.includes(
      '"--dash-sticky-action-h": STICKY_ACTION_RESERVED_BLOCK_SIZE',
    ),
    "the sticky-action ledger var stays declared by the route that mounts the bar",
  );
  assert.ok(
    logistica.includes("<StickyActionBar"),
    "the sticky action bar stays a DIRECT child of main: zero-scroll.css reads it with :has(> …)",
  );

  const shell = stripComments(read(SHELL_TSX));
  assert.ok(
    shell.includes('data-dashboard-adaptive-reservation={'),
    "the shell publishes the reservation attribute conditionally",
  );
  assert.ok(
    shell.includes('"true" : undefined'),
    "routes without the reservation must emit no attribute at all",
  );

  // Every other clinic route must NOT opt in: the reservation root is one.
  for (const path of CLINIC_ROUTES.filter(
    (route) => route !== "frontend/src/app/dashboard/logistica/page.tsx",
  )) {
    assert.equal(
      stripComments(read(path)).includes("mainAdaptiveReservation"),
      false,
      `${path} must not claim the adaptive reservation root`,
    );
  }
});

// ── T5 · The presentation boundary stays closed ──────────────────────────────

test("B10 · the shell is not exported from any presentation barrel", () => {
  const barrels = listSourceFiles(PRESENTATION_ROOT).filter((absolute) =>
    absolute.endsWith("index.ts"),
  );
  assert.ok(barrels.length >= 6, "the presentation barrels must be discoverable");

  for (const absolute of barrels) {
    assert.equal(
      stripComments(readFileSync(absolute, "utf8")).includes(
        "ClinicDashboardShell",
      ),
      false,
      `${repoRelative(absolute)} must not re-export the clinic shell: it renders DashboardTopbar, whose closure reaches @/lib/api`,
    );
  }
});

test("B10 · the shell reaches the data layer only through the topbar it mounts", () => {
  const shell = stripComments(read(SHELL_TSX));

  for (const forbidden of ["@/lib/api", "@/app/", 'from "@/app"']) {
    assert.equal(
      shell.includes(forbidden),
      false,
      `the shell must not import ${forbidden} directly`,
    );
  }
});
