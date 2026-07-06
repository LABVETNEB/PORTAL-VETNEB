import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertClean7aDependencyCleanupScope,
  isClean7aAllowedDependencyChange,
  isClean7aAllowedDependencyFile,
} from "./helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "./helpers/report-foreign-access-scope.ts";
import { readDashboardCssSource } from "./helpers/read-dashboard-css-source.ts";

const WORKSPACE_PATH =
  "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx";
const FILTER_DRAWER_PATH =
  "frontend/src/components/dashboard/FilterDrawer.tsx";
const SIDEBAR_FRAME_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const DASHBOARD_SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const PUBLIC_SEO_SCOPE_EXCEPTION = "frontend/src/lib/seo.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── CSS section present ──────────────────────────────────────────────────────

test("PR-2 globals.css has dashboard-workspace-layout-polish section markers", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes("/* dashboard-workspace-layout-polish:start */"),
    "globals.css must have dashboard-workspace-layout-polish:start comment",
  );
  assert.ok(
    source.includes("/* dashboard-workspace-layout-polish:end */"),
    "globals.css must have dashboard-workspace-layout-polish:end comment",
  );
});

// ── Keyframe and enter animation ─────────────────────────────────────────────

test("PR-2 globals.css defines @keyframes dashboard-workspace-enter", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes("@keyframes dashboard-workspace-enter {"),
    "globals.css must define @keyframes dashboard-workspace-enter",
  );
  assert.ok(
    source.includes("opacity: 0;"),
    "@keyframes dashboard-workspace-enter must include opacity: 0 in from",
  );
  assert.ok(
    source.includes("translateY(6px)"),
    "@keyframes dashboard-workspace-enter must include translateY(6px) in from",
  );
});

test("PR-2 globals.css defines .dashboard-workspace-enter using motion tokens", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes(".dashboard-workspace-enter {"),
    "globals.css must define .dashboard-workspace-enter",
  );
  assert.ok(
    source.includes("animation: dashboard-workspace-enter var(--motion-base) var(--ease-out-soft) both"),
    ".dashboard-workspace-enter must use --motion-base and --ease-out-soft tokens",
  );
});

test("PR-2 globals.css reduced-motion disables dashboard-workspace-enter animation", () => {
  const source = readDashboardCssSource();
  const polishSection = source.slice(
    source.indexOf("/* dashboard-workspace-layout-polish:start */"),
    source.indexOf("/* dashboard-workspace-layout-polish:end */") + 1,
  );
  assert.ok(
    polishSection.includes("@media (prefers-reduced-motion: reduce)"),
    "dashboard-workspace-layout-polish must have prefers-reduced-motion block",
  );
  assert.ok(
    polishSection.includes(".dashboard-workspace-enter {"),
    "reduced-motion block must target .dashboard-workspace-enter",
  );
  const rmIdx = polishSection.lastIndexOf("@media (prefers-reduced-motion: reduce)");
  const rmSection = polishSection.slice(rmIdx);
  assert.ok(
    rmSection.includes("animation: none;"),
    "reduced-motion must set animation: none on .dashboard-workspace-enter",
  );
});

// ── Workspace header separator ────────────────────────────────────────────────

test("PR-2 globals.css defines .dashboard-workspace-header without border separator", () => {
  const source = readDashboardCssSource();
  // Scope to this section's own delimiters: the base rule lives here, while
  // admin-mobile declares a higher-specificity `.dashboard-workspace-header`
  // override that can precede it in the composed dashboard CSS source.
  const polishSection = source.slice(
    source.indexOf("/* dashboard-workspace-layout-polish:start */"),
    source.indexOf("/* dashboard-workspace-layout-polish:end */") + 1,
  );
  assert.ok(
    polishSection.includes(".dashboard-workspace-header {"),
    "globals.css must define .dashboard-workspace-header",
  );
  const headerIdx = polishSection.indexOf(".dashboard-workspace-header {");
  const headerRule = polishSection.slice(
    headerIdx,
    polishSection.indexOf("}", headerIdx),
  );
  assert.ok(
    headerRule.includes("border-bottom: 0;"),
    ".dashboard-workspace-header must not render a border-bottom separator",
  );
  assert.ok(
    headerRule.includes("padding-bottom: 0;"),
    ".dashboard-workspace-header must not reserve padding-bottom",
  );
  assert.ok(
    headerRule.includes("margin-bottom: 0;"),
    ".dashboard-workspace-header must not reserve margin-bottom",
  );
});

// ── Master-detail panel polish ─────────────────────────────────────────────

test("PR-2 globals.css defines .dashboard-master-panel", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes(".dashboard-master-panel {"),
    "globals.css must define .dashboard-master-panel",
  );
});

test("PR-2 globals.css defines .dashboard-detail-panel", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes(".dashboard-detail-panel {"),
    "globals.css must define .dashboard-detail-panel",
  );
});

