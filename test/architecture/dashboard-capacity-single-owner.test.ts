import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";

// Option D · single capacity owner.
//
// The pitch-locked engine is only deterministic while it is the ONLY thing
// deriving capacity. The previous architecture failed not because its
// arithmetic was wrong but because a second measurement path existed beside it:
// a MutationObserver re-arming per-row ResizeObservers, a pitch in an effect's
// dependency array that tore the observer down mid-frame, and a measurement
// effect that wrote the user's page back. Each of those is a way for content to
// point back at capacity, so each is asserted away here rather than left to
// review.
//
// The migrated set is discovered, never listed: any file that adopts the owner
// is held to the contract from the moment it does.

const FRONTEND_SRC = "frontend/src";
const OWNER_HOOK_PATH = "frontend/src/hooks/useDashboardCanvasCapacity.ts";
const ENGINE_PATH = "frontend/src/lib/dashboard/capacity/computeCapacity.ts";

const OWNER_HOOK_NAME = "useDashboardCanvasCapacity";

const LEGACY_CAPACITY_OWNERS = [
  "useAdaptiveItemsPerPage",
  "useAdaptiveRowsPerPage",
  "useAdaptiveDashboardPageSize",
  "createAdaptiveRowPitchCalibrator",
  "adaptiveRowPitchCalibration",
] as const;

function readSource(repoRelativePath: string): string {
  return readFileSync(resolve(process.cwd(), repoRelativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

/** Recursive walk: a non-recursive census silently exempts nested modules. */
function collectSourceFiles(repoRelativeDir: string): string[] {
  const absoluteDir = resolve(process.cwd(), repoRelativeDir);
  const found: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const absoluteEntry = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectSourceFiles(relative(process.cwd(), absoluteEntry)));
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      found.push(relative(process.cwd(), absoluteEntry).replace(/\\/g, "/"));
    }
  }

  return found;
}

