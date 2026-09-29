import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import ts from "typescript";
import { isClean7aAllowedDependencyChange } from "../../../helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "../../../helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "../../../helpers/dashboard-scope-guard.ts";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  descendants,
  effectiveAttribute,
  evaluate,
  jsxElements,
  parseTsx,
  tagName,
  unwrap,
} from "./dashboard-source-oracle.ts";

const ADMIN_SECTION_TABS_PATH =
  "frontend/src/app/dashboard/admin/AdminSectionTabs.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const STUDY_TIMELINE_PATH =
  "frontend/src/components/dashboard/StudyTimeline.tsx";
const DASHBOARD_TOPBAR_PATH =
  "frontend/src/components/dashboard/DashboardTopbar.tsx";
const DASHBOARD_NOTIFICATIONS_BELL_PATH =
  "frontend/src/components/dashboard/DashboardNotificationsBell.tsx";
const PUBLIC_SEO_SCOPE_EXCEPTION = "frontend/src/lib/seo.ts";

// TEST-GLOBAL-07 (G06-D01): the step item rendered for each timeline step
// announces `aria-current="step"` for the current status and for no other. A
// later `{...{ "aria-current": undefined }}` keeps the literal attribute in the
// source (C.15.1 M-D15).
function currentStepMarker(source: string) {
  const file = parseTsx(source, STUDY_TIMELINE_PATH);
  const items = jsxElements(file).filter((element) => tagName(element) === "li");
  const [item] = items;
  const config = descendants(file, ts.isVariableDeclaration).find(
    (declaration) => declaration.name.getText() === "TIMELINE_STATUS_CONFIG",
  );
  const statuses = config?.initializer ? unwrap(config.initializer) : undefined;
  const marker = item ? effectiveAttribute(item, "aria-current") : undefined;
  let callback: ts.Node | undefined = item;

  while (callback && !ts.isArrowFunction(callback)) callback = callback.parent;

  return {
    items: items.length,
    mappedOverSteps:
      callback !== undefined &&
      ts.isCallExpression(callback.parent) &&
      callback.parent.expression.getText() === "steps.map",
    ariaCurrent:
      marker?.kind === "value" && statuses && ts.isObjectLiteralExpression(statuses)
        ? Object.fromEntries(
            statuses.properties.map((property) => {
              const status = property.name?.getText() ?? "";
              return [status, evaluate(marker.expression, { step: { status } })];
            }),
          )
        : String(marker?.kind),
  };
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

test("PR-8 StickyActionBar provides named regions and action groups", () => {
  const actionBarSource = read(STICKY_ACTION_BAR_PATH);

  assert.ok(actionBarSource.includes("<section"));
  assert.ok(actionBarSource.includes('aria-label={context ? `${context} del dashboard` : "Acciones del dashboard"}'));
  assert.ok(actionBarSource.includes('aria-label={context ? `Acciones: ${context}` : "Acciones rápidas"}'));
  assert.ok(actionBarSource.includes('aria-label="Acciones contextuales"'));
  assert.ok(actionBarSource.includes('type="button"'));
  assert.ok(actionBarSource.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(actionBarSource, "StickyActionBar");
});

test("PR-8 StudyTimeline expose named panels and textual states", () => {
  const timelineSource = read(STUDY_TIMELINE_PATH);

  assert.ok(timelineSource.includes("<ol"));
  assert.ok(timelineSource.includes("ariaLabel?: string;"));
  assert.ok(timelineSource.includes("aria-label={ariaLabel}"));
  assert.ok(timelineSource.includes('aria-current={step.status === "current" ? "step" : undefined}'));
  assert.ok(timelineSource.includes("Estado: ${config.label}"));
  assert.ok(timelineSource.includes('{step.date ?? "Pendiente"}'));
  assertNoForbiddenSurfaceImports(timelineSource, "StudyTimeline");

  const unmarked = { completed: undefined, current: undefined, pending: undefined, warning: undefined, error: undefined };
  assert.deepEqual(currentStepMarker(timelineSource), {
    items: 1,
    mappedOverSteps: true,
    ariaCurrent: { ...unmarked, current: "step" },
  });

  const overridden = timelineSource.replace(
    'aria-current={step.status === "current" ? "step" : undefined}',
    () => 'aria-current={step.status === "current" ? "step" : undefined}\n{...{ "aria-current": undefined }}',
  );
  assert.notEqual(overridden, timelineSource);
  assert.deepEqual(currentStepMarker(overridden), {
    items: 1,
    mappedOverSteps: true,
    ariaCurrent: unmarked,
  });
});

test("PR-8 Topbar and notification controls keep focus labels", () => {
  const topbarSource = read(DASHBOARD_TOPBAR_PATH);
  const bellSource = read(DASHBOARD_NOTIFICATIONS_BELL_PATH);

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
      `${file} is outside PR-8 dashboard accessibility scope`,
    );
    assert.equal(
      blockedFiles.includes(file),
      false,
      `${file} must not be modified by PR-8`,
    );
  }
});
