import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_SECTION_TABS_PATH =
  "frontend/src/app/dashboard/admin/AdminSectionTabs.tsx";
const FILTER_DRAWER_PATH = "frontend/src/components/dashboard/FilterDrawer.tsx";
const STICKY_FILTER_BAR_PATH =
  "frontend/src/components/dashboard/StickyFilterBar.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const MASTER_DETAIL_WORKSPACE_PATH =
  "frontend/src/components/dashboard/MasterDetailWorkspace.tsx";
const STUDY_TIMELINE_PATH =
  "frontend/src/components/dashboard/StudyTimeline.tsx";
const DASHBOARD_SIDEBAR_FRAME_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";
const DASHBOARD_TOPBAR_PATH =
  "frontend/src/components/dashboard/DashboardTopbar.tsx";
const DASHBOARD_NOTIFICATIONS_BELL_PATH =
  "frontend/src/components/dashboard/DashboardNotificationsBell.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertNoForbiddenSurfaceImports(source: string, context: string): void {
  const importLines = source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "));
  const forbiddenPatterns = [
    /next\/link/,
    /@\/app\/api/,
    /@\/middleware/,
    /@\/lib\/auth/,
    /\.\.\/.*\/auth/,
    /\.\.\/.*\/middleware/,
  ];

  for (const line of importLines) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(line),
        false,
        `${context} must not import forbidden surface via: ${line}`,
      );
    }
  }
}

test("PR-8 AdminSectionTabs keeps full tab ARIA and keyboard focus contract", () => {
  const source = read(ADMIN_SECTION_TABS_PATH);

  assert.ok(source.includes('role="tablist"'));
  assert.ok(source.includes('role="tab"'));
  assert.ok(source.includes('role="tabpanel"'));
  assert.ok(source.includes("aria-selected={isActive}"));
  assert.ok(source.includes("aria-controls={`admin-section-panel-${tab.id}`}"));
  assert.ok(source.includes("aria-labelledby={`admin-section-tab-${tab.id}`}"));
  assert.ok(source.includes('aria-orientation="horizontal"'));
  assert.ok(source.includes('event.key === "ArrowRight"'));
  assert.ok(source.includes('event.key === "ArrowLeft"'));
  assert.ok(source.includes('event.key === "Home"'));
  assert.ok(source.includes('event.key === "End"'));
  assert.ok(source.includes("focus-visible:ring-2"));
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("<Link"), false);
});

