import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

// B03 · dashboard design-system foundation contract.
//
// B03 declares the foundation; B04 migrates the surfaces onto it. That split is
// the whole reason this file exists: a foundation is only reviewable while the
// scales are complete AND nothing consumes them yet, because the moment a
// surface adopts a token the migration and the definition become one
// indistinguishable diff.
//
// The contract is deliberately two-way. A schema on its own would pass while
// the CSS drifted; a census on its own would pass while a required role
// vanished. So the normative schema below is compared against the tokens
// physically parsed out of tokens.css in BOTH directions — a missing role fails
// and an undeclared extra fails.
//
// Dark completeness is asserted by resolution, not by counting lines. Before
// B03 the entire styles/dashboard tree contained zero `data-theme` rules (R9:
// "tema oscuro sin cubrir"), and the naive fix — restating every token under a
// dark selector — would have produced a scale that looks covered and is in fact
// a second place to drift. Instead each token declares how it reaches its dark
// value, and the contract proves that claim:
//
//   INVARIANT  same value in both themes; must NOT appear in the dark scope,
//              and must not secretly reference a token the dark theme rewrites.
//   ADAPTIVE   one declaration referencing a global token that globals.css
//              itself redefines under `:root[data-theme="dark-gray"]`. The
//              reference is resolved here: if globals.css ever stops rewriting
//              that token, the dashboard role silently loses its dark value and
//              this fails.
//   VARIANT    declared in BOTH scopes with values that must actually differ.

const REPO_ROOT = process.cwd();

const TOKENS_CSS_PATH = "frontend/src/styles/dashboard/tokens.css";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const DASHBOARD_CSS_DIR = "frontend/src/styles/dashboard";
const FRONTEND_SRC = "frontend/src";
const THEME_MODULE_PATH = "frontend/src/lib/theme.ts";
const THEME_INIT_PATH = "frontend/public/theme-init.js";

/**
 * B04 consumer boundary.
 *
 * B03 shipped with "zero consumers outside tokens.css", which was true exactly
 * once: it was the proof that B03 defined and did not migrate. B04 migrated the
 * first surfaces, so that assertion had to be REPLACED, never deleted, skipped
 * or relaxed to "there is some consumer" — either of those would drop the only
 * guard that keeps a dashboard-scoped foundation from leaking onto the public
 * surface, where none of these tokens is declared and every one of them would
 * resolve to nothing.
 *
 * The replacement is a two-sided boundary:
 *
 *   1. Consumption is real   — at least one consumer exists (T8a), so a silent
 *                              revert of B04 cannot pass as "still fine".
 *   2. Consumption is penned — every consumer is under one of the prefixes
 *                              below (T8b), all of which render inside
 *                              `.dashboard-app-shell`, the only element where
 *                              the foundation is declared.
 *
 * `--dash-color-field` is excluded from both and asserted separately (T8c): it
 * is the B05 target, and since B05 shipped its consumption is confined to
 * exactly one canonical path rather than left at zero.
 */
const B04_CONSUMER_PREFIXES = [
  "frontend/src/styles/dashboard/",
  "frontend/src/components/dashboard/",
  "frontend/src/app/dashboard/",
] as const;

/**
 * B05 (tint moves to the field, container goes transparent). The token is
 * declared for both themes in tokens.css since B03; the single legal runtime
 * consumer is the field-inversion rule B05 added in surfaces.css. Any other
 * consumer — including inside the B04-allowed prefixes above — duplicates the
 * single source of truth for the field tint.
 */
const B05_FIELD_TOKEN = "--dash-color-field";
const B05_FIELD_TOKEN_CANONICAL_PATH =
  "frontend/src/styles/dashboard/surfaces.css";

const FOUNDATION_START = "/* dashboard-foundation-tokens:start";
const FOUNDATION_END = "dashboard-foundation-tokens:end */";
const PITCH_START = "/* dashboard-row-pitch-contract:start";
const PITCH_END = "dashboard-row-pitch-contract:end */";

const LIGHT_SCOPE = ".dashboard-app-shell";

/** Capacity tokens owned by the pitch contract (A05–A07). Never re-owned here. */
const CAPACITY_OWNED_TOKENS = [
  "--dash-row-pitch",
  "--dash-row-gap",
  "--dash-canvas-reserved",
  "--dash-table-head-h",
] as const;

type ThemeClass = "INVARIANT" | "ADAPTIVE" | "VARIANT";

interface CategorySchema {
  readonly prefix: string;
  readonly minimum: number;
  readonly tokens: Readonly<Record<string, ThemeClass>>;
}