test("PR-2 globals.css defines .dashboard-detail-panel selected state", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes('.dashboard-detail-panel[data-detail-state="selected"]'),
    "globals.css must define .dashboard-detail-panel selected state",
  );
});

// ── Sidebar nav interactive ──────────────────────────────────────────────────

test("PR-2 globals.css defines .dashboard-nav-interactive with motion tokens", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes(".dashboard-nav-interactive {"),
    "globals.css must define .dashboard-nav-interactive",
  );
  assert.ok(
    source.includes("transition-duration: var(--motion-fast);"),
    ".dashboard-nav-interactive must use --motion-fast token",
  );
  assert.ok(
    source.includes("transition-timing-function: var(--ease-out-soft);"),
    ".dashboard-nav-interactive must use --ease-out-soft token",
  );
});

// ── Filter drawer panel ──────────────────────────────────────────────────────

test("PR-2 globals.css defines .dashboard-filter-panel with shadow", () => {
  const source = readDashboardCssSource();
  assert.ok(
    source.includes(".dashboard-filter-panel {"),
    "globals.css must define .dashboard-filter-panel",
  );
  assert.ok(
    source.includes("box-shadow: -14px 0 44px"),
    ".dashboard-filter-panel must define a lateral box-shadow",
  );
});

// ── Component: DashboardModuleWorkspace ──────────────────────────────────────

test("PR-2 DashboardModuleWorkspace applies dashboard-workspace-enter to section", () => {
  const source = read(WORKSPACE_PATH);
  assert.ok(
    source.includes("dashboard-workspace-enter"),
    "DashboardModuleWorkspace section must use dashboard-workspace-enter class",
  );
});

test("PR-2 DashboardModuleWorkspace header uses dashboard-workspace-header class", () => {
  const source = read(WORKSPACE_PATH);
  assert.ok(
    source.includes("dashboard-workspace-header"),
    "DashboardModuleWorkspace header div must use dashboard-workspace-header class",
  );
});

test("PR-2 DashboardModuleWorkspace does not use plain mb-4 on header div", () => {
  const source = read(WORKSPACE_PATH);
  assert.equal(
    source.includes('"mb-4 flex flex-col'),
    false,
    "DashboardModuleWorkspace must not use plain mb-4 on header; use dashboard-workspace-header instead",
  );
});

test("PR-2 DashboardModuleWorkspace keeps data-dashboard-module-workspace attribute", () => {
  const source = read(WORKSPACE_PATH);
  assert.ok(
    source.includes("data-dashboard-module-workspace={moduleId}"),
    "DashboardModuleWorkspace must keep data-dashboard-module-workspace attribute",
  );
});

test("PR-2 DashboardModuleWorkspace keeps dashboard-btn-interactive on Volver button", () => {
  const source = read(WORKSPACE_PATH);
  assert.ok(
    source.includes("dashboard-btn-interactive"),
    "DashboardModuleWorkspace Volver button must keep dashboard-btn-interactive class",
  );
});

test("PR-2 DashboardModuleWorkspace keeps focus-visible ring on Volver button", () => {
  const source = read(WORKSPACE_PATH);
  assert.ok(
    source.includes("focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"),
    "DashboardModuleWorkspace Volver button must keep focus-visible ring",
  );
});

// ── Component: FilterDrawer ───────────────────────────────────────────────────

test("PR-2 FilterDrawer dialog panel uses dashboard-filter-panel class", () => {
  const source = read(FILTER_DRAWER_PATH);
  assert.ok(
    source.includes("dashboard-filter-panel"),
    "FilterDrawer dialog panel must use dashboard-filter-panel class",
  );
});

test("PR-2 FilterDrawer dialog panel does not use shadow-lg", () => {
  const source = read(FILTER_DRAWER_PATH);
  assert.equal(
    source.includes("shadow-lg"),
    false,
    "FilterDrawer dialog panel must not use shadow-lg; use dashboard-filter-panel instead",
  );
});

test("PR-2 FilterDrawer keeps role=dialog and aria-modal for accessibility", () => {
  const source = read(FILTER_DRAWER_PATH);
  assert.ok(
    source.includes('role="dialog"'),
    "FilterDrawer must keep role=dialog",
  );
  assert.ok(
    source.includes('aria-modal="true"'),
    "FilterDrawer must keep aria-modal",
  );
});

test("PR-2 FilterDrawer keeps data-filter-drawer-open attribute", () => {
  const source = read(FILTER_DRAWER_PATH);
  assert.ok(
    source.includes('data-filter-drawer-open="true"'),
    "FilterDrawer must keep data-filter-drawer-open attribute",
  );
});

// ── Component: DashboardSidebarFrame ─────────────────────────────────────────

