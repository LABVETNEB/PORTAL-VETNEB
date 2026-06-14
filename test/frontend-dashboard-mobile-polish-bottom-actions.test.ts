import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_HOME_PATH = "frontend/src/app/dashboard/page.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const STICKY_FILTER_BAR_PATH =
  "frontend/src/components/dashboard/StickyFilterBar.tsx";
const FILTER_DRAWER_PATH = "frontend/src/components/dashboard/FilterDrawer.tsx";
const MASTER_DETAIL_WORKSPACE_PATH =
  "frontend/src/components/dashboard/MasterDetailWorkspace.tsx";
const ADMIN_SECTION_TABS_PATH =
  "frontend/src/app/dashboard/admin/AdminSectionTabs.tsx";
const PUBLIC_SEO_SCOPE_EXCEPTION = "frontend/src/lib/seo.ts";

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

test("PR-9 StickyActionBar keeps mobile bottom safe-area action contract", () => {
  const source = read(STICKY_ACTION_BAR_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("fixed inset-x-0 bottom-0 z-50"));
  assert.ok(source.includes("pb-[calc(0.75rem+env(safe-area-inset-bottom))]"));
  assert.ok(source.includes("md:sticky md:top-[4.75rem]"));
  assert.ok(source.includes("pointer-events-none"));
  assert.ok(source.includes("pointer-events-auto"));
  assert.ok(source.includes("grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2"));
  assert.ok(source.includes("min-h-10 w-full whitespace-normal"));
  assert.ok(source.includes('type="button"'));
  assert.ok(source.includes("<span>{action.label}</span>"));
  assert.ok(source.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(source, "StickyActionBar");
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
});

test("PR-9 StickyFilterBar keeps sticky behavior and internal chip scrolling", () => {
  const source = read(STICKY_FILTER_BAR_PATH);

  assert.ok(source.includes("sticky top-3 z-40"));
  assert.ok(source.includes("max-w-full min-w-0 overflow-hidden"));
  assert.ok(source.includes("overflow-x-auto"));
  assert.ok(source.includes("overscroll-x-contain"));
  assert.ok(source.includes("max-w-[min(16rem,calc(100vw-4rem))]"));
  assert.ok(source.includes("shrink-0"));
  assert.ok(source.includes("Sin filtros activos"));
  assert.equal(source.includes("w-screen"), false);
  assertNoForbiddenSurfaceImports(source, "StickyFilterBar");
});

test("PR-9 FilterDrawer fits mobile viewport and keeps scrollable content", () => {
  const source = read(FILTER_DRAWER_PATH);

  assert.ok(source.includes("fixed inset-0 z-[70] overflow-hidden"));
  assert.ok(source.includes("h-dvh w-full max-w-md max-h-dvh"));
  assert.ok(source.includes("pb-[env(safe-area-inset-bottom)]"));
  assert.ok(source.includes("min-h-0 flex-1 overscroll-contain overflow-y-auto"));
  assert.ok(source.includes("pb-[calc(1rem+env(safe-area-inset-bottom))]"));
  assert.ok(source.includes("focus-visible:ring-2"));
  assert.ok(source.includes('aria-expanded={open}'));
  assert.ok(source.includes('role="dialog"'));
  assertNoForbiddenSurfaceImports(source, "FilterDrawer");
});

test("PR-9 MasterDetailWorkspace and AdminSectionTabs avoid horizontal page overflow", () => {
  const workspaceSource = read(MASTER_DETAIL_WORKSPACE_PATH);
  const tabsSource = read(ADMIN_SECTION_TABS_PATH);

  assert.ok(workspaceSource.includes("grid min-w-0 grid-cols-1"));
  assert.ok(workspaceSource.includes("overflow-x-hidden"));
  assert.ok(workspaceSource.includes("max-w-full min-w-0"));
  assert.ok(workspaceSource.includes("scroll-mt-28"));
  assert.ok(tabsSource.includes("max-w-full min-w-0 space-y-4 overflow-x-hidden"));
  assert.ok(tabsSource.includes("overflow-x-auto overscroll-x-contain"));
  assert.ok(tabsSource.includes("whitespace-nowrap"));
  assert.ok(tabsSource.includes('role="tablist"'));
  assert.ok(tabsSource.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(workspaceSource, "MasterDetailWorkspace");
  assertNoForbiddenSurfaceImports(tabsSource, "AdminSectionTabs");
});

test("PR-9 private dashboard pages leave bottom space for mobile fixed actions", () => {
  const dashboardSource = read(DASHBOARD_HOME_PATH);
  const adminSource = read(ADMIN_PAGE_PATH);
  const informesSource = read(INFORMES_PAGE_PATH);
  const logisticaSource = read(LOGISTICA_PAGE_PATH);

  // PR5: dashboard and admin use DashboardModuleHub (card hub) instead of StickyActionBar.
  // Informes and logistica retain StickyActionBar for their page-level quick actions.
  for (const [context, source] of [
    ["informes", informesSource],
    ["logistica", logisticaSource],
  ] as const) {
    assert.ok(source.includes("<StickyActionBar"), `${context} uses StickyActionBar`);
    assert.ok(
      source.includes('className="h-24 md:hidden" aria-hidden="true"'),
      `${context} keeps mobile bottom spacer`,
    );
  }

  for (const [context, source] of [
    ["dashboard", dashboardSource],
    ["admin", adminSource],
  ] as const) {
    // PR5B: hub is now managed by workspace controllers that internally use DashboardModuleHub.
    const usesHubPattern =
      source.includes("<ClinicDashboardWorkspaceController") ||
      source.includes("<AdminDashboardWorkspaceController") ||
      source.includes("<DashboardModuleHub");
    assert.ok(usesHubPattern, `${context} uses DashboardModuleHub card hub`);
    assert.ok(
      source.includes('className="h-24 md:hidden" aria-hidden="true"'),
      `${context} keeps mobile bottom spacer`,
    );
  }
});

test("PR-9 mobile polish scope avoids forbidden surfaces and dependencies", () => {
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
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
  ];

  const pr4ServerFiles = [
    "server/db.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/contact.fastify.ts",
  ];
  for (const file of changedFiles) {
    if (pr4ServerFiles.includes(file)) continue;
    // Exact shared public SEO exception: this PR intentionally updates
    // OpenGraph/Twitter metadata without changing dashboard behavior.
    if (file === PUBLIC_SEO_SCOPE_EXCEPTION) continue;
    assert.equal(
      blockedPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `${file} is outside PR-9 private dashboard mobile scope`,
    );
    assert.equal(
      blockedFiles.includes(file),
      false,
      `${file} must not be modified by PR-9`,
    );
  }
});
