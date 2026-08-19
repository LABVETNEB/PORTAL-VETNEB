import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";

// ─────────────────────────────────────────────────────────────────────────────
// B04 · Dashboard surface token migration + persistent-chrome elevation (G6).
//
// B03 declared a dashboard foundation nothing consumed. B04 migrated the first
// surfaces onto it and retired the elevation of the persistent chrome, which is
// gate G6 of the audit: "Sin sombra en chrome persistente", required before B11.
//
// G6 is NOT "the string box-shadow appears zero times in the repo". The audit is
// precise about which shadows carry meaning (§9.1, §45.2):
//
//   PERSISTENT_CHROME        the bands that stay around the data across a module
//                            change. Elevation MUST be none.
//   STATIC_CONTENT_SURFACE   content on the canvas. Flat by default; §45.2 rules
//                            the "tarjeta elevada" level out of the dashboard.
//   TRANSIENT_OVERLAY        menu / dialog / drawer. Elevation is MEANING here
//                            and must survive — a gate that flattened these
//                            would be measuring the wrong thing.
//   FOCUS_INDICATOR          a ring drawn with box-shadow. Never elevation, and
//                            never removable: it is the visible focus state.
//
// This contract is fail-closed in both directions. Every entry below names a
// real file and a real source anchor; a missing anchor fails, a rule that stops
// consuming its expected token fails, a persistent-chrome anchor that regains an
// elevation literal fails, and a transient overlay that LOSES its shadow fails
// too. The manifest is compared against source read from disk, never against a
// second hand-written list.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const TOKENS_CSS_PATH = "frontend/src/styles/dashboard/tokens.css";
const DASHBOARD_CSS_DIR = "frontend/src/styles/dashboard";
const DASHBOARD_COMPONENTS_DIR = "frontend/src/components/dashboard";
const DASHBOARD_APP_DIR = "frontend/src/app/dashboard";

const LAYOUT_CSS = "frontend/src/styles/dashboard/layout.css";
const SURFACES_CSS = "frontend/src/styles/dashboard/surfaces.css";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";
const SHELL_CSS = "frontend/src/styles/dashboard/shell.css";
const MOBILE_ADMIN_CSS = "frontend/src/styles/dashboard/mobile-admin.css";
const MOBILE_CLINIC_CSS = "frontend/src/styles/dashboard/mobile-clinic.css";

const TOPBAR_TSX = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const FILTER_BAR_TSX = "frontend/src/components/dashboard/FilterBar.tsx";
const STICKY_ACTION_BAR_TSX =
  "frontend/src/components/dashboard/StickyActionBar.tsx";

const ELEVATION_NONE = "var(--dash-elevation-none)";

// Frozen by B03 and re-verified here: B04 may rewrite the foundation's PROSE
// (its comments describe a migration that has now happened) but not one of its
// declarations. Both hashes use the method B03 documented: the block from the
// start of its `:start` comment line through the closing marker, normalised to
// LF; the pitch hash is over the raw block, the foundation hash over the block
// with comments stripped and whitespace normalised.
const FOUNDATION_DECLARATION_HASH =
  "3f192d6d31f836f724b4b62e30f211594ee7e344e9f60a0e79113d0f2ac75828";
// A05–A07 capacity contract. Byte-identical since B03; B04 touches no capacity.
const ROW_PITCH_RAW_HASH =
  "f76d889cc2a19a10ac45abb7cb709ffaada744aca553c81e7010b3fd65044093";

type SurfaceRole =
  | "PERSISTENT_CHROME"
  | "STATIC_CONTENT_SURFACE"
  | "TRANSIENT_OVERLAY"
  | "FOCUS_INDICATOR";

type ElevationPolicy =
  /** Must resolve to `var(--dash-elevation-none)`. */
  | "none"
  /** Must KEEP a shadow: flattening it would be a G6 over-reach. */
  | "retained";