test("PR-2 DashboardSidebarFrame nav items use dashboard-nav-interactive class", () => {
  const source = read(SIDEBAR_FRAME_PATH);
  assert.ok(
    source.includes("dashboard-nav-interactive"),
    "DashboardSidebarFrame nav items must use dashboard-nav-interactive class",
  );
});

test("PR-2 DashboardSidebarFrame nav items do not use transition-colors", () => {
  const source = read(SIDEBAR_FRAME_PATH);
  assert.equal(
    source.includes("transition-colors"),
    false,
    "DashboardSidebarFrame nav items must not use transition-colors; use dashboard-nav-interactive instead",
  );
});

test("PR-2 DashboardSidebarFrame keeps focus-visible ring on nav items", () => {
  const source = read(SIDEBAR_FRAME_PATH);
  assert.ok(
    source.includes("focus-visible:ring-2 focus-visible:ring-ring/85"),
    "DashboardSidebarFrame nav items must keep focus-visible ring",
  );
});

test("PR-2 DashboardSidebarFrame keeps aria-current for active nav item", () => {
  const source = read(SIDEBAR_FRAME_PATH);
  assert.ok(
    source.includes('aria-current={isActive(item.href, item.exact) ? "page" : undefined}'),
    "DashboardSidebarFrame must keep aria-current for active nav item",
  );
});

// ── Component: StickyActionBar ────────────────────────────────────────────────

test("PR-2 StickyActionBar action buttons use dashboard-btn-interactive class", () => {
  const source = read(STICKY_ACTION_BAR_PATH);
  assert.ok(
    source.includes("dashboard-btn-interactive"),
    "StickyActionBar action buttons must use dashboard-btn-interactive class",
  );
});

test("PR-2 StickyActionBar keeps data-sticky-action-bar attribute", () => {
  const source = read(STICKY_ACTION_BAR_PATH);
  assert.ok(
    source.includes('data-sticky-action-bar="true"'),
    "StickyActionBar must keep data-sticky-action-bar attribute",
  );
});

test("PR-2 StickyActionBar keeps focus-visible ring on action buttons", () => {
  const source = read(STICKY_ACTION_BAR_PATH);
  assert.ok(
    source.includes("focus-visible:ring-2 focus-visible:ring-ring/85"),
    "StickyActionBar action buttons must keep focus-visible ring",
  );
});

// ── No global scroll ──────────────────────────────────────────────────────────

test("PR-2 DashboardShellRouter keeps h-dvh overflow-hidden preventing global scroll", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);
  assert.ok(
    source.includes("h-dvh overflow-hidden"),
    "DashboardShellRouter must keep h-dvh overflow-hidden to prevent global scroll",
  );
});

// ── No AdminSectionTabs as navigation ────────────────────────────────────────

test("PR-2 DashboardShellRouter does not import AdminSectionTabs", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);
  assert.equal(
    source.includes("import { AdminSectionTabs }"),
    false,
    "DashboardShellRouter must not import AdminSectionTabs as navigation",
  );
});

// ── No new dependencies ───────────────────────────────────────────────────────

test("PR-2 workspace layout polish does not add new dependencies", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const depFiles = changedFiles.filter(
    (f) =>
      f === "package.json" ||
      f === "pnpm-lock.yaml" ||
      f === "frontend/package.json" ||
      f === "frontend/pnpm-lock.yaml",
  );

  assertClean7aDependencyCleanupScope();
  assert.deepEqual(
    depFiles.filter((file) => !isClean7aAllowedDependencyFile(file)),
    [],
    `PR-2 must not add new dependencies; modified dep files: ${depFiles.join(", ")}`,
  );
});

// ── Scope guard ───────────────────────────────────────────────────────────────

test("PR-2 workspace layout polish stays within allowed file scope", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const blockedPrefixes = [
    "server/",
    "drizzle/",
    "shared/",
    "frontend/src/app/api/",
    "frontend/src/middleware",
  ];

  const blockedExactFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/next-env.d.ts",
    "frontend/tsconfig.json",
    "frontend/src/app/layout.tsx",
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
    "frontend/src/middleware.ts",
  ];

  for (const file of changedFiles) {
    if (isClean7aAllowedDependencyChange(file)) continue;
    if (isReportForeignAccessBackendFile(file)) continue;
    if (file === "server/routes/contact.fastify.ts") continue;
    // Exact shared public SEO exception: this PR intentionally updates
    // OpenGraph/Twitter metadata without changing dashboard behavior.
    if (file === PUBLIC_SEO_SCOPE_EXCEPTION) continue;
    assert.equal(
      blockedPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `PR-2 must not touch blocked prefix: ${file}`,
    );
    assert.equal(
      blockedExactFiles.includes(file),
      false,
      `PR-2 must not modify blocked file: ${file}`,
    );
  }
});
