import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

// ─────────────────────────────────────────────────────────────────────────────
// B05 · Filter-field surface inversion (roadmap §49/§54).
//
// "Invertir la relación de superficie (tinte al campo, contenedor
// transparente)": before B05 the 7 super searchers tinted their CONTAINER
// (`bg-card/82` on the shared `FilterBar`, `bg-muted/15` on the two direct
// admin surfaces) and left their FIELDS near-white. B05 inverts that: the
// container fill is removed at its own source and the tint moves onto each
// field via `--dash-color-field`, the token B03 declared and B04 deliberately
// left unconsumed (`test/architecture/dashboard-b04-surface-token-migration.test.ts`
// T7, `test/architecture/dashboard-foundation-tokens.test.ts` T8c).
//
// Two anchor shapes cover the 7 surfaces:
//   SHARED   S1/S2/S3/S6/S7 render through `FilterBar.tsx`; the container fill
//            is removed once there and the field tint reaches every
//            input/select through the `[data-dashboard-filter-bar="true"]`
//            descendant rule in surfaces.css.
//   DIRECT   S4/S5 have no shared wrapper; each field carries its own
//            `data-dashboard-filter-field="true"` anchor.
// The corrected container-anchor count is 7, not 8: FilterBar (comfortable +
// compact) = 2, AdminUsersRolesReadOnlyCard (desktop + 2 mobile bands) = 3,
// AdminClinicsManagementCard (desktop + mobile search wrapper) = 2. That total
// is the length of CONTAINER_ANCHORS below, derived from the array itself —
// never hardcoded as a separate assertion the array could drift out of sync
// with.
//
// This file owns the B05 static manifest. It does not re-assert the
// FOUNDATION_DECLARATION_HASH or ROW_PITCH_RAW_HASH — those already run on
// every test invocation via dashboard-b04-surface-token-migration.test.ts and
// dashboard-foundation-tokens.test.ts; a second literal copy of either hash
// here would be a second place for them to drift apart, not a second
// guarantee. Runtime computed-style verification (the field's resolved
// background differs from its container's, in both themes) lives in
// frontend/e2e/regression/dashboard-b05-surface-inversion.spec.ts — a static
// grep cannot prove a CSS custom property actually painted anything.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const FILTER_BAR_TSX = "frontend/src/components/dashboard/FilterBar.tsx";
const ADMIN_USERS_ROLES_TSX =
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
const ADMIN_CLINICS_TSX =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const SURFACES_CSS = "frontend/src/styles/dashboard/surfaces.css";

const FIELD_TOKEN = "--dash-color-field";
const CONTAINER_FILL_UTILITY = /bg-(card|muted)\/\d+/;

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

/** The marked block's raw slice: `:start` line through the closing `:end` tag. */
function markedBlock(source: string, name: string): string {
  const startMarker = source.indexOf(`${name}:start`);
  const endMarker = source.indexOf(`${name}:end`);
  assert.notEqual(startMarker, -1, `${name}:start missing`);
  assert.notEqual(endMarker, -1, `${name}:end missing`);
  const lineStart = source.lastIndexOf("\n", startMarker) + 1;
  const blockEnd = source.indexOf("*/", endMarker) + 2;
  return source.slice(lineStart, blockEnd);
}

// ─────────────────────────────────────────────────────────────────────────────
// Container anchors — must have lost their fill, kept everything else.
// ─────────────────────────────────────────────────────────────────────────────

type ContainerRole = "SHARED" | "DIRECT";