/**
 * The eight required scales. `minimum` is asserted separately from the roster
 * so that trimming a category below a usable cardinality fails even if the
 * roster was trimmed to match.
 */
const FOUNDATION_SCHEMA: Readonly<Record<string, CategorySchema>> =
  Object.freeze({
    color: {
      prefix: "--dash-color-",
      minimum: 12,
      tokens: {
        "--dash-color-canvas": "ADAPTIVE",
        "--dash-color-surface": "ADAPTIVE",
        "--dash-color-surface-raised": "ADAPTIVE",
        "--dash-color-surface-muted": "ADAPTIVE",
        "--dash-color-on-surface": "ADAPTIVE",
        "--dash-color-on-surface-muted": "ADAPTIVE",
        "--dash-color-outline": "ADAPTIVE",
        "--dash-color-outline-subtle": "ADAPTIVE",
        "--dash-color-primary": "ADAPTIVE",
        // globals.css declares --primary-foreground as the byte-identical
        // "190 36% 97%" in both :root and :root[data-theme="dark-gray"], so
        // the token's EFFECTIVE value never adapts — resolving it
        // transitively (rather than checking that the direct reference merely
        // appears under the dark selector) is what surfaces this: it is
        // INVARIANT, not ADAPTIVE.
        "--dash-color-on-primary": "INVARIANT",
        "--dash-color-accent": "ADAPTIVE",
        "--dash-color-success": "ADAPTIVE",
        "--dash-color-error": "ADAPTIVE",
        "--dash-color-info": "ADAPTIVE",
        "--dash-color-focus-ring": "ADAPTIVE",
        "--dash-color-field": "VARIANT",
        "--dash-color-warning": "VARIANT",
        "--dash-color-overlay-scrim": "VARIANT",
      },
    },
    shape: {
      prefix: "--dash-shape-",
      minimum: 6,
      tokens: {
        "--dash-shape-none": "INVARIANT",
        "--dash-shape-xs": "INVARIANT",
        "--dash-shape-sm": "INVARIANT",
        "--dash-shape-md": "INVARIANT",
        "--dash-shape-lg": "INVARIANT",
        "--dash-shape-xl": "INVARIANT",
        "--dash-shape-2xl": "INVARIANT",
        "--dash-shape-full": "INVARIANT",
      },
    },
    elevation: {
      prefix: "--dash-elevation-",
      minimum: 4,
      tokens: {
        "--dash-elevation-none": "INVARIANT",
        "--dash-elevation-raised": "ADAPTIVE",
        "--dash-elevation-menu": "ADAPTIVE",
        "--dash-elevation-dialog": "ADAPTIVE",
      },
    },
    "state-layer": {
      prefix: "--dash-state-",
      minimum: 5,
      tokens: {
        "--dash-state-hover-opacity": "VARIANT",
        "--dash-state-pressed-opacity": "VARIANT",
        "--dash-state-selected-opacity": "VARIANT",
        "--dash-state-focus-opacity": "VARIANT",
        "--dash-state-layer-color": "VARIANT",
        "--dash-state-disabled-opacity": "INVARIANT",
      },
    },
    spacing: {
      prefix: "--dash-space-",
      minimum: 6,
      tokens: {
        "--dash-space-0": "INVARIANT",
        "--dash-space-1": "INVARIANT",
        "--dash-space-2": "INVARIANT",
        "--dash-space-3": "INVARIANT",
        "--dash-space-4": "INVARIANT",
        "--dash-space-5": "INVARIANT",
        "--dash-space-6": "INVARIANT",
      },
    },
    density: {
      prefix: "--dash-density-",
      minimum: 4,
      tokens: {
        "--dash-density-control-compact": "INVARIANT",
        "--dash-density-control-regular": "INVARIANT",
        "--dash-density-control-comfortable": "INVARIANT",
        "--dash-density-inset-compact": "INVARIANT",
        "--dash-density-inset-regular": "INVARIANT",
        "--dash-density-inset-comfortable": "INVARIANT",
      },
    },
    typography: {
      prefix: "--dash-text-",
      minimum: 10,
      tokens: {
        "--dash-text-family": "INVARIANT",
        "--dash-text-label-size": "INVARIANT",
        "--dash-text-label-weight": "INVARIANT",
        "--dash-text-label-leading": "INVARIANT",
        "--dash-text-label-tracking": "INVARIANT",
        "--dash-text-body-size": "INVARIANT",
        "--dash-text-body-weight": "INVARIANT",
        "--dash-text-body-leading": "INVARIANT",
        "--dash-text-body-strong-weight": "INVARIANT",
        "--dash-text-section-size": "INVARIANT",
        "--dash-text-section-weight": "INVARIANT",
        "--dash-text-section-leading": "INVARIANT",
        "--dash-text-section-tracking": "INVARIANT",
        "--dash-text-title-size": "INVARIANT",
        "--dash-text-title-weight": "INVARIANT",
        "--dash-text-title-leading": "INVARIANT",
        "--dash-text-metric-size": "INVARIANT",
        "--dash-text-metric-weight": "INVARIANT",
        "--dash-text-metric-leading": "INVARIANT",
      },
    },
    motion: {
      prefix: "--dash-motion-",
      minimum: 4,
      tokens: {
        "--dash-motion-fast": "INVARIANT",
        "--dash-motion-standard": "INVARIANT",
        "--dash-motion-slow": "INVARIANT",
        "--dash-motion-ease-standard": "INVARIANT",
        "--dash-motion-ease-emphasized": "INVARIANT",
      },
    },
  });