type ManifestEntry = {
  readonly path: string;
  /** Verbatim source anchor. Must occur exactly once, and opens the rule read. */
  readonly anchor: string;
  readonly role: SurfaceRole;
  /** Foundation tokens the rule must consume. */
  readonly expectedTokens: readonly string[];
  readonly elevation: ElevationPolicy;
  readonly why: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// The normative manifest.
// ─────────────────────────────────────────────────────────────────────────────

const MANIFEST: readonly ManifestEntry[] = [
  // ── Persistent chrome ─────────────────────────────────────────────────────
  {
    path: LAYOUT_CSS,
    // Disambiguated from the `max-width: 767px` override of the same
    // pseudo-element, which restates only `inset` and `border-radius`.
    anchor: '.dashboard-app-shell::before {\n    content: "";',
    role: "PERSISTENT_CHROME",
    expectedTokens: ["--dash-elevation-none"],
    elevation: "none",
    why: "outermost shell frame; the audit's first content-first requirement",
  },
  {
    path: LAYOUT_CSS,
    anchor: '.dashboard-module-tab[aria-selected="true"] {',
    role: "PERSISTENT_CHROME",
    expectedTokens: ["--dash-color-on-primary", "--dash-elevation-none"],
    elevation: "none",
    why: "the module tab strip stays around the data across a tab change",
  },
  {
    path: SURFACES_CSS,
    anchor: '[data-dashboard-topbar-polish="true"] {',
    role: "PERSISTENT_CHROME",
    expectedTokens: ["--dash-elevation-none"],
    elevation: "none",
    why: "the topbar band named by P2-02",
  },
  {
    path: SURFACES_CSS,
    anchor: '[data-dashboard-sidebar-polish="true"] {',
    role: "PERSISTENT_CHROME",
    expectedTokens: ["--dash-elevation-none"],
    elevation: "none",
    why: "sidebar band anchor; no runtime consumer since B02, still authored",
  },
  {
    path: SURFACES_CSS,
    anchor:
      '.dashboard-app-shell [data-dashboard-horizontal-nav-shell="true"],',
    role: "PERSISTENT_CHROME",
    expectedTokens: ["--dash-elevation-none"],
    elevation: "none",
    why: "the B04 block: chrome anchors that never declared elevation now state none",
  },
  // ── Static content surfaces ───────────────────────────────────────────────
  {
    path: NAVIGATION_CSS,
    anchor: ".dashboard-master-panel {",
    role: "STATIC_CONTENT_SURFACE",
    expectedTokens: ["--dash-elevation-none"],
    elevation: "none",
    why: "audit §45.2 rules the elevated card out of the dashboard",
  },
  {
    path: SHELL_CSS,
    // Disambiguated from the `min-width: 1024px` override of the same class,
    // which restates only `height` and `overflow`.
    anchor: ".dashboard-cockpit-launcher {\n    display: flex;",
    role: "STATIC_CONTENT_SURFACE",
    expectedTokens: ["--dash-shape-2xl", "--dash-elevation-none"],
    elevation: "none",
    why: "the admin hub launcher is content on the canvas",
  },
  {
    path: SHELL_CSS,
    anchor: ".dashboard-cockpit-tile {",
    role: "STATIC_CONTENT_SURFACE",
    expectedTokens: ["--dash-shape-xl", "--dash-elevation-none"],
    elevation: "none",
    why: "the admin hub module tiles",
  },
  // ── Transient overlays: elevation is meaning, and must survive G6 ─────────
  {
    path: NAVIGATION_CSS,
    anchor: ".dashboard-filter-panel {",
    role: "TRANSIENT_OVERLAY",
    expectedTokens: [],
    elevation: "retained",
    why: "the lateral filter drawer: a directional shadow, not a chrome band",
  },
  {
    path: MOBILE_ADMIN_CSS,
    anchor: '[data-vetneb-app-shell-surface="admin"] .admin-mobile-kebab-menu {',
    role: "TRANSIENT_OVERLAY",
    expectedTokens: [],
    elevation: "retained",
    why: "the admin mobile kebab menu",
  },
  {
    path: MOBILE_ADMIN_CSS,
    anchor:
      '[data-vetneb-app-shell-surface="admin"] .admin-mobile-module-menu {',
    role: "TRANSIENT_OVERLAY",
    expectedTokens: [],
    elevation: "retained",
    why: "the admin mobile module menu",
  },
  // ── Focus indicators: never elevation, never removable ────────────────────
  {
    path: NAVIGATION_CSS,
    anchor: ".dashboard-module-rail-tab:focus-visible {",
    role: "FOCUS_INDICATOR",
    expectedTokens: ["--dash-color-surface"],
    elevation: "retained",
    why: "the two-ring focus state on the module rail tabs",
  },
  {
    path: MOBILE_CLINIC_CSS,
    anchor: ".clinic-mobile-bottom-nav-item:focus-visible {",
    role: "FOCUS_INDICATOR",
    expectedTokens: [],
    elevation: "retained",
    why: "the focus state on the clinic mobile bottom nav",
  },
];

/**
 * Chrome COMPONENTS whose elevation came from a Tailwind utility rather than a
 * CSS rule. §16 of the B04 brief: closing one source is not closing the shadow —
 * a `shadow-*` utility on the same element wins over `@layer components`, so the
 * utility is removed at the component AND the anchor states none.
 */
const CHROME_COMPONENTS = [
  {
    path: TOPBAR_TSX,
    chromeClassName:
      '"sticky top-0 z-40 flex shrink-0 flex-col border-b border-vetneb-line/80 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/78"',
    why: "topbar band",
  },
  {
    path: FILTER_BAR_TSX,
    // B05 removed the container fill (`bg-card/82`) as part of the surface
    // inversion (roadmap §49/§54): the tint moved to each field via
    // `--dash-color-field`, asserted by
    // `test/architecture/dashboard-b05-surface-inversion.test.ts`. The pin
    // here still exists to prove no shadow utility comes back on this anchor.
    chromeClassName:
      '"grid grid-cols-1 items-end gap-3 rounded-xl border border-vetneb-line/75 p-3"',
    why: "persistent filter toolbar (comfortable density)",
  },
  {
    path: STICKY_ACTION_BAR_TSX,
    chromeClassName:
      '"pointer-events-none fixed inset-x-0 bottom-0 z-50 border-t border-vetneb-line/80 bg-card/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:pointer-events-auto md:sticky md:top-[4.75rem] md:bottom-auto md:rounded-lg md:border md:px-4 md:py-3"',
    why: "persistent action bar (fixed on mobile, sticky from md)",
  },
] as const;

/**
 * SCOPE NOTE — what the component check covers.
 *
 * It reads the className each component applies to the CHROME ELEMENT ITSELF.
 * Interactive controls NESTED inside that chrome (the logout button, the
 * notifications bell, the rail arrows, the pager buttons) carry a 1px
 * `shadow-sm` / `shadow-[0_1px_2px_…]` hairline that reads as a border
 * substitute on a control, not as a level of the elevation scale. B04 migrates
 * SURFACES; those control hairlines are enumerated in
 * `docs/implementation/dashboard-b04-surface-token-migration.md` as deliberately
 * out of scope, so they are neither silently flattened here nor silently
 * forgotten.
 */

/**
 * Every persistent-chrome anchor the runtime observes, mirrored from
 * `frontend/e2e/helpers/dashboard-geometry-matrix.ts` (SHELL_SELECTORS) plus the
 * two bars. Kept here so the static and runtime gates cannot drift into policing
 * different inventories.
 */
const PERSISTENT_CHROME_ANCHORS = [
  '[data-dashboard-topbar-polish="true"]',
  '[data-dashboard-horizontal-nav-shell="true"]',
  "[data-dashboard-module-rail]",
  '[data-dashboard-filter-bar="true"]',
  '[data-sticky-action-bar="true"]',
  '[data-admin-mobile-bottom-nav="true"]',
  '[data-clinic-mobile-bottom-nav="true"]',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readSource(repoRelativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, repoRelativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** The declaration body that follows `anchor`, up to its matching brace. */
function ruleBody(source: string, anchor: string): string {
  const start = source.indexOf(anchor);
  assert.notEqual(start, -1, `anchor not found: ${anchor}`);

  // The anchor may be one selector of a group; walk forward to the real `{`.
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, `no rule opens after: ${anchor}`);

  let depth = 1;
  let index = open + 1;
  while (index < source.length && depth > 0) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") depth -= 1;
    index += 1;
  }
  return source.slice(open + 1, index - 1);
}

function boxShadowOf(body: string): string | null {
  const match = /box-shadow\s*:([^;]*);/.exec(stripComments(body));
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function collectFilesRecursive(
  repoRelativeDir: string,
  extensions: RegExp,
): string[] {
  const absoluteDir = resolve(REPO_ROOT, repoRelativeDir);
  const found: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const absoluteEntry = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      found.push(
        ...collectFilesRecursive(
          relative(REPO_ROOT, absoluteEntry).replace(/\\/g, "/"),
          extensions,
        ),
      );
      continue;
    }
    if (entry.isFile() && extensions.test(entry.name)) {
      found.push(relative(REPO_ROOT, absoluteEntry).replace(/\\/g, "/"));
    }
  }

  return found;
}