const CONTAINER_ANCHORS: ReadonlyArray<{
  readonly path: string;
  readonly anchor: string;
  readonly role: ContainerRole;
  readonly why: string;
}> = [
  {
    path: FILTER_BAR_TSX,
    anchor:
      '"grid grid-cols-1 items-end gap-3 rounded-xl border border-vetneb-line/75 p-3"',
    role: "SHARED",
    why: "FilterBar comfortable density (S1/S2/S3/S6/S7 mobile)",
  },
  {
    path: FILTER_BAR_TSX,
    anchor:
      '"grid grid-cols-1 items-end gap-2 rounded-lg border border-vetneb-line/70 px-2 py-2 md:gap-1.5 md:py-1"',
    role: "SHARED",
    why: "FilterBar compact density (S1/S2/S3/S6/S7 desktop)",
  },
  {
    path: ADMIN_USERS_ROLES_TSX,
    anchor:
      'className="flex min-h-12 shrink-0 items-end gap-2 border-b border-vetneb-line/70 px-3 py-2 sm:px-4 md:min-h-10 md:py-1"',
    role: "DIRECT",
    why: "S5 desktop filter band",
  },
  {
    path: ADMIN_USERS_ROLES_TSX,
    anchor:
      'className="shrink-0 border-b border-vetneb-line/70 px-2 py-1"',
    role: "DIRECT",
    why: "S5 mobile search band",
  },
  {
    path: ADMIN_USERS_ROLES_TSX,
    anchor:
      'className="grid min-h-12 shrink-0 grid-cols-2 gap-2 overflow-hidden border-b border-vetneb-line/70 px-2 py-1"',
    role: "DIRECT",
    why: "S5 mobile type/role band",
  },
  {
    path: ADMIN_CLINICS_TSX,
    anchor: 'className="relative max-w-xs flex-1"',
    role: "DIRECT",
    why: "S4 desktop search wrapper (already transparent pre-B05)",
  },
  {
    path: ADMIN_CLINICS_TSX,
    anchor: 'className="relative max-w-xs shrink-0"',
    role: "DIRECT",
    why: "S4 mobile search wrapper (already transparent pre-B05)",
  },
];

test("every B05 container anchor resolves to exactly one occurrence in real source", () => {
  for (const entry of CONTAINER_ANCHORS) {
    const occurrences =
      readSource(entry.path).split(entry.anchor).length - 1;
    assert.equal(
      occurrences,
      1,
      `${entry.path}: anchor for "${entry.why}" occurs ${occurrences}x, expected exactly 1. If it legitimately changed, realign this manifest rather than dropping the pin`,
    );
  }
});

test("the manifest cardinality matches the corrected count (7, not the audit's narrative 8)", () => {
  assert.equal(
    CONTAINER_ANCHORS.length,
    7,
    "FilterBar (2) + AdminUsersRolesReadOnlyCard (3) + AdminClinicsManagementCard (2) = 7 container anchors",
  );
  assert.equal(
    CONTAINER_ANCHORS.filter((entry) => entry.role === "SHARED").length,
    2,
  );
  assert.equal(
    CONTAINER_ANCHORS.filter((entry) => entry.role === "DIRECT").length,
    5,
  );
});