const SCHEMA_ENTRIES: ReadonlyArray<readonly [string, ThemeClass]> =
  Object.values(FOUNDATION_SCHEMA).flatMap((category) =>
    Object.entries(category.tokens).map(
      ([token, themeClass]) => [token, themeClass] as const,
    ),
  );

const SCHEMA_TOKENS: readonly string[] = SCHEMA_ENTRIES.map(([token]) => token);

function readSource(repoRelativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, repoRelativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

/**
 * Strips comments so the contract is asserted against DECLARATIONS.
 *
 * tokens.css documents the very things it forbids — the density section names
 * `--dash-row-pitch*` to explain why row height is not a density token, the
 * motion section names the height properties R11 bans — so a naive text scan
 * fails on the prose that exists to prevent the violation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ");
}

function sliceBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing block marker: ${startMarker}`);
  // Searched from the opening marker, never from the file head: the dark
  // palette block closes on a bare "}", and the first one in globals.css
  // belongs to a rule hundreds of lines earlier.
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing block marker: ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

const TOKENS_CSS = readSource(TOKENS_CSS_PATH);
const GLOBALS_CSS = readSource(GLOBALS_CSS_PATH);

const FOUNDATION_BLOCK = sliceBlock(TOKENS_CSS, FOUNDATION_START, FOUNDATION_END);
const PITCH_BLOCK = sliceBlock(TOKENS_CSS, PITCH_START, PITCH_END);

/** Rule bodies inside the foundation, keyed by selector, comments removed. */
function parseRules(block: string): Map<string, string> {
  const rules = new Map<string, string>();
  for (const match of stripComments(block).matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    assert.ok(
      !rules.has(selector),
      `the foundation declares the selector "${selector}" twice`,
    );
    rules.set(selector, match[2]);
  }
  return rules;
}

function parseDeclarations(body: string): Array<readonly [string, string]> {
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(
    (match) => [match[1], match[2].trim()] as const,
  );
}

const FOUNDATION_RULES = parseRules(FOUNDATION_BLOCK);

const DARK_THEME_MODE = (() => {
  const match = readSource(THEME_MODULE_PATH).match(
    /export const DARK_GRAY_THEME_MODE = "([^"]+)";/,
  );
  assert.ok(match, `${THEME_MODULE_PATH}: DARK_GRAY_THEME_MODE must stay identifiable`);
  return match[1];
})();

const DARK_SCOPE = `:root[data-theme="${DARK_THEME_MODE}"] ${LIGHT_SCOPE}`;

function declarationsFor(selector: string): Map<string, string> {
  const body = FOUNDATION_RULES.get(selector);
  assert.ok(body !== undefined, `the foundation must declare the scope "${selector}"`);
  const map = new Map<string, string>();
  for (const [token, value] of parseDeclarations(body)) {
    assert.ok(
      !map.has(token),
      `"${token}" is declared twice inside the same scope "${selector}"`,
    );
    map.set(token, value);
  }
  return map;
}

const LIGHT_DECLARATIONS = declarationsFor(LIGHT_SCOPE);
const DARK_DECLARATIONS = declarationsFor(DARK_SCOPE);

function referencedTokens(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((match) => match[1]);
}

/**
 * Every `selector { … }` rule in a stylesheet whose selector matches exactly.
 * Collected as a list because globals.css opens `:root` more than once (the
 * palette under `@layer base`, and a later unlayered `color-scheme` rule).
 */
function ruleBodies(source: string, selector: string): string[] {
  const bodies: string[] = [];
  for (const match of stripComments(source).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].trim().replace(/\s+/g, " ") === selector) bodies.push(match[2]);
  }
  return bodies;
}