/** B03's documented block slice: `:start` line through the closing `:end` tag. */
function markedBlock(source: string, name: string): string {
  const startMarker = source.indexOf(`${name}:start`);
  const endMarker = source.indexOf(`${name}:end`);
  assert.notEqual(startMarker, -1, `${name}:start missing`);
  assert.notEqual(endMarker, -1, `${name}:end missing`);
  const lineStart = source.lastIndexOf("\n", startMarker) + 1;
  const blockEnd = source.indexOf("*/", endMarker) + 2;
  return source.slice(lineStart, blockEnd);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const TOKENS_CSS = readSource(TOKENS_CSS_PATH);

// ─────────────────────────────────────────────────────────────────────────────
// T0 · the manifest itself is real.
// ─────────────────────────────────────────────────────────────────────────────

test("every manifest anchor resolves to exactly one rule in real source", () => {
  assert.ok(MANIFEST.length > 0, "the manifest must not be empty");

  for (const entry of MANIFEST) {
    const source = readSource(entry.path);
    const occurrences = source.split(entry.anchor).length - 1;
    assert.equal(
      occurrences,
      1,
      `${entry.path}: anchor "${entry.anchor}" occurs ${occurrences}x — the manifest must address exactly one rule`,
    );
  }
});

test("the manifest covers every classification B04 makes claims about", () => {
  const roles = new Set(MANIFEST.map((entry) => entry.role));
  const required: readonly SurfaceRole[] = [
    "PERSISTENT_CHROME",
    "STATIC_CONTENT_SURFACE",
    "TRANSIENT_OVERLAY",
    "FOCUS_INDICATOR",
  ];

  for (const role of required) {
    assert.ok(
      roles.has(role),
      `no manifest entry classifies anything as ${role}; a gate that only lists what it flattens cannot prove it did not over-reach`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T1–T2 · the migrated rules really consume the foundation.
// ─────────────────────────────────────────────────────────────────────────────

test("every migrated rule consumes the tokens the manifest expects", () => {
  for (const entry of MANIFEST) {
    if (entry.expectedTokens.length === 0) continue;
    const body = stripComments(ruleBody(readSource(entry.path), entry.anchor));

    for (const token of entry.expectedTokens) {
      assert.ok(
        new RegExp(`${token}(?![\\w-])`).test(body),
        `${entry.path} · ${entry.anchor}: expected to consume "${token}" (${entry.why}), but the rule does not reference it. Reverting a migrated selector to its raw legacy value is exactly what this asserts against`,
      );
    }
  }
});

test("B04 consumes elevation, colour and shape, not one scale", () => {
  const consumed = new Set(
    MANIFEST.flatMap((entry) => entry.expectedTokens).map((token) =>
      // "--dash-color-surface" splits to ["", "", "dash", "color", "surface"]:
      // the leading "--" contributes two empty segments.
      token.split("-").slice(0, 4).join("-"),
    ),
  );

  for (const category of ["--dash-elevation", "--dash-color", "--dash-shape"]) {
    assert.ok(
      consumed.has(category),
      `the manifest expects no "${category}" consumer; B04 migrates surfaces across colour, shape and elevation`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T3–T5 · G6. Persistent chrome resolves to elevation none, from every source.
// ─────────────────────────────────────────────────────────────────────────────

test("no persistent-chrome or static-surface rule declares an elevation literal", () => {
  for (const entry of MANIFEST) {
    if (entry.elevation !== "none") continue;
    const shadow = boxShadowOf(ruleBody(readSource(entry.path), entry.anchor));

    assert.equal(
      shadow,
      ELEVATION_NONE,
      `${entry.path} · ${entry.anchor}: box-shadow is "${shadow}", expected "${ELEVATION_NONE}". Gate G6 requires the persistent chrome to STATE flatness, so a raw offset/blur/colour triple here — or a raised/menu/dialog level — fails`,
    );
  }
});

test("no persistent-chrome component carries a shadow utility", () => {
  // Tailwind utilities resolve in `@layer utilities` and beat the
  // `@layer components` rules the CSS anchors live in, so stating
  // `--dash-elevation-none` there is not enough on its own: §16 requires BOTH
  // sources closed, or a cascade or responsive variant restores the shadow.
  const SHADOW_UTILITY = /(^|[\s:"])shadow-(sm|md|lg|xl|2xl|inner|\[[^\]]*\])(?![\w-])/;

  for (const component of CHROME_COMPONENTS) {
    const occurrences =
      readSource(component.path).split(component.chromeClassName).length - 1;

    // Pinning the WHOLE className means a shadow utility cannot come back
    // without this failing, and neither can a silent restyle of the band.
    assert.equal(
      occurrences,
      1,
      `${component.path}: the pinned chrome className for the ${component.why} occurs ${occurrences}x. B04 froze it flat; if it legitimately changed, realign this manifest rather than dropping the pin`,
    );

    assert.ok(
      !SHADOW_UTILITY.test(component.chromeClassName),
      `${component.path}: the pinned className for the ${component.why} still carries a shadow utility — ${component.chromeClassName}`,
    );
  }
});

test("every persistent-chrome anchor is addressed by the elevation policy", () => {
  const dashboardCss = collectFilesRecursive(DASHBOARD_CSS_DIR, /\.css$/)
    .map((path) => readSource(path))
    .join("\n");

  for (const anchor of PERSISTENT_CHROME_ANCHORS) {
    assert.ok(
      dashboardCss.includes(anchor),
      `no dashboard CSS mentions the persistent-chrome anchor ${anchor}; every chrome band must be addressable by the elevation policy, not merely happen to have no shadow`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 · G6 did not over-reach. Overlays and focus rings keep their shadow.
// ─────────────────────────────────────────────────────────────────────────────

test("transient overlays and focus indicators keep a real shadow", () => {
  for (const entry of MANIFEST) {
    if (entry.elevation !== "retained") continue;
    const shadow = boxShadowOf(ruleBody(readSource(entry.path), entry.anchor));

    assert.ok(
      shadow !== null,
      `${entry.path} · ${entry.anchor}: box-shadow disappeared. ${entry.role} is not persistent chrome — G6 retires elevation from the bands around the data, and removing this one is an over-reach, not a closure`,
    );
    assert.notEqual(
      shadow,
      ELEVATION_NONE,
      `${entry.path} · ${entry.anchor}: flattened to elevation none. ${entry.why} needs its shadow: for an overlay it is the level, for a focus ring it is the visible focus state`,
    );
  }
});

test("no migrated selector reintroduces a raw shadow next to its token", () => {
  for (const entry of MANIFEST) {
    if (entry.elevation !== "none") continue;
    const body = stripComments(ruleBody(readSource(entry.path), entry.anchor));
    const shadows = body.match(/box-shadow\s*:/g) ?? [];

    assert.equal(
      shadows.length,
      1,
      `${entry.path} · ${entry.anchor}: ${shadows.length} box-shadow declarations. A second one is how a retired elevation comes back while the first still reads as flat`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 · B05 field token consumption is confined to its canonical path.
//
// B05 started consuming `--dash-color-field` (roadmap §49/§54: "campo teñido,
// contenedor transparente"). This test no longer asserts zero consumers — that
// claim became false the moment B05 shipped, and a test that still made it
// would be lying about the current state of the tree. What replaces it is the
// same two-sided shape T8 already uses for the foundation as a whole: exactly
// one file may consume the role, and every other file in the same census may
// not. `test/architecture/dashboard-b05-surface-inversion.test.ts` owns the
// full B05 manifest (the rule's declaration, its selectors, dual-theme
// resolution); this test stays here because it walks the same B04 census this
// file already collects.
// ─────────────────────────────────────────────────────────────────────────────

const B05_FIELD_TOKEN_CANONICAL_PATH = SURFACES_CSS;

test("the B05 field token has exactly one runtime consumer", () => {
  const sources = [
    ...collectFilesRecursive(DASHBOARD_CSS_DIR, /\.css$/),
    ...collectFilesRecursive(DASHBOARD_COMPONENTS_DIR, /\.(ts|tsx)$/),
    ...collectFilesRecursive(DASHBOARD_APP_DIR, /\.(ts|tsx)$/),
  ].filter((path) => path !== TOKENS_CSS_PATH);

  assert.ok(sources.length > 0, "the B05 consumer census must find files");

  const consumers = sources.filter((path) =>
    /--dash-color-field(?![\w-])/.test(stripComments(readSource(path))),
  );

  assert.deepEqual(
    consumers,
    [B05_FIELD_TOKEN_CANONICAL_PATH],
    `expected the sole runtime consumer of --dash-color-field to be ${B05_FIELD_TOKEN_CANONICAL_PATH}; found ${JSON.stringify(consumers)}. A second consumer duplicates the single source of truth for the field tint; zero consumers means the B05 inversion was reverted`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T8–T9 · the B03 foundation and the A05–A07 capacity contract survive intact.
// ─────────────────────────────────────────────────────────────────────────────

test("B04 changes no foundation declaration", () => {
  const declarations = markedBlock(TOKENS_CSS, "dashboard-foundation-tokens")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};:,])\s*/g, "$1")
    .trim();

  assert.equal(
    sha256(declarations),
    FOUNDATION_DECLARATION_HASH,
    "a foundation declaration changed. B04 CONSUMES the B03 foundation and may rewrite only its prose; redesigning a token here would move the work back to B03 and invalidate the dual-theme proof that shipped with it",
  );
});

test("B04 changes no byte of the row pitch contract", () => {
  assert.equal(
    sha256(markedBlock(TOKENS_CSS, "dashboard-row-pitch-contract")),
    ROW_PITCH_RAW_HASH,
    "the A05–A07 capacity contract changed. B04 is a visual migration: it touches elevation, colour and shape, never the pitch the capacity engine reads back",
  );
});