test("no B05 container anchor carries a bg-card or bg-muted fill utility", () => {
  for (const entry of CONTAINER_ANCHORS) {
    assert.ok(
      !CONTAINER_FILL_UTILITY.test(entry.anchor),
      `${entry.path}: the pinned container anchor for "${entry.why}" still carries a fill utility — ${entry.anchor}. B05 requires the container transparent; the tint belongs on the field only`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Field anchors — the direct (non-FilterBar) controls that carry their own tag.
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_ANCHOR_COUNTS: ReadonlyArray<{
  readonly path: string;
  readonly expected: number;
  readonly why: string;
}> = [
  { path: ADMIN_CLINICS_TSX, expected: 2, why: "S4 desktop + mobile search Input" },
  {
    path: ADMIN_USERS_ROLES_TSX,
    expected: 6,
    why: "S5 desktop + mobile search Input (2) + type/role select (4)",
  },
];

test("every direct S4/S5 field carries the data-dashboard-filter-field anchor", () => {
  for (const entry of FIELD_ANCHOR_COUNTS) {
    const occurrences =
      (readSource(entry.path).match(/data-dashboard-filter-field="true"/g) ?? [])
        .length;
    assert.equal(
      occurrences,
      entry.expected,
      `${entry.path}: expected ${entry.expected} data-dashboard-filter-field anchors (${entry.why}), found ${occurrences}`,
    );
  }
});

test("FilterBar still exposes the shared data-dashboard-filter-bar anchor", () => {
  const occurrences =
    (readSource(FILTER_BAR_TSX).match(/data-dashboard-filter-bar="true"/g) ?? [])
      .length;
  assert.equal(
    occurrences,
    1,
    "the surfaces.css field rule targets input/select descendants of this anchor for S1/S2/S3/S6/S7; losing it silently stops tinting five of the seven surfaces",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// The CSS rule itself — single canonical consumer, correct declaration, no
// elevation regression.
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_RULE_ANCHOR =
  '.dashboard-app-shell [data-dashboard-filter-bar="true"] input,';

test("the B05 field rule declares background-color from the reserved token, once", () => {
  const source = readSource(SURFACES_CSS);
  const body = stripComments(ruleBody(source, FIELD_RULE_ANCHOR));

  const declarations = body.match(/background-color\s*:([^;]*);/g) ?? [];
  assert.equal(
    declarations.length,
    1,
    `expected exactly one background-color declaration in the B05 field rule, found ${declarations.length}`,
  );
  assert.ok(
    declarations[0].includes(`var(${FIELD_TOKEN})`),
    `the B05 field rule's background-color must read from var(${FIELD_TOKEN}); found: ${declarations[0]}`,
  );

  assert.ok(
    !/box-shadow/.test(body),
    "the B05 field rule must not declare box-shadow — G6 (no elevation on persistent chrome) is a B04 invariant this rule must not touch",
  );
  assert.ok(
    !/\bbackground\s*:/.test(body),
    "the B05 field rule must use background-color, not the background shorthand, so it cannot clear another declared layer on the same element",
  );
});

test("the B05 field rule covers both the shared FilterBar anchor and the direct S4/S5 anchor", () => {
  const block = markedBlock(
    readSource(SURFACES_CSS),
    "dashboard-b05-field-inversion",
  );

  assert.ok(
    /\.dashboard-app-shell \[data-dashboard-filter-bar="true"\] input/.test(
      block,
    ),
    "the rule must select input descendants of [data-dashboard-filter-bar]",
  );
  assert.ok(
    /\.dashboard-app-shell \[data-dashboard-filter-bar="true"\] select/.test(
      block,
    ),
    "the rule must select select descendants of [data-dashboard-filter-bar]",
  );
  assert.ok(
    /\.dashboard-app-shell \[data-dashboard-filter-field="true"\]/.test(
      block,
    ),
    "the rule must select the direct [data-dashboard-filter-field] anchor for S4/S5",
  );
});

test("the B05 field rule is scoped under .dashboard-app-shell", () => {
  const block = stripComments(
    markedBlock(readSource(SURFACES_CSS), "dashboard-b05-field-inversion"),
  );
  const open = block.indexOf("{");
  assert.notEqual(open, -1, "no rule opens inside the B05 field-inversion block");
  const selectorGroup = block.slice(0, open);

  const selectorLines = selectorGroup
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  assert.ok(
    selectorLines.length > 0,
    "the B05 field-inversion block has no selector lines after stripping its comment",
  );
  for (const line of selectorLines) {
    assert.ok(
      line.startsWith(".dashboard-app-shell "),
      `B05 field rule selector escapes the dashboard scope: "${line}"`,
    );
  }
});

test("no component under components/ui or app/globals.css consumes the reserved field token", () => {
  const OUT_OF_SCOPE_PATHS = [
    "frontend/src/components/ui/input.tsx",
    "frontend/src/components/ui/select.tsx",
    "frontend/src/app/globals.css",
  ];

  for (const path of OUT_OF_SCOPE_PATHS) {
    const source = stripComments(readSource(path));
    assert.ok(
      !source.includes(FIELD_TOKEN),
      `${path}: consumes the B05 field token. That token only resolves under .dashboard-app-shell; referencing it from a globally-shared primitive or from globals.css breaks every non-dashboard consumer (public pages, login)`,
    );
  }
});