function declarationEnv(sources: readonly string[]): Map<string, string> {
  const env = new Map<string, string>();
  for (const body of sources) {
    for (const [token, value] of parseDeclarations(body)) env.set(token, value);
  }
  return env;
}

const GLOBALS_LIGHT = ruleBodies(GLOBALS_CSS, ":root");
const GLOBALS_DARK = ruleBodies(
  GLOBALS_CSS,
  `:root[data-theme="${DARK_THEME_MODE}"]`,
);

/**
 * The two environments a dashboard token actually resolves in. Dark is the
 * light environment with the dark overrides applied on top, which is precisely
 * what the cascade does: `:root[data-theme="dark-gray"]` re-declares a subset
 * and everything else keeps its light declaration.
 */
const LIGHT_ENV: ReadonlyMap<string, string> = declarationEnv([
  ...GLOBALS_LIGHT,
  ...[...LIGHT_DECLARATIONS].map(([token, value]) => `${token}: ${value};`),
]);

const DARK_ENV: ReadonlyMap<string, string> = declarationEnv([
  ...GLOBALS_LIGHT,
  ...GLOBALS_DARK,
  ...[...LIGHT_DECLARATIONS].map(([token, value]) => `${token}: ${value};`),
  ...[...DARK_DECLARATIONS].map(([token, value]) => `${token}: ${value};`),
]);

/**
 * Structural fingerprint of a custom property's EFFECTIVE value in one
 * environment, resolved through the whole `var()` chain.
 *
 * Comparing declarations directly is not enough, and this is the exact hole the
 * first version of this contract had: `--dash-color-focus-ring` points at
 * `--clinical-focus-ring`, which globals.css re-declares under the dark
 * selector as the byte-identical `hsl(var(--ring) / 0.85)`. The theme change
 * happens one level deeper, in `--ring`. A check that stopped at "the directly
 * referenced token appears in the dark block" therefore reported the role as
 * covered while deleting the dark `--ring` override would have handed the
 * dashboard its LIGHT focus ring in dark mode with the guard still green.
 *
 * The fingerprint carries each level's raw declaration plus its children, so
 * two environments differ if ANY node along the chain differs — no CSS value
 * engine required, and no colour arithmetic to get wrong.
 */
function resolveThemeFingerprint(
  token: string,
  env: ReadonlyMap<string, string>,
  stack: readonly string[] = [],
): string {
  if (stack.includes(token)) {
    // Deterministic failure, not a stack overflow: a cycle has no effective
    // value, so neither theme can be proven and the contract must say so.
    throw new Error(
      `custom property cycle: ${[...stack, token].join(" -> ")}`,
    );
  }

  const declaration = env.get(token);
  if (declaration === undefined) {
    // An unresolvable reference is NOT an invariant value. Treating it as one
    // is how a typo would silently downgrade a themed role to "same in both".
    throw new Error(
      `unresolved custom property "${token}"${
        stack.length > 0 ? ` (via ${stack.join(" -> ")})` : ""
      }`,
    );
  }

  const children = referencedTokens(declaration).map((reference) =>
    resolveThemeFingerprint(reference, env, [...stack, token]),
  );

  return `${token}{${declaration}}[${children.join(",")}]`;
}

function fingerprints(token: string): { light: string; dark: string } {
  return {
    light: resolveThemeFingerprint(token, LIGHT_ENV),
    dark: resolveThemeFingerprint(token, DARK_ENV),
  };
}

