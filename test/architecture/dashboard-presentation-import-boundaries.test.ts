import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

// B01 (audit §49 / §54) — dashboard presentation import boundaries.
//
// B01 populates `presentation/shell` and `presentation/navigation` with
// behaviour-preserving re-exports of the legacy `components/dashboard/*`
// implementations. Nothing is moved and no consumer is migrated, so the only
// thing that can regress is the *architecture*: this guard is the executable
// form of the acceptance criterion "sin imports cruzados" (§54) and of the
// architecture test plan of §56.1.
//
// Fail-closed design: a barrel could satisfy a naive folder scan while
// re-exporting a legacy component that itself reaches the data layer. So the
// guard does not only walk `presentation/**` physically; it parses the barrels,
// derives the re-export targets from the source, and applies the same forbidden
// dependency rules to every target it finds. A re-export added by a later PR is
// checked automatically — the target list is discovered, never hardcoded as an
// escape hatch.

const SOURCE_ROOT = process.cwd();

const PRESENTATION_ROOT = "frontend/src/features/dashboard/presentation";
const SHELL_BARREL = `${PRESENTATION_ROOT}/shell/index.ts`;
const NAVIGATION_BARREL = `${PRESENTATION_ROOT}/navigation/index.ts`;
const LEGACY_COMPONENT_ROOT = "frontend/src/components/dashboard";
const LEGACY_ALIAS_PREFIX = "@/components/dashboard/";
const APP_LAYER_ROOT = "frontend/src/app";

// Module specifiers presentation must never reach — directly, or through any
// module it re-exports. `@/lib/api` is the data layer; `@/app` is the Next.js
// app layer. Matching is exact-or-subpath, so sibling helpers such as
// `@/lib/api-error` are not swept in by accident.
const FORBIDDEN_DEPENDENCIES = ["@/lib/api", "@/app"] as const;

// REQUIRED_EXPORTS — the B01 contract, keyed by legacy target module.
// Semantics are "at least these": a later PR may add exports without editing
// this guard, but may not silently drop one.
const SHELL_REQUIRED_EXPORTS: Record<string, readonly string[]> = {
  DashboardShellRouter: ["DashboardShellRouter"],
  PrivateDashboardShell: [
    "PrivateDashboardShell",
    "PrivateDashboardShellProps",
  ],
  DashboardModuleWorkspace: ["DashboardModuleWorkspace"],
  DashboardModuleHub: ["DashboardModuleHub", "DashboardModuleCard"],
  DashboardHubHero: [
    "DashboardHubHero",
    "DashboardHubHeroMetric",
    "DashboardHubHeroProps",
    "DashboardHubHeroStatusTone",
  ],
};

const NAVIGATION_REQUIRED_EXPORTS: Record<string, readonly string[]> = {
  DashboardHorizontalNav: ["DashboardHorizontalNav", "DashboardNavSurface"],
  DashboardModuleRail: ["DashboardModuleRail", "CLINIC_MODULE_RAIL_ITEMS"],
  AdminMobileBottomNav: ["AdminMobileBottomNav"],
  ClinicMobileBottomNav: ["ClinicMobileBottomNav"],
  AdminMobileHubLauncher: ["AdminMobileHubLauncher"],
  AdminMobileHubPager: ["AdminMobileHubPager"],
  AdminMobileKebabMenu: ["AdminMobileKebabMenu"],
  AdminMobileModuleMenu: ["AdminMobileModuleMenu"],
  DashboardPager: [
    "DashboardPager",
    "DashboardPagerProps",
    "DASHBOARD_PAGER_RESERVATION",
    "DASHBOARD_TOUCH_PAGER_RESERVATION",
    "DASHBOARD_INLINE_PAGER_RESERVATION",
  ],
  CompactPager: ["CompactPager", "CompactPagerProps"],
};

// FORBIDDEN_EXPORTS — a scope fence, not a permanent verdict. These components
// have no runtime consumers and their disposition belongs to B02. B01 must not
// hand them a public import surface it would immediately have to withdraw.
//
// `DashboardTopbar` is intentionally NOT listed here. Its exclusion is a
// *consequence* of the forbidden-dependency rule below (it imports `@/lib/api`),
// not a frozen fact: this guard never asserts that the violation persists, so
// removing that import in a later PR makes the component admissible with no
// change to this file.
const NAVIGATION_FORBIDDEN_EXPORTS = [
  "AdminDashboardSidebar",
  "ClinicDashboardSidebar",
] as const;

