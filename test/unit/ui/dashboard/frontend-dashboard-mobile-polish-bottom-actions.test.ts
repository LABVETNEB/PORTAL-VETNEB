import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isClean7aAllowedDependencyChange } from "../../../helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "../../../helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "../../../helpers/dashboard-scope-guard.ts";

const DASHBOARD_HOME_PATH = "frontend/src/app/dashboard/page.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
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
  // Mobile actions occupy a SINGLE row sized by the action count. The previous
  // stacked grid (`grid-cols-1` / `min-[420px]:grid-cols-2`) made the bar 185px
  // tall on a 360px phone, which left the logistics hub cards without enough
  // height for their pagers. `grid-flow-col auto-cols-fr` responds to the
  // content instead of hardcoding a column count or a height.
  assert.ok(
    source.includes("grid min-w-0 grid-flow-col auto-cols-fr gap-2"),
    "StickyActionBar keeps the single-row content-sized mobile action grid",
  );
  assert.equal(
    source.includes("min-[420px]:grid-cols-2"),
    false,
    "the stacked mobile action grid must not come back",
  );
  assert.ok(source.includes("min-h-10 w-full whitespace-normal"));
  // The out-of-flow bar must keep its height reserved by the shell ledger; a
  // hardcoded spacer is what the guard below forbids. A05 (#1649) moved that
  // reserve from a height the bar measured and published after mount to a
  // declarative constant the bar exports and its route publishes into
  // `--dash-sticky-action-h` before the first layout — the post-mount
  // measurement was the A05 feedback loop. The end of the ledger contract is
  // pinned by `dashboard-stable-geometry-reservation.test.ts`.
  assert.ok(source.includes("export const STICKY_ACTION_RESERVED_BLOCK_SIZE"));
  assert.ok(
    source.includes("calc(5.5625rem + env(safe-area-inset-bottom, 0px))"),
  );
  assert.ok(source.includes('type="button"'));
  assert.ok(source.includes("<span>{action.label}</span>"));
  assert.ok(source.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(source, "StickyActionBar");
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
});

test("PR-9 AdminSectionTabs avoid horizontal page overflow", () => {
  const tabsSource = read(ADMIN_SECTION_TABS_PATH);

  assert.ok(tabsSource.includes("max-w-full min-w-0 space-y-4 overflow-x-hidden"));
  assert.ok(tabsSource.includes("overflow-x-auto overscroll-x-contain"));
  assert.ok(tabsSource.includes("whitespace-nowrap"));
  assert.ok(tabsSource.includes('role="tablist"'));
  assert.ok(tabsSource.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(tabsSource, "AdminSectionTabs");
});

test("dashboard pages do not use mobile bottom spacers as layout compensation", () => {
  const dashboardSource = read(DASHBOARD_HOME_PATH);
  const adminSource = read(ADMIN_PAGE_PATH);
  const informesSource = read(INFORMES_PAGE_PATH);
  const informesListSource = read(INFORMES_LIST_PATH);
  const logisticaSource = read(LOGISTICA_PAGE_PATH);

  // PR5: dashboard/admin use hubs; PR1012 makes informes profile-layout without StickyActionBar.
  assert.equal(informesSource.includes("<StickyActionBar"), false);
  assert.equal(informesListSource.includes("<StickyActionBar"), false);
  assert.ok(informesListSource.includes("Lista de informes"));
  assert.ok(informesListSource.includes("Detalle del informe"));

  assert.ok(logisticaSource.includes("<StickyActionBar"), "logistica uses StickyActionBar");
  assert.equal(
    logisticaSource.includes('className="h-24 md:hidden" aria-hidden="true"'),
    false,
    "logistica must not keep mobile bottom spacer",
  );

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
    assert.equal(
      source.includes('className="h-24 md:hidden" aria-hidden="true"'),
      false,
      `${context} must not keep mobile bottom spacer`,
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
  // PR-specific guard: only enforce when the diff touches dashboard scope.
  if (!dashboardScopeGuardApplies(changedFiles)) return;
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
    if (isClean7aAllowedDependencyChange(file)) continue;
    if (isReportForeignAccessBackendFile(file)) continue;
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