function collectFilesRecursive(repoRelativeDir: string, extensions: RegExp): string[] {
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

// ─────────────────────────────────────────────────────────────────────────────
// T1–T2 · the eight scales exist and carry a usable cardinality.
// ─────────────────────────────────────────────────────────────────────────────

test("the foundation declares all eight required scales", () => {
  assert.deepEqual(
    Object.keys(FOUNDATION_SCHEMA),
    [
      "color",
      "shape",
      "elevation",
      "state-layer",
      "spacing",
      "density",
      "typography",
      "motion",
    ],
    "B03 requires exactly these eight categories",
  );

  for (const [name, category] of Object.entries(FOUNDATION_SCHEMA)) {
    const declared = [...LIGHT_DECLARATIONS.keys()].filter((token) =>
      token.startsWith(category.prefix),
    );
    assert.ok(
      declared.length > 0,
      `the "${name}" scale is empty — a declared-but-unpopulated category is not a scale`,
    );
    assert.ok(
      declared.length >= category.minimum,
      `the "${name}" scale declares ${declared.length} tokens, below its minimum of ${category.minimum}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 + fail-closed census · schema and CSS agree in BOTH directions.
// ─────────────────────────────────────────────────────────────────────────────

test("the physical token set is exactly the normative token set", () => {
  const declared = [...LIGHT_DECLARATIONS.keys()].sort();
  const expected = [...SCHEMA_TOKENS].sort();

  assert.equal(
    new Set(expected).size,
    expected.length,
    "the normative schema carries no duplicate token",
  );
  assert.deepEqual(
    expected.filter((token) => !declared.includes(token)),
    [],
    "normative foundation tokens missing from tokens.css",
  );
  assert.deepEqual(
    declared.filter((token) => !expected.includes(token)),
    [],
    "tokens declared in the foundation but absent from the schema — silent extras are not allowed",
  );
  assert.deepEqual(declared, expected);
});

test("every foundation token belongs to exactly one declared category", () => {
  for (const token of SCHEMA_TOKENS) {
    const owners = Object.entries(FOUNDATION_SCHEMA).filter(([, category]) =>
      token.startsWith(category.prefix),
    );
    assert.equal(
      owners.length,
      1,
      `"${token}" resolves to ${owners.length} categories; category prefixes must partition the namespace`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T3–T4 + T10 · light/dark completeness against the REAL theme mechanism.
// ─────────────────────────────────────────────────────────────────────────────

test("the dark scope matches the theme mechanism the app actually ships", () => {
  // Derived from theme.ts rather than hardcoded: a renamed mode must break the
  // contract here instead of leaving a dark scope that never matches anything.
  assert.ok(
    FOUNDATION_RULES.has(DARK_SCOPE),
    `the foundation's dark scope must be "${DARK_SCOPE}"`,
  );
  assert.match(
    readSource(THEME_MODULE_PATH),
    /document\.documentElement\.dataset\.theme = theme/,
    "theme.ts must still write the mode onto documentElement.dataset.theme",
  );
  assert.match(
    readSource(THEME_INIT_PATH),
    /document\.documentElement\.dataset\.theme = theme/,
    "the pre-paint init must still write the same attribute",
  );
  assert.ok(
    GLOBALS_CSS.includes(`:root[data-theme="${DARK_THEME_MODE}"] {`),
    "globals.css must remain the owner of the dark palette this foundation resolves against",
  );

  // No second theme mechanism. B03 integrates with the existing one.
  for (const rival of [
    /\.dark\b/,
    /\[data-color-scheme/,
    /data-dashboard-theme/,
    /prefers-color-scheme/,
  ]) {
    assert.ok(
      !rival.test(stripComments(FOUNDATION_BLOCK)),
      `the foundation must not introduce a second theme mechanism (${rival})`,
    );
  }
});

test("every THEME_VARIANT token is declared in both themes, with different values", () => {
  const variants = SCHEMA_ENTRIES.filter(([, themeClass]) => themeClass === "VARIANT");
  assert.ok(variants.length > 0, "a foundation with no theme-variant role proves nothing");

  for (const [token] of variants) {
    const light = LIGHT_DECLARATIONS.get(token);
    const dark = DARK_DECLARATIONS.get(token);

    assert.ok(light !== undefined, `"${token}" is THEME_VARIANT but has no light value`);
    assert.ok(dark !== undefined, `"${token}" is THEME_VARIANT but has no dark value`);
    // A dark block that restates the light value is duplication wearing the
    // costume of coverage: it reads as "dark is handled" while changing nothing.
    assert.notEqual(
      dark,
      light,
      `"${token}" declares an identical value in both themes — classify it ADAPTIVE or INVARIANT instead`,
    );

    // Two declarations that read differently could still resolve to the same
    // EFFECTIVE value if their own references converge — the direct-value
    // check above would miss that. Fingerprints prove they genuinely diverge.
    const { light: lightFp, dark: darkFp } = fingerprints(token);
    assert.notEqual(
      darkFp,
      lightFp,
      `"${token}" has different raw declarations but they resolve to the same effective value in both themes`,
    );
  }
});

test("the dark scope contains THEME_VARIANT tokens and nothing else", () => {
  const expectedDark = SCHEMA_ENTRIES.filter(
    ([, themeClass]) => themeClass === "VARIANT",
  )
    .map(([token]) => token)
    .sort();

  assert.deepEqual(
    [...DARK_DECLARATIONS.keys()].sort(),
    expectedDark,
    "the dark scope must carry exactly the theme-variant roles",
  );
});

test("every THEME_ADAPTIVE token's effective value genuinely changes in dark", () => {
  const adaptive = SCHEMA_ENTRIES.filter(([, themeClass]) => themeClass === "ADAPTIVE");
  assert.ok(adaptive.length > 0, "the adaptive class must be populated or removed");

  for (const [token] of adaptive) {
    const value = LIGHT_DECLARATIONS.get(token);
    assert.ok(value !== undefined, `"${token}" is missing from the foundation scope`);

    const references = referencedTokens(value);
    assert.ok(
      references.length > 0,
      `"${token}" is THEME_ADAPTIVE but references no token — it cannot adapt`,
    );

    // Checking that the DIRECT reference is redeclared under the dark
    // selector is not enough to prove the role adapts: --dash-color-focus-ring
    // references --clinical-focus-ring, and globals.css restates that wrapper
    // as the byte-identical `hsl(var(--ring) / 0.85)` in both themes — the
    // real change is one level deeper, in --ring. Deleting the dark --ring
    // override would leave the dashboard with its LIGHT focus ring in dark
    // mode while a direct-reference check stayed green. Resolving the full
    // chain into an EFFECTIVE-value fingerprint is what catches that: the
    // fingerprint differs only if some node in the chain actually differs.
    const { light: lightFp, dark: darkFp } = fingerprints(token);
    assert.notEqual(
      darkFp,
      lightFp,
      `"${token}" is THEME_ADAPTIVE but its effective value — resolved through the full var() chain — is identical in both themes. ` +
        `Either a referenced global stopped adapting in dark, or this role never adapted and belongs in THEME_INVARIANT.`,
    );
  }
});

test("no THEME_INVARIANT token is theme-dependent in disguise", () => {
  for (const [token, themeClass] of SCHEMA_ENTRIES) {
    if (themeClass !== "INVARIANT") continue;

    assert.ok(
      !DARK_DECLARATIONS.has(token),
      `"${token}" is THEME_INVARIANT and must not be restated in the dark scope`,
    );

    const value = LIGHT_DECLARATIONS.get(token);
    assert.ok(value !== undefined, `"${token}" is missing from the foundation scope`);

    // Symmetric with the ADAPTIVE check: an invariant is only honest if its
    // effective value is identical, not merely if its direct reference
    // happens not to appear in the dark block. A chain that adapts two levels
    // down would pass a shallow check while genuinely changing under the
    // hood — the same class of gap the ADAPTIVE fix closes, mirrored.
    const { light: lightFp, dark: darkFp } = fingerprints(token);
    assert.equal(
      darkFp,
      lightFp,
      `"${token}" is classified THEME_INVARIANT but its effective value differs between themes somewhere in its var() chain — it is ADAPTIVE or VARIANT`,
    );
  }
});

test("fingerprint resolution fails closed on a custom-property cycle", () => {
  // Synthetic fixture: the real tree has no cycle, so this proves the
  // resolver's OWN behavior rather than anything about tokens.css.
  const cyclicEnv = new Map([
    ["--a", "var(--b)"],
    ["--b", "var(--a)"],
  ]);

  assert.throws(
    () => resolveThemeFingerprint("--a", cyclicEnv),
    /cycle: --a -> --b -> --a/,
    "a custom-property cycle must fail with the cycle chain in the message, not hang or resolve",
  );
});

test("fingerprint resolution fails closed on a dangling reference", () => {
  const danglingEnv = new Map([["--a", "var(--missing-token)"]]);

  assert.throws(
    () => resolveThemeFingerprint("--a", danglingEnv),
    /unresolved custom property "--missing-token"/,
    "an unresolvable var() must fail rather than being treated as an invariant value",
  );
});

test("fingerprint resolution proves a transitive chain the way --dash-color-focus-ring needs", () => {
  // --a -> --b -> --c, with --c the only node that actually changes in dark.
  // This is the shape of the real bug: a wrapper (--b) that is textually
  // identical between themes while its own dependency (--c) adapts.
  const lightEnv = new Map([
    ["--a", "var(--b)"],
    ["--b", "var(--c)"],
    ["--c", "1px"],
  ]);
  const darkEnvAdapting = new Map([
    ["--a", "var(--b)"],
    ["--b", "var(--c)"],
    ["--c", "2px"],
  ]);

  assert.notEqual(
    resolveThemeFingerprint("--a", darkEnvAdapting),
    resolveThemeFingerprint("--a", lightEnv),
    "a two-level-deep change in --c must be visible through --a's fingerprint",
  );

  const darkEnvFlat = new Map([
    ["--a", "var(--b)"],
    ["--b", "var(--c)"],
    ["--c", "1px"],
  ]);

  assert.equal(
    resolveThemeFingerprint("--a", darkEnvFlat),
    resolveThemeFingerprint("--a", lightEnv),
    "an unchanged --c must leave --a's fingerprint unchanged too",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 · the foundation stays dashboard-scoped.
// ─────────────────────────────────────────────────────────────────────────────

test("every foundation rule is scoped to the dashboard shell", () => {
  for (const selector of FOUNDATION_RULES.keys()) {
    assert.ok(
      selector.includes(LIGHT_SCOPE),
      `"${selector}" escapes the dashboard scope — foundation tokens must not leak onto the public surface`,
    );
    assert.ok(
      !/^:root\s*\{?$/.test(selector.trim()),
      `"${selector}" would declare dashboard tokens globally`,
    );
  }
});

test("no foundation token is declared outside tokens.css", () => {
  const cssFiles = collectFilesRecursive(FRONTEND_SRC, /\.css$/).filter(
    (path) => path !== TOKENS_CSS_PATH,
  );
  assert.ok(cssFiles.length > 0, "the CSS census must find files");

  for (const path of cssFiles) {
    const source = stripComments(readSource(path));
    for (const token of SCHEMA_TOKENS) {
      assert.ok(
        !new RegExp(`${token}\\s*:`).test(source),
        `${path}: declares the foundation token "${token}" — tokens.css is its only owner`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T8 · B03 defined; B04 migrated. Consumption is real AND dashboard-scoped.
// ─────────────────────────────────────────────────────────────────────────────

/** Every (path, token) pair outside tokens.css that references a foundation token. */
function foundationConsumers(): Array<readonly [string, string]> {
  const sourceFiles = collectFilesRecursive(
    FRONTEND_SRC,
    /\.(css|ts|tsx)$/,
  ).filter((path) => path !== TOKENS_CSS_PATH);

  const found: Array<readonly [string, string]> = [];
  for (const path of sourceFiles) {
    const source = stripComments(readSource(path));
    for (const token of SCHEMA_TOKENS) {
      // Word boundary on the right so `--dash-color-surface` does not count as
      // a consumer of itself when the file really uses
      // `--dash-color-surface-muted`; each token is matched exactly. The `\w`
      // must be double-escaped (`\\w`) inside this template literal — a
      // single backslash is not a recognised string escape and silently
      // degrades to a literal `w`, which happens to still reject the
      // `-muted` case (blocked by the `-` alternative) but is not the
      // intended character class.
      if (new RegExp(`${token}(?![\\w-])`).test(source)) {
        found.push([path, token]);
      }
    }
  }
  return found;
}

test("the foundation is genuinely consumed after B04", () => {
  const consumers = foundationConsumers();

  assert.ok(
    consumers.length > 0,
    "no source outside tokens.css references a foundation token. B04 migrated the dashboard surfaces onto this foundation; zero consumers means that migration was reverted, and this contract must not pass silently in that state",
  );

  // The migration is not one token used once: B04 covers colour, shape and
  // elevation. Requiring more than one CATEGORY stops a single stray reference
  // from satisfying the boundary.
  const categories = new Set(
    // "--dash-color-surface" splits to ["", "", "dash", "color", "surface"]:
    // the leading "--" contributes two empty segments, so the category prefix
    // is the first FOUR.
    consumers.map(([, token]) => token.split("-").slice(0, 4).join("-")),
  );
  assert.ok(
    categories.size >= 3,
    `only ${categories.size} foundation categories are consumed (${[...categories].sort().join(", ")}); B04 migrates colour, shape and elevation at minimum`,
  );
});

test("every foundation consumer stays inside the authenticated dashboard", () => {
  for (const [path, token] of foundationConsumers()) {
    assert.ok(
      B04_CONSUMER_PREFIXES.some((prefix) => path.startsWith(prefix)),
      `${path}: consumes "${token}" outside the dashboard scope. The foundation is declared only on \`.dashboard-app-shell\`, so this reference resolves to nothing wherever that ancestor is absent — public pages, login, and every non-dashboard route. Allowed roots: ${B04_CONSUMER_PREFIXES.join(", ")}`,
    );
  }
});

test("the B05 field token has exactly one runtime consumer", () => {
  const fieldConsumerPaths = foundationConsumers()
    .filter(([, token]) => token === B05_FIELD_TOKEN)
    .map(([path]) => path);

  assert.deepEqual(
    fieldConsumerPaths,
    [B05_FIELD_TOKEN_CANONICAL_PATH],
    `expected the sole runtime consumer of "${B05_FIELD_TOKEN}" to be ${B05_FIELD_TOKEN_CANONICAL_PATH}; found ${JSON.stringify(fieldConsumerPaths)}. A second consumer duplicates the single source of truth for the field tint; zero consumers means the B05 surface inversion was reverted`,
  );
});

test("foundation cross-references stay inside the foundation", () => {
  // The density insets intentionally resolve through the spacing scale. That is
  // fine — it is one scale composing another inside the same block — but a
  // foundation token pointing at a RUNTIME dashboard token would make B03 a
  // consumer of the surfaces it is supposed to precede.
  const RUNTIME_DASH_TOKENS = [
    "--dash-accent",
    "--dash-gap",
    "--dash-pad-x",
    "--dash-pad-y",
    "--dash-rhythm",
    "--dash-control-h",
    "--dash-tab-h",
    "--dash-row-h",
    "--dash-header-h",
    "--dash-card-pad",
    "--dash-secondary-font",
  ];

  for (const [token, value] of LIGHT_DECLARATIONS) {
    for (const reference of referencedTokens(value)) {
      if (reference.startsWith("--dash-")) {
        assert.ok(
          SCHEMA_TOKENS.includes(reference),
          `"${token}" resolves through "${reference}", which is not part of the B03 foundation`,
        );
      }
      assert.ok(
        !RUNTIME_DASH_TOKENS.includes(reference),
        `"${token}" resolves through the runtime token "${reference}" — the foundation must not depend on the surfaces it precedes`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 + T9 · A05–A07 preservation. B03 must not touch the capacity contract.
// ─────────────────────────────────────────────────────────────────────────────

test("the row pitch contract survives B03 intact and parseable", () => {
  // Restated here rather than delegated: the capacity guard proves the pitch is
  // readable, and this proves B03 did not become the thing that broke it.
  const declarations = [
    ...PITCH_BLOCK.matchAll(/--dash-row-pitch-([a-z]+):\s*([^;]+);/g),
  ];
  assert.ok(declarations.length > 0, "the pitch tiers must still be declared");

  for (const [, tier, value] of declarations) {
    assert.match(
      value.trim(),
      /^\d+(?:\.\d+)?px$/,
      `--dash-row-pitch-${tier} must stay a plain px literal, got "${value.trim()}"`,
    );
  }

  for (const [, value] of PITCH_BLOCK.matchAll(/--dash-table-head-h:\s*([^;]+);/g)) {
    assert.match(
      value.trim(),
      /^\d+(?:\.\d+)?px$/,
      `--dash-table-head-h must stay a plain px literal, got "${value.trim()}"`,
    );
  }

  assert.ok(
    TOKENS_CSS.indexOf(FOUNDATION_END) < TOKENS_CSS.indexOf(PITCH_START),
    "the foundation must sit before the pitch contract so the capacity owner keeps the last word",
  );
});

test("the capacity tokens keep exactly one owner", () => {
  const outsidePitchContract = stripComments(
    TOKENS_CSS.replace(PITCH_BLOCK, " "),
  );

  for (const token of CAPACITY_OWNED_TOKENS) {
    assert.ok(
      !new RegExp(`${token}\\s*:`).test(outsidePitchContract),
      `"${token}" is declared outside the row-pitch contract — B03 must not become a second capacity owner`,
    );
  }

  const dashboardCss = collectFilesRecursive(DASHBOARD_CSS_DIR, /\.css$/).filter(
    (path) => path !== TOKENS_CSS_PATH,
  );
  for (const path of dashboardCss) {
    const source = stripComments(readSource(path));
    for (const token of CAPACITY_OWNED_TOKENS) {
      assert.ok(
        !new RegExp(`${token}\\s*:`).test(source),
        `${path}: declares "${token}"; the pitch contract in tokens.css is its only owner`,
      );
    }
  }
});

test("the density scale declares no row height", () => {
  // Density and row pitch are different owners answering different questions.
  // A `--dash-density-row-*` here would be a second answer to "how tall is a
  // row", which is the exact failure the capacity contract was built to end.
  for (const token of Object.keys(FOUNDATION_SCHEMA.density.tokens)) {
    assert.ok(
      !/\b(row|pitch)\b/.test(token.replace(/-/g, " ")),
      `"${token}" claims row geometry, which belongs to the pitch contract`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// R11 · motion must not be able to animate a region's height.
// ─────────────────────────────────────────────────────────────────────────────

test("no motion token exists to animate a region's height", () => {
  for (const [token, value] of LIGHT_DECLARATIONS) {
    if (!token.startsWith(FOUNDATION_SCHEMA.motion.prefix)) continue;

    assert.ok(
      !/height|block-size|inline-size/.test(token),
      `"${token}" names a size — animating region height thrashes the ResizeObserver that derives capacity (R11)`,
    );
    assert.ok(
      !/height|block-size/.test(value),
      `"${token}" carries a size in its value; motion tokens are durations and easings only`,
    );
  }
});
