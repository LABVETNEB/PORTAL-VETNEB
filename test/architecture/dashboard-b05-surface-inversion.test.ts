import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

function collectFilesRecursive(
  repoRelativeDir: string,
  extensions: RegExp,
): string[] {
  const absoluteDir = resolve(REPO_ROOT, repoRelativeDir);
  const found: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const entryRelative = `${repoRelativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...collectFilesRecursive(entryRelative, extensions));
      continue;
    }
    if (entry.isFile() && extensions.test(entry.name)) {
      found.push(entryRelative);
    }
  }

  return found;
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

// ─────────────────────────────────────────────────────────────────────────────
// Mobile filter portal boundary (Codex P2, PR #1662: "Apply the field token
// inside mobile filter portals").
//
// `ModuleDialog`'s Radix portal mounted at `document.body` by default —
// outside `.dashboard-app-shell` — so the four mobile filter dialogs that
// render a shared `FilterBar` (S1/S3/S6/S7) never received the field tint.
// The fix is an opt-in `dashboardScopedPortal` prop that reparents the
// portal under a dedicated anchor `DashboardShellRouter` renders INSIDE
// `.dashboard-app-shell`; every other `ModuleDialog` keeps its default. No
// CSS or token change was needed: reparenting into the existing DOM subtree
// is what makes both the B05 selector and the token's own inheritance reach
// the mobile field.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_DIALOG_TSX = "frontend/src/components/dashboard/ModuleDialog.tsx";
const DASHBOARD_SHELL_ROUTER_TSX =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const PORTAL_ROOT_ANCHOR = 'data-dashboard-portal-root="true"';
const PORTAL_PROP = "dashboardScopedPortal";
const FRONTEND_SRC = "frontend/src";

/** The four call sites the P2 fix authorizes — no more, no fewer. */
const DASHBOARD_SCOPED_PORTAL_CALL_SITES: ReadonlyArray<{
  readonly path: string;
  readonly why: string;
}> = [
  {
    path: "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx",
    why: "S1 mobile filter dialog",
  },
  {
    path: "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
    why: "S3 mobile filter dialog",
  },
  {
    path: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
    why: "S6 mobile filter dialog",
  },
  {
    path: "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
    why: "S7 mobile filter dialog",
  },
];

test("DashboardShellRouter renders exactly one portal-root anchor inside .dashboard-app-shell", () => {
  const source = readSource(DASHBOARD_SHELL_ROUTER_TSX);

  const occurrences = source.split(PORTAL_ROOT_ANCHOR).length - 1;
  assert.equal(
    occurrences,
    1,
    `${DASHBOARD_SHELL_ROUTER_TSX}: expected exactly one ${PORTAL_ROOT_ANCHOR} anchor, found ${occurrences}`,
  );

  const shellOpen = source.indexOf('className="dashboard-app-shell');
  const anchorIndex = source.indexOf(PORTAL_ROOT_ANCHOR);
  const shellClose = source.lastIndexOf("</div>");
  assert.ok(
    shellOpen !== -1 && shellOpen < anchorIndex && anchorIndex < shellClose,
    "the portal-root anchor must be textually between the dashboard-app-shell opening tag and its closing tag — i.e. a real DOM descendant, not a sibling",
  );
});

test("ModuleDialog exposes an explicit, default-off dashboardScopedPortal prop targeting the exact anchor", () => {
  const source = readSource(MODULE_DIALOG_TSX);

  assert.ok(
    new RegExp(`${PORTAL_PROP}\\?:\\s*boolean`).test(source),
    `${MODULE_DIALOG_TSX} must declare an optional ${PORTAL_PROP}: boolean prop`,
  );
  assert.ok(
    new RegExp(`${PORTAL_PROP}\\s*=\\s*false`).test(source),
    `${MODULE_DIALOG_TSX} must default ${PORTAL_PROP} to false — every other ModuleDialog must keep portalling to document.body unchanged`,
  );
  assert.ok(
    source.includes(PORTAL_ROOT_ANCHOR),
    `${MODULE_DIALOG_TSX} must query the exact anchor DashboardShellRouter renders (${PORTAL_ROOT_ANCHOR}); a mismatched selector silently falls back to document.body`,
  );
  assert.ok(
    /container=\{dashboardScopedPortal\s*\?\s*scopedPortalContainer\s*:\s*undefined\}/.test(
      source,
    ),
    `${MODULE_DIALOG_TSX} must pass undefined (Radix's own document.body default) when dashboardScopedPortal is off, not null or a stale container`,
  );
});

