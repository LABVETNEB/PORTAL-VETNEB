import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

test("no frontend source keeps a legacy capacity owner", () => {
  // Scanned over EVERY source file, not just the migrated ones. Scoping this to
  // `MIGRATED_CONSUMERS` left the retirement provable only where the owner had
  // already been adopted: a new helper — or a surface that never migrated —
  // could reintroduce a legacy owner, stay out of the discovered set for that
  // very reason, and keep this guard green. Retirement is a property of the
  // whole tree, so it is asserted against the whole tree.
  //
  // Stripped, for the same reason the discovery is: the owner hook's own header
  // names the three hooks it replaced. Naming a retired owner in prose is
  // documentation; the contract is about a second capacity path in CODE.
  for (const path of ALL_SOURCE_FILES) {
    const source = stripComments(readSource(path));

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

// PR-TRUNC. The ban below means what its message says: a scroller must never be
// an escape from a ROWS-CAPACITY bug. It used to be spelled as "no
// `overflow-y-auto` anywhere in the file", which also caught regions that own
// no rows, no capacity and no pager — and the informes DETAIL canvas is exactly
// that. Its previous way of staying inside its bounded track was to TRUNCATE
// every value in it and let `overflow: hidden` swallow the rest (measured: 156px
// of a clinical record clipped at 1366x768, with normal data), which is the
// defect PR-TRUNC exists to remove.
//
// So the exemption is granted to ONE explicitly anchored element, and it is paid
// for twice: the anchor must not sit on the rows canvas (asserted below), and
// the runtime contract in
// frontend/e2e/clinic/reports/clinic-informes-zero-internal-scroll.spec.ts
// asserts there is at most one of them and that its end is reachable.
const SANCTIONED_SCROLL_OWNER_ANCHOR = 'data-informes-detail-scroll-owner="true"';
const FORBIDDEN_SCROLLER =
  /overflow-y-auto|overflow-y:\s*auto|overflow:\s*scroll|overflow-scroll/;

/** Drops the opening tag of the sanctioned owner so the ban can run on the rest. */
function stripSanctionedScrollOwner(source: string): string {
  return source.replace(
    new RegExp(`<[a-zA-Z]+\\s[^>]*${SANCTIONED_SCROLL_OWNER_ANCHOR}[^>]*>`, "g"),
    "",
  );
}

test("migrated consumers introduce no forbidden internal scroller", () => {
  for (const path of MIGRATED_CONSUMERS) {
    const source = readSource(path);

    assert.ok(
      !FORBIDDEN_SCROLLER.test(stripSanctionedScrollOwner(source)),
      `${path}: an internal scroller is not an escape from a capacity bug`,
    );
  }
});

test("the sanctioned detail scroll owner is never the rows canvas", () => {
  const owners = MIGRATED_CONSUMERS.filter((path) =>
    readSource(path).includes(SANCTIONED_SCROLL_OWNER_ANCHOR),
  );

  assert.equal(
    owners.length,
    1,
    `exactly one migrated consumer may declare the sanctioned detail scroll owner, found ${owners.length}`,
  );

  for (const path of owners) {
    const source = readSource(path);

    // The exemption covers a DETAIL region. If the anchor ever lands on the
    // element that also declares the rows canvas — or its pager reserve — the
    // scroller IS papering over a capacity bug and the ban must bite again.
    const openingTags = [
      ...source.matchAll(
        new RegExp(
          `<[a-zA-Z]+\\s[^>]*${SANCTIONED_SCROLL_OWNER_ANCHOR}[^>]*>`,
          "g",
        ),
      ),
    ].map((match) => match[0]);

    assert.ok(openingTags.length > 0, `${path}: sanctioned owner tag not found`);

    for (const tag of openingTags) {
      assert.equal(
        tag.includes("data-dashboard-adaptive-rows-canvas"),
        false,
        `${path}: the rows canvas may never be the scroll owner`,
      );
      assert.equal(
        tag.includes("data-dashboard-adaptive-reserved-region"),
        false,
        `${path}: a reserved region may never be the scroll owner`,
      );
    }
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
  // Derived, not listed: a tier added later must inherit the contract instead
  // of silently escaping a hardcoded roster.
  const tierDeclarations = [
    ...css.matchAll(/--dash-row-pitch-([a-z]+):\s*([^;]+);/g),
  ];
  assert.ok(tierDeclarations.length > 0, "pitch tiers must be declared");

  for (const [, tier, value] of tierDeclarations) {
    assert.match(
      value.trim(),
      /^\d+(?:\.\d+)?px$/,
      `--dash-row-pitch-${tier} must be a plain px literal, got "${value.trim()}"`,
    );
  }

  // The head reserve is read back by the same parser and obeys the same rule.
  for (const [, value] of css.matchAll(/--dash-table-head-h:\s*([^;]+);/g)) {
    assert.match(
      value.trim(),
      /^\d+(?:\.\d+)?px$/,
      `--dash-table-head-h must be a plain px literal, got "${value.trim()}"`,
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// A07 · completeness contract.
//
// The auto-discovery above proves the single-owner contract holds for whoever
// adopted the owner; it cannot prove that everyone who MUST adopt it did. A07
// is closed only while the discovered set IS the normative set, so the census
// is pinned in both directions: a normative module that quietly drops the owner
// fails, and a surface that derives capacity without being declared here fails
// too.
// ─────────────────────────────────────────────────────────────────────────────

const A03_MATRIX_PATH =
  "frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts";

/**
 * The 15 normative `moduleId` of the audit (§20.1, §20.8) mapped to the files
 * that physically own their capacity. Two modules render mutually exclusive
 * desktop and mobile presentations, so the 15 modules resolve to 17 owners.
 */
const A07_OWNERS_BY_MODULE_ID: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "admin-audit-log": ["frontend/src/app/dashboard/admin/AdminAuditCard.tsx"],
    "admin-report-upload": [
      "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
    ],
    "admin-particular-tokens": [
      "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
    ],
    "admin-clinics": [
      "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
    ],
    "admin-users-roles": [
      "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
    ],
    "admin-sessions": [
      "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
    ],
    "admin-failed-login-alerts": [
      "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
    ],
    "admin-pricing": [
      "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx",
      "frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx",
    ],
    "informes-reports-list": [
      "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
    ],
    "admin-maintenance": [
      "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
      "frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx",
    ],
    "clinic-informes-summary": [
      "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
    ],
    "clinic-logistica-summary": [
      "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
    ],
    "clinic-particular-tokens": [
      "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
    ],
    "logistics-recent-list": [
      "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx",
    ],
    "logistics-bounded-canvas": [
      "frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx",
    ],
  });

const A07_DECLARED_OWNERS = Object.values(A07_OWNERS_BY_MODULE_ID).flat();

/**
 * Read from the A03 registry rather than restated here: a second hand-written
 * copy of the 15 ids would drift silently, which is the failure this contract
 * exists to catch.
 */
function readA03ModuleIds(): string[] {
  const literal = readSource(A03_MATRIX_PATH).match(
    /export const A03_MODULE_IDS = \[([\s\S]*?)\] as const;/,
  );

  assert.ok(
    literal,
    `${A03_MATRIX_PATH}: the canonical A03 registry literal must stay identifiable`,
  );
  return [...literal[1].matchAll(/"([^"]+)"/g)].map(([, id]) => id);
}

test("the A07 census maps the canonical A03 registry exactly", () => {
  const registryIds = readA03ModuleIds();
  const censusIds = Object.keys(A07_OWNERS_BY_MODULE_ID);

  assert.equal(
    registryIds.length,
    15,
    "A03 declares exactly 15 normative modules",
  );
  assert.equal(
    new Set(registryIds).size,
    registryIds.length,
    "the A03 registry carries no duplicate moduleId",
  );
  assert.equal(
    new Set(censusIds).size,
    censusIds.length,
    "the A07 census carries no duplicate moduleId",
  );
  assert.deepEqual(
    censusIds,
    registryIds,
    "the A07 census must cover the 15 canonical moduleId, in canonical order",
  );
});

test("every normative module resolves to an existing owner that adopts the hook", () => {
  assert.equal(
    A07_DECLARED_OWNERS.length,
    17,
    "the 15 normative modules resolve to exactly 17 physical owners",
  );
  assert.equal(
    new Set(A07_DECLARED_OWNERS).size,
    A07_DECLARED_OWNERS.length,
    "an owner file may not be claimed by two modules",
  );

  for (const [moduleId, owners] of Object.entries(A07_OWNERS_BY_MODULE_ID)) {
    for (const path of owners) {
      assert.ok(
        existsSync(resolve(process.cwd(), path)),
        `${moduleId}: declared owner "${path}" does not exist`,
      );
      assert.match(
        stripComments(readSource(path)),
        new RegExp(`\\b${OWNER_HOOK_NAME}\\b`),
        `${moduleId}: "${path}" must derive its capacity from ${OWNER_HOOK_NAME}`,
      );
    }
  }
});

test("the discovered consumer set is exactly the normative owner set", () => {
  const declared = [...A07_DECLARED_OWNERS].sort();
  const discovered = [...MIGRATED_CONSUMERS].sort();

  // Both directions, deliberately. A missing entry is a normative module that
  // stopped owning its capacity — A07 regressed. An unexpected entry is a
  // surface deriving capacity outside the census — A07 is no longer complete,
  // and the audit's 15/15 claim would be unbacked either way.
  assert.deepEqual(
    declared.filter((path) => !discovered.includes(path)),
    [],
    `normative owners that no longer use ${OWNER_HOOK_NAME}`,
  );
  assert.deepEqual(
    discovered.filter((path) => !declared.includes(path)),
    [],
    "capacity owners outside the A07 census",
  );
  assert.deepEqual(discovered, declared);
});
