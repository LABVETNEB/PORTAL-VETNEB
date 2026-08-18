import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";

// B02 (audit §14.3 / §49) — dead dashboard component retirement.
//
// The global audit verified six navigation/filter components with zero runtime
// consumers: a four-file sidebar chain closed on itself (DashboardSidebar ->
// ClinicDashboardSidebar -> DashboardSidebarFrame <- AdminDashboardSidebar) and
// two filter surfaces (FilterDrawer, StickyFilterBar) that no page ever
// rendered. B02 removes them.
//
// A deletion is not a contract. Without an executable guard, nothing stops a
// later PR from recreating one of the six — under the same path, under a new
// folder, or through a presentation barrel — and the retirement silently
// unwinds. This guard is the fail-closed form of the B02 acceptance criterion
// ("`git grep` sin resultados", §56.1): it asserts physical absence, absence
// from the first-party import graph, and absence from the presentation barrels.
//
// Scope fence: B02 retires the six dead components and nothing else.
// DashboardHorizontalNav and DashboardModuleRail are live navigation and are
// programmed for B08 (after B07 + A08); AdminMobileKebabMenu is live and merely
// excluded from the B01 barrel. None of them are governed here.

const SOURCE_ROOT = process.cwd();

const FRONTEND_SOURCE_ROOT = "frontend/src";
const LEGACY_COMPONENT_ROOT = "frontend/src/components/dashboard";
const PRESENTATION_ROOT = "frontend/src/features/dashboard/presentation";
const MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

// The §14.3 census, by component name. These are the retired symbols and the
// retired module basenames at once: each lived in a single file named after it.
const RETIRED_COMPONENTS = [
  "DashboardSidebarFrame",
  "FilterDrawer",
  "StickyFilterBar",
  "AdminDashboardSidebar",
  "ClinicDashboardSidebar",
  "DashboardSidebar",
] as const;

// The exact paths the audit measured (17 456 B of CRLF working tree, 16 907 B
// of LF blob). Pinned so a recreation under the original path is caught by
// name, not only by the broader basename sweep below.
const RETIRED_PATHS = RETIRED_COMPONENTS.map(
  (component) => `${LEGACY_COMPONENT_ROOT}/${component}.tsx`,
);

function readSource(relativePath: string): string {
  return readFileSync(resolve(SOURCE_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function listSourceFiles(relativeDir: string): string[] {
  const rootDir = resolve(SOURCE_ROOT, relativeDir);
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const walk = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = resolve(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(relative(SOURCE_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files.sort();
}

// Module specifiers are read from real import/export declarations only, never
// from prose: this very file, the presentation barrels and several absence
// contracts all NAME the retired components in comments and in assertions, and
// a substring scan would flag them. Same extraction the B01 boundary guard
// uses, so both guards agree on what counts as an edge.
function extractModuleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  // import ... from "spec";  /  export ... from "spec";  (single or multi-line)
  for (const match of source.matchAll(
    /^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm,
  )) {
    specifiers.push(match[1]);
  }

  // side-effect import "spec";
  for (const match of source.matchAll(/^[ \t]*import\s*["']([^"']+)["']/gm)) {
    specifiers.push(match[1]);
  }

  // dynamic import("spec") / require("spec")
  for (const match of source.matchAll(
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

// A specifier resolves to a retired module when its final segment is one of the
// retired names, whatever the prefix: "@/components/dashboard/FilterDrawer",
// "./FilterDrawer", "../../dashboard/FilterDrawer" and "@/x/FilterDrawer.tsx"
// all match. Directory-index forms ("./FilterDrawer/index") match too.
function retiredComponentFor(specifier: string): string | undefined {
  const withoutQuery = specifier.split(/[?#]/)[0].replace(/\/index$/, "");
  const segment = withoutQuery.split("/").pop() ?? "";
  const stem = MODULE_EXTENSIONS.includes(extname(segment))
    ? segment.slice(0, -extname(segment).length)
    : segment;

  return RETIRED_COMPONENTS.find((component) => component === stem);
}

// -- 1 - The six files are physically gone -----------------------------------

test("B02 the six retired dashboard components no longer exist at their audited paths", () => {
  for (const path of RETIRED_PATHS) {
    assert.equal(
      existsSync(resolve(SOURCE_ROOT, path)),
      false,
      `${path} was retired by B02 (audit §14.3) and must not be recreated`,
    );
  }
});

// -- 2 - No equivalent module was recreated elsewhere under frontend/src -----
//
// Proportional to the retirement: a same-named module anywhere in the frontend
// source tree is a recreation of the retired component, whichever folder it
// lands in. This does not attempt semantic detection of a rewritten equivalent
// under a different name — that is out of B02's reach and out of its scope.

test("B02 no retired component name is recreated as a module anywhere in frontend/src", () => {
  const files = listSourceFiles(FRONTEND_SOURCE_ROOT);

  assert.ok(
    files.length > 0,
    `${FRONTEND_SOURCE_ROOT} must contain sources; an empty scan would pass vacuously`,
  );

  for (const file of files) {
    const stem = basename(file, extname(file));
    assert.equal(
      RETIRED_COMPONENTS.includes(stem as (typeof RETIRED_COMPONENTS)[number]),
      false,
      `${file} recreates "${stem}", retired by B02 (audit §14.3); B02 removed it as dead code, so reintroducing it needs its own audited PR`,
    );
  }
});

// -- 3 - Nothing in frontend/src imports or re-exports a retired module ------

test("B02 no frontend source imports or re-exports a retired component", () => {
  const files = listSourceFiles(FRONTEND_SOURCE_ROOT);

  assert.ok(
    files.length > 0,
    `${FRONTEND_SOURCE_ROOT} must contain sources; an empty scan would pass vacuously`,
  );

  for (const file of files) {
    for (const specifier of extractModuleSpecifiers(readSource(file))) {
      const retired = retiredComponentFor(specifier);
      assert.equal(
        retired,
        undefined,
        `${file} imports "${specifier}", which resolves to "${retired}" — retired by B02 (audit §14.3)`,
      );
    }
  }
});

// -- 4 - The presentation barrels expose no retired symbol -------------------
//
// Covers the export side that a specifier scan cannot see: a barrel could
// re-export the symbol from a module whose own name is not retired.

test("B02 no dashboard presentation barrel exports a retired component symbol", () => {
  const barrels = listSourceFiles(PRESENTATION_ROOT);

  assert.ok(
    barrels.length > 0,
    `${PRESENTATION_ROOT} must contain sources; an empty scan would pass vacuously`,
  );

  for (const barrel of barrels) {
    // Comments are stripped first: the barrels document *why* the sidebars are
    // absent, and that prose must not be able to fail the guard.
    const code = readSource(barrel)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    for (const component of RETIRED_COMPONENTS) {
      const pattern = new RegExp(
        `^export\\b[\\s\\S]*?(?:^|[\\s{,])(?:type\\s+)?${component}\\s*(?:as\\s+[A-Za-z_$][\\w$]*\\s*)?[,}]`,
        "m",
      );
      assert.equal(
        pattern.test(code),
        false,
        `${barrel} must not export "${component}": it was retired by B02 (audit §14.3)`,
      );
    }
  }
});