test("exactly the four B05 mobile filter dialogs opt into dashboardScopedPortal, once each", () => {
  for (const entry of DASHBOARD_SCOPED_PORTAL_CALL_SITES) {
    const occurrences =
      readSource(entry.path).split(PORTAL_PROP).length - 1;
    assert.equal(
      occurrences,
      1,
      `${entry.path}: expected exactly one ${PORTAL_PROP} usage (${entry.why}), found ${occurrences}`,
    );
  }
});

test("no ModuleDialog outside the four authorized call sites opts into dashboardScopedPortal", () => {
  const authorizedPaths = new Set(
    DASHBOARD_SCOPED_PORTAL_CALL_SITES.map((entry) => entry.path),
  );
  const tsxFiles = collectFilesRecursive(FRONTEND_SRC, /\.tsx$/).filter(
    (path) => path !== MODULE_DIALOG_TSX,
  );

  const unexpectedConsumers = tsxFiles.filter(
    (path) => !authorizedPaths.has(path) && readSource(path).includes(PORTAL_PROP),
  );

  assert.deepEqual(
    unexpectedConsumers,
    [],
    `unexpected dashboardScopedPortal usage outside the authorized 4 call sites: ${JSON.stringify(unexpectedConsumers)}. Every other ModuleDialog must keep portalling to document.body; converting one silently changes its portal target`,
  );
});

test("S2 (admin-tokens) has no mobile FilterBar dialog and does not opt into dashboardScopedPortal", () => {
  const path = "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
  const source = readSource(path);

  assert.ok(
    !source.includes(PORTAL_PROP),
    `${path}: opts into ${PORTAL_PROP}, but S2's advanced FilterBar renderer is never invoked with mobile=true — there is no mobile dialog instance for this prop to fix`,
  );
  assert.ok(
    !/renderAdvancedFilterForm\(\s*true\s*\)/.test(source),
    `${path}: renderAdvancedFilterForm(true) appeared — S2 now has a mobile FilterBar dialog and needs dashboardScopedPortal too; realign this test and DASHBOARD_SCOPED_PORTAL_CALL_SITES rather than leaving it uncovered`,
  );
});

test("the portal-root anchor and the dashboardScopedPortal prop never reach public or global scope", () => {
  const OUT_OF_SCOPE_ROOTS = [
    "frontend/src/components/public",
    "frontend/src/components/ui",
  ];
  const OUT_OF_SCOPE_FILES = ["frontend/src/app/globals.css"];

  const candidates = [
    ...OUT_OF_SCOPE_ROOTS.flatMap((root) =>
      collectFilesRecursive(root, /\.(tsx?|css)$/),
    ),
    ...OUT_OF_SCOPE_FILES,
  ];

  for (const path of candidates) {
    const source = readSource(path);
    assert.ok(
      !source.includes(PORTAL_ROOT_ANCHOR) && !source.includes(PORTAL_PROP),
      `${path}: references the B05 mobile-portal boundary (${PORTAL_ROOT_ANCHOR} or ${PORTAL_PROP}), which must stay confined to the authenticated dashboard`,
    );
  }
});