function readSource(relativePath: string): string {
  const absolute = resolve(SOURCE_ROOT, relativePath);
  assert.ok(existsSync(absolute), `source not found: ${relativePath}`);
  return readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
}

function listFilesRecursive(relativeDir: string): string[] {
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
      } else if (entry.isFile()) {
        files.push(relative(SOURCE_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files;
}

// Module specifiers are read from real import/export declarations only.
//
// This matters: the presentation barrels document the boundary in prose and
// literally contain the text `@/lib/api` inside their JSDoc. A substring scan
// over the whole file would flag every barrel in the tree. The static patterns
// below are anchored to the start of a line, which a JSDoc continuation line
// (" * ...") can never satisfy, and the dynamic pattern requires a call
// expression.
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

function matchesForbidden(specifier: string): string | undefined {
  return FORBIDDEN_DEPENDENCIES.find(
    (dependency) =>
      specifier === dependency || specifier.startsWith(`${dependency}/`),
  );
}

// Relative specifiers are resolved too, so a hand-rolled "../../../app/..."
// escape hatch is caught as well as the aliased "@/app" form.
function resolvesIntoAppLayer(
  specifier: string,
  fromRelativeFile: string,
): boolean {
  if (!specifier.startsWith(".")) {
    return false;
  }

  const resolved = relative(
    SOURCE_ROOT,
    resolve(dirname(resolve(SOURCE_ROOT, fromRelativeFile)), specifier),
  )
    .split(sep)
    .join("/");

  return (
    resolved === APP_LAYER_ROOT || resolved.startsWith(`${APP_LAYER_ROOT}/`)
  );
}

function assertNoForbiddenDependency(
  relativePath: string,
  reason: string,
): void {
  const source = readSource(relativePath);

  for (const specifier of extractModuleSpecifiers(source)) {
    const forbidden = matchesForbidden(specifier);
    assert.equal(
      forbidden,
      undefined,
      `${relativePath} (${reason}) must not import "${specifier}": the dashboard presentation boundary forbids "${forbidden}"`,
    );
    assert.equal(
      resolvesIntoAppLayer(specifier, relativePath),
      false,
      `${relativePath} (${reason}) must not import "${specifier}": it resolves into the ${APP_LAYER_ROOT} layer`,
    );
  }
}

// Re-export targets are DISCOVERED from the barrel source, never assumed.
// Everything a barrel exposes is subject to the dependency rules, including
// exports added by a future PR.
function extractReexportTargets(barrelPath: string): string[] {
  return [...new Set(extractModuleSpecifiers(readSource(barrelPath)))];
}

function legacyTargetPath(moduleName: string): string {
  return `${LEGACY_COMPONENT_ROOT}/${moduleName}.tsx`;
}

function assertBarrelExports(
  barrelPath: string,
  requiredExports: Record<string, readonly string[]>,
): void {
  const source = readSource(barrelPath);

  for (const [moduleName, symbols] of Object.entries(requiredExports)) {
    const specifier = `${LEGACY_ALIAS_PREFIX}${moduleName}`;
    assert.ok(
      source.includes(`from "${specifier}";`),
      `${barrelPath} must re-export from ${specifier}`,
    );

    for (const symbol of symbols) {
      const pattern = new RegExp(
        `(?:^|[\\s{,])(?:type\\s+)?${symbol}\\s*[,}]`,
        "m",
      );
      assert.ok(
        pattern.test(source),
        `${barrelPath} must re-export the symbol "${symbol}" from ${specifier}`,
      );
    }
  }
}

// -- 1 - Barrels expose the declared B01 contract ---------------------------

test("B01 presentation/shell re-exports the declared app-shell chrome", () => {
  assertBarrelExports(SHELL_BARREL, SHELL_REQUIRED_EXPORTS);
});

test("B01 presentation/navigation re-exports the declared navigation surfaces", () => {
  assertBarrelExports(NAVIGATION_BARREL, NAVIGATION_REQUIRED_EXPORTS);
});

// -- 2 - Every re-export target exists and really exports the symbol --------

test("B01 every re-export target module exists at its pinned legacy path", () => {
  for (const barrel of [SHELL_BARREL, NAVIGATION_BARREL]) {
    const targets = extractReexportTargets(barrel);

    assert.ok(
      targets.length > 0,
      `${barrel} must expose re-export targets; an empty barrel would pass vacuously`,
    );

    for (const specifier of targets) {
      assert.ok(
        specifier.startsWith(LEGACY_ALIAS_PREFIX),
        `${barrel} may only re-export from ${LEGACY_COMPONENT_ROOT}; found "${specifier}"`,
      );

      const moduleName = specifier.slice(LEGACY_ALIAS_PREFIX.length);
      assert.ok(
        existsSync(resolve(SOURCE_ROOT, legacyTargetPath(moduleName))),
        `${barrel} re-exports "${specifier}" but ${legacyTargetPath(moduleName)} does not exist`,
      );
    }
  }
});

test("B01 every declared symbol is really exported by its legacy target", () => {
  const contracts = [
    [SHELL_BARREL, SHELL_REQUIRED_EXPORTS] as const,
    [NAVIGATION_BARREL, NAVIGATION_REQUIRED_EXPORTS] as const,
  ];

  for (const [barrel, requiredExports] of contracts) {
    for (const [moduleName, symbols] of Object.entries(requiredExports)) {
      const targetPath = legacyTargetPath(moduleName);
      const target = readSource(targetPath);

      for (const symbol of symbols) {
        const pattern = new RegExp(
          `^export\\s+(?:function|const|let|class|type|interface)\\s+${symbol}\\b`,
          "m",
        );
        assert.ok(
          pattern.test(target),
          `${barrel} declares "${symbol}" but ${targetPath} does not export it`,
        );
      }
    }
  }
});

// -- 3 - Forbidden dependencies: physical sources AND re-export targets -----

test("B01 no presentation source imports the data layer or the app layer", () => {
  const sources = listFilesRecursive(PRESENTATION_ROOT).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );

  assert.ok(
    sources.length > 0,
    `${PRESENTATION_ROOT} must contain sources; an empty scan would pass vacuously`,
  );

  for (const file of sources) {
    assertNoForbiddenDependency(file, "presentation source");
  }
});

test("B01 no module re-exported through the presentation barrels reaches the data layer", () => {
  const targets = new Set<string>();

  for (const barrel of [SHELL_BARREL, NAVIGATION_BARREL]) {
    for (const specifier of extractReexportTargets(barrel)) {
      if (!specifier.startsWith(LEGACY_ALIAS_PREFIX)) continue;
      targets.add(legacyTargetPath(specifier.slice(LEGACY_ALIAS_PREFIX.length)));
    }
  }

  assert.ok(
    targets.size > 0,
    "the presentation barrels must expose re-export targets; an empty set would pass vacuously",
  );

  for (const target of targets) {
    assertNoForbiddenDependency(target, "sanctioned re-export target");
  }
});

// -- 4 - Scope fences -------------------------------------------------------

test("B01 navigation barrel does not expose the B02 sidebar components", () => {
  const source = readSource(NAVIGATION_BARREL);

  for (const forbidden of NAVIGATION_FORBIDDEN_EXPORTS) {
    const pattern = new RegExp(
      `^export\\b[^;]*?\\b${forbidden}\\b[^;]*?from\\s*["']`,
      "m",
    );
    assert.equal(
      pattern.test(source),
      false,
      `${NAVIGATION_BARREL} must not re-export "${forbidden}": it has no runtime consumer and its disposition belongs to B02`,
    );
  }
});

// -- 5 - The barrels re-export; they never become owners --------------------

test("B01 presentation barrels are pure re-export modules with no local declarations", () => {
  for (const barrel of [SHELL_BARREL, NAVIGATION_BARREL]) {
    const withoutComments = readSource(barrel)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    // Remove every well-formed `export ... from "..."` statement. Whatever is
    // left is, by definition, the barrel owning something it should not: module
    // ids, labels, storage keys and navigation tables stay single-owned by
    // @/features/dashboard/config and @/features/dashboard/application.
    const residue = withoutComments
      .replace(
        /export\s*(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*["'][^"']+["']\s*;/g,
        "",
      )
      .trim();

    assert.equal(
      residue,
      "",
      `${barrel} must only re-export; found a non re-export statement: ${residue.slice(0, 200)}`,
    );
  }
});
