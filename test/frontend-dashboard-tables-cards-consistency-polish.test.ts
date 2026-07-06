import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readDashboardCssSource } from "./helpers/read-dashboard-css-source.ts";

const SESSIONS_CARD_PATH = "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";
const FAILED_LOGINS_CARD_PATH = "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx";
const USERS_ROLES_CARD_PATH = "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
const REPORT_WORKFLOW_CARD_PATH = "frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx";
const STATS_CARDS_PATH = "frontend/src/components/dashboard/StatsCards.tsx";
const TABLE_COMPONENT_PATH = "frontend/src/components/ui/table.tsx";
const CLINICS_CARD_PATH = "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

// ── CSS section markers ──────────────────────────────────────────────────────

test("PR-7 globals.css has dashboard-tables-cards-consistency-polish section markers", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes("/* dashboard-tables-cards-consistency-polish:start */"),
    "globals.css must have dashboard-tables-cards-consistency-polish:start comment",
  );
  assert.ok(
    source.includes("/* dashboard-tables-cards-consistency-polish:end */"),
    "globals.css must have dashboard-tables-cards-consistency-polish:end comment",
  );
});

// ── New CSS classes ──────────────────────────────────────────────────────────

test("PR-7 globals.css defines .dashboard-table-pagination utility", () => {
  const source = readDashboardCssSource();
  const section = source.slice(
    source.indexOf("/* dashboard-tables-cards-consistency-polish:start */"),
    source.indexOf("/* dashboard-tables-cards-consistency-polish:end */") + 1,
  );
  assert.ok(
    section.includes(".dashboard-table-pagination {"),
    "globals.css must define .dashboard-table-pagination",
  );
  assert.ok(
    section.includes("@apply flex flex-col gap-2 md:flex-row md:items-center md:justify-between"),
    ".dashboard-table-pagination must apply responsive flex layout",
  );
});

test("PR-7 globals.css defines .dashboard-table-pagination-controls utility", () => {
  const source = readDashboardCssSource();
  const section = source.slice(
    source.indexOf("/* dashboard-tables-cards-consistency-polish:start */"),
    source.indexOf("/* dashboard-tables-cards-consistency-polish:end */") + 1,
  );
  assert.ok(
    section.includes(".dashboard-table-pagination-controls {"),
    "globals.css must define .dashboard-table-pagination-controls",
  );
  assert.ok(
    section.includes("@apply flex items-center gap-2"),
    ".dashboard-table-pagination-controls must apply flex layout",
  );
});

test("PR-7 globals.css defines .dashboard-card-header-border utility", () => {
  const source = readDashboardCssSource();
  const section = source.slice(
    source.indexOf("/* dashboard-tables-cards-consistency-polish:start */"),
    source.indexOf("/* dashboard-tables-cards-consistency-polish:end */") + 1,
  );
  assert.ok(
    section.includes(".dashboard-card-header-border {"),
    "globals.css must define .dashboard-card-header-border",
  );
});

test("PR-7 globals.css defines .dashboard-filter-stats-grid-5 variant", () => {
  const source = readDashboardCssSource();
  const section = source.slice(
    source.indexOf("/* dashboard-tables-cards-consistency-polish:start */"),
    source.indexOf("/* dashboard-tables-cards-consistency-polish:end */") + 1,
  );
  assert.ok(
    section.includes(".dashboard-filter-stats-grid-5 {"),
    "globals.css must define .dashboard-filter-stats-grid-5",
  );
  assert.ok(
    section.includes("@apply grid grid-cols-1 gap-3 md:grid-cols-5"),
    ".dashboard-filter-stats-grid-5 must apply 5-column grid layout",
  );
});

// ── Stats grid class usage ───────────────────────────────────────────────────

test("PR-7 AdminSessionsReadOnlyCard uses dashboard-filter-stats-grid for stats bar", () => {
  const source = read(SESSIONS_CARD_PATH);
  assert.ok(
    source.includes("dashboard-filter-stats-grid"),
    "AdminSessionsReadOnlyCard must use dashboard-filter-stats-grid class for stats bar",
  );
  assert.equal(
    source.includes('className="grid grid-cols-1 gap-3 md:grid-cols-4"'),
    false,
    "AdminSessionsReadOnlyCard must not hardcode 4-col grid — use dashboard-filter-stats-grid",
  );
});