test("the B05 E2E manifest no longer deliberately restricts SHARED mobile-capable surfaces to desktop only", () => {
  const specPath =
    "frontend/e2e/regression/dashboard-b05-surface-inversion.spec.ts";
  const source = readSource(specPath);

  // Exactly S1/S3/S6/S7 wire a mobile trigger — one occurrence per surface.
  const mobileTriggerWirings =
    source.split("mobileFilterTriggerName: MOBILE_FILTER_TRIGGER_NAME").length - 1;
  assert.equal(
    mobileTriggerWirings,
    4,
    `${specPath}: expected exactly 4 SHARED surfaces (S1/S3/S6/S7) wired to open their mobile filter dialog, found ${mobileTriggerWirings}`,
  );

  // The pre-fix pattern that silently limited every SHARED surface to
  // desktop must not reappear — this is the exact regression the P2 review
  // caught (the E2E "manifest ... conceals this by assigning only the
  // desktop viewport to every SHARED surface").
  assert.ok(
    !/viewports:\s*\[VIEWPORT_CLASSES\[0\]\],\s*mobileFilterTriggerName/.test(
      source,
    ),
    `${specPath}: a SHARED surface with a mobile trigger must actually run at both viewports, not just VIEWPORT_CLASSES[0]`,
  );

  // The gate must open the real trigger and read computed style through it —
  // asserting on `[data-module-dialog="true"][data-state="open"]` becoming
  // visible is exercising the actual UI, not stubbing the portal internals.
  assert.ok(
    source.includes('[data-module-dialog="true"][data-state="open"]'),
    `${specPath}: must open the real mobile filter dialog (via its trigger) before reading field/container colour, not assume it is already mounted`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutation control — proves the checks above are fail-closed, on small
// synthetic fixtures. Never mutates a tracked file.
// ─────────────────────────────────────────────────────────────────────────────

function assertPortalAnchorPresentOnce(shellRouterSource: string): void {
  const occurrences = shellRouterSource.split(PORTAL_ROOT_ANCHOR).length - 1;
  assert.equal(occurrences, 1, `expected exactly one ${PORTAL_ROOT_ANCHOR}`);
}

function assertFieldRuleUsesToken(cssRuleBody: string): void {
  const declarations = cssRuleBody.match(/background-color\s*:([^;]*);/g) ?? [];
  assert.equal(declarations.length, 1, "expected exactly one background-color");
  assert.ok(
    declarations[0].includes(`var(${FIELD_TOKEN})`),
    `background-color must read var(${FIELD_TOKEN})`,
  );
}

function assertSelectorsScopedToDashboard(selectorBlock: string): void {
  const lines = selectorBlock
    .split(",")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  assert.ok(lines.length > 0, "no selectors to check");
  for (const line of lines) {
    assert.ok(
      line.startsWith(".dashboard-app-shell "),
      `selector escapes the dashboard scope: "${line}"`,
    );
  }
}

const BASELINE_SHELL_ROUTER = `<div className="dashboard-app-shell flex flex-col h-dvh">
  <div data-vetneb-app-shell-frame="true">{children}</div>
  <div ${PORTAL_ROOT_ANCHOR} />
</div>`;

const BASELINE_FIELD_RULE_BODY = `\n  background-color: var(${FIELD_TOKEN});\n`;

const BASELINE_SELECTOR_BLOCK = `.dashboard-app-shell [data-dashboard-filter-bar="true"] input,\n.dashboard-app-shell [data-dashboard-filter-field="true"]`;

test("M5 — the baseline fixtures satisfy every mutation-control assertion", () => {
  assert.doesNotThrow(() => assertPortalAnchorPresentOnce(BASELINE_SHELL_ROUTER));
  assert.doesNotThrow(() => assertFieldRuleUsesToken(BASELINE_FIELD_RULE_BODY));
  assert.doesNotThrow(() => assertSelectorsScopedToDashboard(BASELINE_SELECTOR_BLOCK));
});

test("M1 — removing the portal-root anchor fails closed", () => {
  const mutated = BASELINE_SHELL_ROUTER.replace(`\n  <div ${PORTAL_ROOT_ANCHOR} />`, "");
  assert.throws(() => assertPortalAnchorPresentOnce(mutated), /expected exactly one/);
});

test("M3 — replacing var(--dash-color-field) with a literal fill fails closed", () => {
  const mutated = BASELINE_FIELD_RULE_BODY.replace(
    `var(${FIELD_TOKEN})`,
    "hsl(210 20% 96% / 0.72)",
  );
  assert.throws(() => assertFieldRuleUsesToken(mutated), /must read var/);
});

test("M3b — replacing var(--dash-color-field) with bg-card fails closed", () => {
  const mutated = BASELINE_FIELD_RULE_BODY.replace(
    `background-color: var(${FIELD_TOKEN});`,
    "background-color: hsl(var(--card));",
  );
  assert.throws(() => assertFieldRuleUsesToken(mutated), /must read var/);
});

test("M4 — widening a selector to a public/global scope fails closed", () => {
  const mutated = BASELINE_SELECTOR_BLOCK.replace(
    '.dashboard-app-shell [data-dashboard-filter-field="true"]',
    ':root [data-dashboard-filter-field="true"]',
  );
  assert.throws(
    () => assertSelectorsScopedToDashboard(mutated),
    /escapes the dashboard scope/,
  );
});