test("PR-8 FilterDrawer announces trigger state count and keyboard dismiss", () => {
  const source = read(FILTER_DRAWER_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("const panelRef = useRef<HTMLDivElement>(null);"));
  assert.ok(source.includes("const activeCountLabel ="));
  assert.ok(source.includes('aria-expanded={open}'));
  assert.ok(source.includes('aria-haspopup="dialog"'));
  assert.ok(source.includes("aria-label={`${triggerLabel}. ${activeCountLabel}`}"));
  assert.ok(source.includes('<span className="sr-only">{activeCountLabel}</span>'));
  assert.ok(source.includes('role="dialog"'));
  assert.ok(source.includes('aria-labelledby={titleId}'));
  assert.ok(source.includes("tabIndex={-1}"));
  assert.ok(source.includes('event.key === "Escape"'));
  assert.ok(source.includes('aria-label="Cerrar panel de filtros"'));
  assert.ok(source.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(source, "FilterDrawer");
});

test("PR-8 StickyFilterBar and StickyActionBar provide named regions and action groups", () => {
  const filterBarSource = read(STICKY_FILTER_BAR_PATH);
  const actionBarSource = read(STICKY_ACTION_BAR_PATH);

  assert.ok(filterBarSource.includes("ariaLabel?: string;"));
  assert.ok(filterBarSource.includes('aria-label={ariaLabel ?? "Filtros del dashboard"}'));
  assert.ok(filterBarSource.includes('aria-label="Filtros activos"'));
  assert.ok(filterBarSource.includes('aria-live="polite"'));
  assert.ok(filterBarSource.includes('aria-label="Acciones de filtros"'));
  assert.ok(filterBarSource.includes("Sin filtros activos"));
  assert.ok(actionBarSource.includes("<section"));
  assert.ok(actionBarSource.includes('aria-label={context ? `${context} del dashboard` : "Acciones del dashboard"}'));
  assert.ok(actionBarSource.includes('aria-label={context ? `Acciones: ${context}` : "Acciones rápidas"}'));
  assert.ok(actionBarSource.includes('aria-label="Acciones contextuales"'));
  assert.ok(actionBarSource.includes('type="button"'));
  assert.ok(actionBarSource.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(filterBarSource, "StickyFilterBar");
  assertNoForbiddenSurfaceImports(actionBarSource, "StickyActionBar");
});

test("PR-8 MasterDetailWorkspace and StudyTimeline expose named panels and textual states", () => {
  const workspaceSource = read(MASTER_DETAIL_WORKSPACE_PATH);
  const timelineSource = read(STUDY_TIMELINE_PATH);

  assert.ok(workspaceSource.includes("workspaceLabel?: string;"));
  assert.ok(workspaceSource.includes("masterLabel?: string;"));
  assert.ok(workspaceSource.includes("detailLabel?: string;"));
  assert.ok(workspaceSource.includes("aria-label={workspaceLabel}"));
  assert.ok(workspaceSource.includes("aria-label={masterLabel}"));
  assert.ok(workspaceSource.includes("aria-label={detailLabel}"));
  assert.ok(workspaceSource.includes('data-detail-state={hasSelection ? "selected" : "empty"}'));
  assert.ok(workspaceSource.includes('aria-live="polite"'));
  assert.ok(workspaceSource.includes("Sin detalle seleccionado"));
  assert.ok(timelineSource.includes("<ol"));
  assert.ok(timelineSource.includes("ariaLabel?: string;"));
  assert.ok(timelineSource.includes("aria-label={ariaLabel}"));
  assert.ok(timelineSource.includes('aria-current={step.status === "current" ? "step" : undefined}'));
  assert.ok(timelineSource.includes("Estado: ${config.label}"));
  assert.ok(timelineSource.includes('{step.date ?? "Pendiente"}'));
  assertNoForbiddenSurfaceImports(workspaceSource, "MasterDetailWorkspace");
  assertNoForbiddenSurfaceImports(timelineSource, "StudyTimeline");
});

test("PR-8 DashboardSidebarFrame Topbar and notification controls keep focus labels", () => {
  const sidebarSource = read(DASHBOARD_SIDEBAR_FRAME_PATH);
  const topbarSource = read(DASHBOARD_TOPBAR_PATH);
  const bellSource = read(DASHBOARD_NOTIFICATIONS_BELL_PATH);

  assert.ok(sidebarSource.includes('aria-label="Navegación principal"'));
  assert.ok(sidebarSource.includes('aria-label="Menú principal"'));
  assert.ok(sidebarSource.includes("aria-label={item.label}"));
  assert.ok(sidebarSource.includes("aria-label={child.label}"));
  assert.ok(sidebarSource.includes('aria-label="Volver al sitio público"'));
  assert.ok(sidebarSource.includes("focus-visible:ring-2"));
  assert.ok(topbarSource.includes('aria-label="Barra superior del dashboard"'));
  assert.ok(topbarSource.includes('aria-labelledby="dashboard-topbar-title"'));
  assert.ok(topbarSource.includes('id="dashboard-topbar-title"'));
  assert.ok(topbarSource.includes("focus-visible:ring-2"));
  assert.ok(bellSource.includes('aria-haspopup="dialog"'));
  assert.ok(bellSource.includes("aria-expanded={isOpen}"));
  assert.ok(bellSource.includes("aria-controls={isOpen ? `${desktopPanelId} ${mobilePanelId}` : undefined}"));
  assert.ok(bellSource.includes('role="dialog"'));
  assert.ok(bellSource.includes("focus-visible:ring-2"));
});

test("PR-8 dashboard accessibility scope avoids forbidden files", () => {
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
    "frontend/src/app/servicios/",
    "frontend/src/app/histopatologia-veterinaria/",
  ];
  const blockedFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/next-env.d.ts",
    "frontend/tsconfig.json",
    "frontend/src/app/layout.tsx",
    "frontend/src/app/page.tsx",
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
  ];

  const pr4ServerFiles = ["server/db.ts", "server/routes/reports.fastify.ts"];
  for (const file of changedFiles) {
    if (pr4ServerFiles.includes(file)) continue;
    assert.equal(
      blockedPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `${file} is outside PR-8 dashboard accessibility scope`,
    );
    assert.equal(
      blockedFiles.includes(file),
      false,
      `${file} must not be modified by PR-8`,
    );
  }
});