test("PR-7 AdminFailedLoginAlertsReadOnlyCard uses dashboard-filter-stats-grid for stats bar", () => {
  const source = read(FAILED_LOGINS_CARD_PATH);
  assert.ok(
    source.includes("dashboard-filter-stats-grid"),
    "AdminFailedLoginAlertsReadOnlyCard must use dashboard-filter-stats-grid class",
  );
  assert.equal(
    source.includes('className="grid grid-cols-1 gap-3 md:grid-cols-4"'),
    false,
    "AdminFailedLoginAlertsReadOnlyCard must not hardcode 4-col grid",
  );
});

test("PR-7A AdminUsersRolesReadOnlyCard uses a compact three-metric strip", () => {
  const source = read(USERS_ROLES_CARD_PATH);
  assert.ok(
    source.includes("grid min-h-11 shrink-0 grid-cols-3"),
    "AdminUsersRolesReadOnlyCard must keep its metrics in one compact row",
  );
  assert.equal(
    source.includes("dashboard-filter-stats-grid-5"),
    false,
    "AdminUsersRolesReadOnlyCard must not use the former stacked five-card grid",
  );
});

// ── Pagination footer class usage ────────────────────────────────────────────

test("PR-7 AdminSessionsReadOnlyCard pagination uses dashboard-table-pagination", () => {
  const source = read(SESSIONS_CARD_PATH);
  assert.ok(
    source.includes("dashboard-table-pagination"),
    "AdminSessionsReadOnlyCard must use dashboard-table-pagination class",
  );
  assert.ok(
    source.includes("dashboard-table-pagination-controls"),
    "AdminSessionsReadOnlyCard must use dashboard-table-pagination-controls class",
  );
});

test("PR-7 AdminFailedLoginAlertsReadOnlyCard pagination uses dashboard-table-pagination", () => {
  const source = read(FAILED_LOGINS_CARD_PATH);
  assert.ok(
    source.includes("dashboard-table-pagination"),
    "AdminFailedLoginAlertsReadOnlyCard must use dashboard-table-pagination class",
  );
  assert.ok(
    source.includes("dashboard-table-pagination-controls"),
    "AdminFailedLoginAlertsReadOnlyCard must use dashboard-table-pagination-controls class",
  );
});

test("PR-7 AdminUsersRolesReadOnlyCard pagination uses dashboard-table-pagination and context span", () => {
  const source = read(USERS_ROLES_CARD_PATH);
  assert.ok(
    source.includes("dashboard-table-pagination"),
    "AdminUsersRolesReadOnlyCard must use dashboard-table-pagination class",
  );
  assert.ok(
    source.includes("dashboard-table-pagination-controls"),
    "AdminUsersRolesReadOnlyCard must use dashboard-table-pagination-controls class",
  );
  assert.ok(
    source.includes("dashboard-pagination-context"),
    "AdminUsersRolesReadOnlyCard must include dashboard-pagination-context span",
  );
});

// ── Report workflow card consistency ─────────────────────────────────────────

test("PR-7 AdminReportWorkflowViewerCard has border-b on CardHeader", () => {
  const source = read(REPORT_WORKFLOW_CARD_PATH);
  assert.ok(
    source.includes("border-b border-vetneb-line/70"),
    "AdminReportWorkflowViewerCard CardHeader must have border-b border-vetneb-line/70",
  );
});

test("PR-7 AdminReportWorkflowViewerCard uses lg flex breakpoint on CardHeader (consistent with other cards)", () => {
  const source = read(REPORT_WORKFLOW_CARD_PATH);
  assert.ok(
    source.includes("lg:flex-row"),
    "AdminReportWorkflowViewerCard CardHeader must use lg:flex-row breakpoint",
  );
  assert.equal(
    source.includes("sm:flex-row sm:items-center sm:justify-between"),
    false,
    "AdminReportWorkflowViewerCard CardHeader must not use sm: breakpoints for flex (use lg: to match other cards)",
  );
});

test("PR-7 AdminReportWorkflowViewerCard wraps Table in dashboard-table-responsive", () => {
  const source = read(REPORT_WORKFLOW_CARD_PATH);
  assert.ok(
    source.includes("dashboard-table-responsive"),
    "AdminReportWorkflowViewerCard must wrap Table in dashboard-table-responsive",
  );
});