function countOccurrences(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

/**
 * Strips comments so purity is asserted against CODE.
 *
 * These files document the very constructs they are forbidden to use — the
 * engine explains why it holds no `window` reference, the pitch contract
 * explains why a `data-dashboard-module=` exception would be wrong — so a
 * naive text scan fails on the prose that exists to prevent the violation.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ALL_SOURCE_FILES = collectSourceFiles(FRONTEND_SRC);

/** Consumers that have adopted the owner — the contract applies to exactly these. */
const MIGRATED_CONSUMERS = ALL_SOURCE_FILES.filter(
  (path) =>
    path !== OWNER_HOOK_PATH &&
    // Stripped: a file that only NAMES the owner in a comment is not a
    // consumer, and counting it as one would demand a capacity it never owns.
    new RegExp(`\\b${OWNER_HOOK_NAME}\\b`).test(stripComments(readSource(path))),
);

test("the owner hook is adopted by at least one consumer", () => {
  assert.ok(
    MIGRATED_CONSUMERS.length > 0,
    "a capacity owner nothing uses proves nothing",
  );
});

test("every capacity owner is bound to a canvas", () => {
  // One owner PER CANVAS, not per file: the admin cards render mutually
  // exclusive desktop and mobile presentations, and each bounded canvas needs
  // its own owner. What must never happen is an owner that is not bound to a
  // canvas — that is how a surface ends up deriving capacity from something
  // other than the region the rows actually live in.
  for (const path of MIGRATED_CONSUMERS) {
    const source = stripComments(readSource(path));
    const ownerCalls = [
      ...source.matchAll(
        new RegExp(`${OWNER_HOOK_NAME}\\s*\\(\\{([^}]*)\\}`, "g"),
      ),
    ];

    assert.ok(
      ownerCalls.length >= 1,
      `${path}: a migrated consumer must own a capacity`,
    );
    for (const call of ownerCalls) {
      assert.match(
        call[1],
        /\bcanvasNode\b/,
        `${path}: every owner must be bound to a canvasNode`,
      );
    }
  }
});

test("no migrated consumer keeps a second capacity path", () => {
  for (const path of MIGRATED_CONSUMERS) {
    const source = readSource(path);

    for (const legacy of LEGACY_CAPACITY_OWNERS) {
      assert.ok(
        !new RegExp(`\\b${legacy}\\b`).test(source),
        `${path}: still references the legacy owner "${legacy}"`,
      );
    }
  }
});

test("migrated consumers observe at most the canvas, and never the rows", () => {
  for (const path of MIGRATED_CONSUMERS) {
    const source = readSource(path);

    assert.ok(
      countOccurrences(source, /new ResizeObserver\b/g) <= 1,
      `${path}: a surface may not run a second ResizeObserver`,
    );
    assert.equal(
      countOccurrences(source, /new MutationObserver\b/g),
      0,
      `${path}: re-arming observers from mutations reopens the render loop`,
    );
    assert.ok(
      !/\.observe\(\s*row\b/.test(source) && !/observeRows\b/.test(source),
      `${path}: rows must not be observed — that is the L1 feedback loop`,
    );
  }
});

test("migrated consumers introduce no forbidden internal scroller", () => {
  for (const path of MIGRATED_CONSUMERS) {
    const source = readSource(path);

    assert.ok(
      !/overflow-y-auto|overflow-y:\s*auto|overflow:\s*scroll|overflow-scroll/.test(
        source,
      ),
      `${path}: an internal scroller is not an escape from a capacity bug`,
    );
  }
});

test("every migrated consumer keeps a pager reservation in flow", () => {
  for (const path of MIGRATED_CONSUMERS) {
    const source = readSource(path);
    if (!source.includes("data-dashboard-adaptive-rows-canvas")) {
      continue;
    }

    // A generic bounded wrapper renders `{children}` and does not own the
    // pager; the surface that composes it does. That obligation is asserted
    // separately below, against the composing pages, so it is not lost.
    if (/\{\s*children\s*\}/.test(source)) {
      continue;
    }

    assert.ok(
      source.includes('data-dashboard-adaptive-reserved-region="pager"') ||
        /<(DashboardPager|CompactPager|AdminMobileOpsPager)\b/.test(source),
      `${path}: an adaptive canvas must reserve its pager, not push it out`,
    );
  }
});

test("surfaces composing a bounded wrapper reserve the pager themselves", () => {
  const composers = ALL_SOURCE_FILES.filter((path) =>
    /<LogisticsBoundedCanvas\b/.test(readSource(path)),
  );

  assert.ok(composers.length > 0, "the bounded wrapper must have consumers");
  for (const path of composers) {
    assert.ok(
      readSource(path).includes(
        'data-dashboard-adaptive-reserved-region="pager"',
      ),
      `${path}: the surface composing a bounded canvas owns its pager reserve`,
    );
  }
});

test("every list row inside an adaptive canvas is locked to the pitch", () => {
  // The capacity is exact only while the rows cannot exceed the pitch it was
  // computed from. An UNLOCKED mobile row is the failure this pins: the engine
  // sized the page with a 36px tier while the real rows rendered at ~40px, so
  // the last row of each page was pushed outside the `overflow: hidden` canvas
  // — present in the DOM, invisible on screen — and A05 read 16 rows where the
  // server had returned 18. Table rows are locked by element (`tbody > tr`);
  // list rows have no such element, so they must declare it.
  const ROW_MARKERS =
    /data-[a-z-]*(?:mobile-ops-item|mobile-core-item|mobile-status-item|mobile-row|mobile-card|mobile-maintenance-candidate-row)="true"/g;

  for (const path of MIGRATED_CONSUMERS.concat(
    ALL_SOURCE_FILES.filter((candidate) =>
      readSource(candidate).includes("data-dashboard-adaptive-rows-canvas"),
    ),
  )) {
    const source = readSource(path);
    for (const marker of source.match(ROW_MARKERS) ?? []) {
      const declaration = source.slice(source.indexOf(marker));
      assert.match(
        declaration.slice(0, 400),
        /data-dashboard-adaptive-row="true"/,
        `${path}: "${marker}" is a row of an adaptive canvas and must be locked to the pitch`,
      );
    }
  }
});

test("the owner hook writes nothing and navigates nothing", () => {
  const source = readSource(OWNER_HOOK_PATH);

  assert.equal(
    countOccurrences(source, /new ResizeObserver\b/g),
    1,
    "exactly one ResizeObserver",
  );
  assert.equal(countOccurrences(source, /\.observe\(/g), 1, "exactly one target");
  assert.equal(countOccurrences(source, /new MutationObserver\b/g), 0);

  for (const write of [
    /\.setProperty\(/,
    /\.setAttribute\(/,
    /\.style\./,
    /\.classList\b/,
    /\.textContent\b/,
  ]) {
    assert.ok(
      !write.test(source),
      `the capacity owner must not write to the DOM (${write})`,
    );
  }

  assert.ok(
    !/setPage\b/.test(source),
    "the capacity owner must not own navigation state",
  );
});

test("the owner hook's effect dependencies are frozen", () => {
  const source = readSource(OWNER_HOOK_PATH);

  // `itemHeightPx` in the dependency array is what destroyed the observer and
  // cancelled the pending frame on every pitch change, latching a stale value
  // that only a further resize could clear. The array is pinned so that class
  // of regression cannot come back.
  assert.match(
    source,
    /\},\s*\[canvasNode,\s*enabled\]\s*\)\s*;/,
    "the measurement effect must depend on exactly [canvasNode, enabled]",
  );
  assert.equal(
    countOccurrences(source, /useLayoutEffect\(/g),
    1,
    "one measurement effect, not two",
  );
});

test("the capacity engine is pure", () => {
  const source = stripComments(readSource(ENGINE_PATH));

  assert.ok(
    !/^\s*import\s/m.test(source),
    "the engine must import nothing — purity is structural here",
  );

  for (const impurity of [
    /\bdocument\b/,
    /\bwindow\b/,
    /\bReact\b/,
    /\buseState\b/,
    /\bgetBoundingClientRect\b/,
    /\bgetComputedStyle\b/,
    /\bResizeObserver\b/,
    /\bMath\.random\b/,
    /\bDate\.now\b/,
    /\bnew Map\b/,
    /\bnew Set\b/,
  ]) {
    assert.ok(
      !impurity.test(source),
      `the engine must not reference ${impurity} — it would stop being a function`,
    );
  }

  assert.ok(
    !/\bitemCount\b/.test(source),
    "the dataset must not be expressible as an engine input",
  );
});

test("the pitch tokens stay readable by the capacity owner", () => {
  const css = readDashboardCssSource();

  // Custom properties compute to their substituted token, so a tier authored in
  // rem/clamp/calc would be read back as "no usable pitch" and every adaptive
  // canvas would silently sit on its fallback page size.
  for (const tier of ["compact", "regular", "tall", "card"]) {
    const declaration = new RegExp(`--dash-row-pitch-${tier}:\\s*([^;]+);`, "g");
    const matches = [...css.matchAll(declaration)];

    assert.ok(matches.length > 0, `--dash-row-pitch-${tier} must be declared`);
    for (const match of matches) {
      assert.match(
        match[1].trim(),
        /^\d+(?:\.\d+)?px$/,
        `--dash-row-pitch-${tier} must be a plain px literal, got "${match[1].trim()}"`,
      );
    }
  }

  // The lock is authored as a selector LIST (list rows, attribute-marked rows,
  // table rows), so assert the rule it resolves to rather than one spelling of
  // its selector.
  const lockRule = css.match(
    /([^{}]*\[data-dashboard-adaptive-rows-canvas="true"\][^{}]*)\{([^}]*block-size:\s*var\(--dash-row-pitch\)[^}]*)\}/,
  );

  assert.ok(lockRule, "rows must be locked to the token the owner reads");
  for (const grammar of [
    "\\.dashboard-list-row",
    '\\[data-dashboard-adaptive-row="true"\\]',
    "table tbody > tr",
  ]) {
    assert.match(
      lockRule[1],
      new RegExp(grammar),
      `the pitch lock must cover the ${grammar} grammar`,
    );
  }

  assert.match(
    css,
    /--dash-canvas-reserved:\s*var\(--dash-table-head-h\)/,
    "the reserved head must be declared through the token the engine subtracts",
  );
});

test("the pitch contract carries no per-module exception", () => {
  const css = readDashboardCssSource();
  const contract = css.match(
    /dashboard-row-pitch-contract:start([\s\S]*?)dashboard-row-pitch-contract:end/,
  );

  assert.ok(contract, "the pitch contract block must stay identifiable");
  assert.ok(
    !/data-dashboard-module=/.test(stripComments(contract[1])),
    "a module-specific pitch means the primitive is wrong, not the module special",
  );
});