test("PR-7 AdminReportWorkflowViewerCard workflow select uses field-select class", () => {
  const source = read(REPORT_WORKFLOW_CARD_PATH);
  assert.ok(
    source.includes("field-select"),
    "AdminReportWorkflowViewerCard workflow stage select must use field-select class",
  );
  assert.equal(
    source.includes("rounded-md border border-input bg-background px-2 py-1.5 text-xs"),
    false,
    "AdminReportWorkflowViewerCard must not use ad-hoc select classes — use field-select",
  );
});

test("PR-7 AdminReportWorkflowViewerCard pagination uses dashboard-table-pagination classes and context span", () => {
  const source = read(REPORT_WORKFLOW_CARD_PATH);
  assert.ok(
    source.includes("dashboard-table-pagination"),
    "AdminReportWorkflowViewerCard must use dashboard-table-pagination class",
  );
  assert.ok(
    source.includes("dashboard-table-pagination-controls"),
    "AdminReportWorkflowViewerCard must use dashboard-table-pagination-controls class",
  );
  assert.ok(
    source.includes("dashboard-pagination-context"),
    "AdminReportWorkflowViewerCard must include dashboard-pagination-context span",
  );
});

// ── StatsCards skeleton/data gap consistency ─────────────────────────────────

test("PR-7 StatsCards loading skeleton uses gap-3 to match data render", () => {
  const source = read(STATS_CARDS_PATH);
  const loadingMatch = source.match(/if \(loading\)[\s\S]*?return \([\s\S]*?<\/div>\s*\)/);
  assert.ok(loadingMatch, "StatsCards must have loading branch");
  const loadingBlock = loadingMatch[0];
  assert.ok(
    loadingBlock.includes("gap-3"),
    "StatsCards loading skeleton must use gap-3 to match data render gap",
  );
  assert.equal(
    loadingBlock.includes("gap-4"),
    false,
    "StatsCards loading skeleton must not use gap-4 (mismatch with data render)",
  );
});

// ── Table component baseline ─────────────────────────────────────────────────

test("PR-7 Table component keeps vetneb-line border and card background", () => {
  const source = read(TABLE_COMPONENT_PATH);
  assert.ok(
    source.includes("border-vetneb-line/75"),
    "Table wrapper must keep border-vetneb-line/75 border",
  );
  assert.ok(
    source.includes("bg-card/92"),
    "Table wrapper must keep bg-card/92 background",
  );
  assert.ok(
    source.includes("shadow-[0_10px_30px_rgba(15,45,62,0.06)]"),
    "Table wrapper must keep consistent shadow",
  );
});

test("PR-7 TableHead keeps uppercase tracking and muted-foreground color", () => {
  const source = read(TABLE_COMPONENT_PATH);
  assert.ok(
    source.includes("uppercase tracking-[0.08em]"),
    "TableHead must keep uppercase tracking for readable column headers",
  );
  assert.ok(
    source.includes("text-muted-foreground"),
    "TableHead must use text-muted-foreground for visual hierarchy",
  );
});

test("PR-7 TableRow keeps hover state and vetneb-line border", () => {
  const source = read(TABLE_COMPONENT_PATH);
  assert.ok(
    source.includes("hover:bg-vetneb-surface-muted/45"),
    "TableRow must keep hover:bg-vetneb-surface-muted/45 for consistent row hover",
  );
  assert.ok(
    source.includes("border-b border-vetneb-line/60"),
    "TableRow must keep border-b border-vetneb-line/60 for row separators",
  );
});

// ── AdminClinicsManagementCard baseline ─────────────────────────────────────

test("PR-7 AdminClinicsManagementCard keeps dashboard-table-responsive wrapper", () => {
  const source = read(CLINICS_CARD_PATH);
  assert.ok(
    source.includes("dashboard-table-responsive"),
    "AdminClinicsManagementCard must keep dashboard-table-responsive wrapper",
  );
});

test("PR-7 AdminClinicsManagementCard keeps border-b border-vetneb-line/70 on CardHeader", () => {
  const source = read(CLINICS_CARD_PATH);
  assert.ok(
    source.includes("border-b border-vetneb-line/70"),
    "AdminClinicsManagementCard CardHeader must keep border-b border-vetneb-line/70",
  );
});
