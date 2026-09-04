import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGER_PATH =
  "frontend/src/components/dashboard/DashboardPager.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const LOGISTICS_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const LOGISTICS_RECENT_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx";
const INFORMES_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const ZERO_SCROLL_CSS_PATH =
  "frontend/src/styles/dashboard/zero-scroll.css";
const DIRECT_DASHBOARD_PAGERS = [
  INFORMES_PATH,
  "frontend/src/app/dashboard/logistica/visitas/page.tsx",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx",
] as const;
const ADAPTIVE_RENDERINGS = [
  "frontend/src/app/dashboard/admin/AdminAuditCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx",
  "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx",
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx",
  "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
  "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
  INFORMES_PATH,
  LOGISTICS_RECENT_PATH,
  "frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx",
] as const;

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("A05 derives the measured rows canvas from available layout, not row content", () => {
  for (const path of ADAPTIVE_RENDERINGS) {
    const source = read(path);
    assert.ok(source.includes("min-h-0"), path);
    assert.ok(
      source.includes("flex-1") ||
        (path.endsWith("LogisticsBoundedCanvas.tsx") && source.includes("h-full")),
      `${path} must derive its block size from an allocated parent region`,
    );
  }
});

test("A05 declares a dashboard-scoped pager reservation without changing its token", () => {
  const source = read(DASHBOARD_PAGER_PATH);
  const css = read(ZERO_SCROLL_CSS_PATH);

  assert.ok(
    source.includes('"--dash-adaptive-pager-reserved-block-size":') &&
      source.includes('"var(--dash-pagination-h, 2.5rem)"'),
  );
  assert.ok(
    source.includes('blockSize: "var(--dash-adaptive-pager-reserved-block-size)"') &&
      source.includes('maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)"'),
  );
  assert.ok(
    !source.includes("transition: height") &&
      !source.includes("transition: grid-template-rows"),
    "reserved block sizes must never animate",
  );
  assert.match(
    css,
    /\.dashboard-pager\s*\{[\s\S]*?height:\s*var\(--dash-pagination-h,[\s\S]*?min-height:\s*var\(--dash-pagination-h,[\s\S]*?max-height:\s*var\(--dash-pagination-h,/,
  );

  for (const path of DIRECT_DASHBOARD_PAGERS) {
    const directPager = read(path);
    assert.ok(
      directPager.includes('data-dashboard-adaptive-reserved-region="pager"'),
      `${path} must declare its fixed dashboard-pager region`,
    );
  }
});

test("A05 retains the legacy action-bar constant while CMP-06 keeps logistics actions in-card", () => {
  const bar = read(STICKY_ACTION_BAR_PATH);
  const page = read(LOGISTICS_PAGE_PATH);

  assert.ok(bar.includes("STICKY_ACTION_RESERVED_BLOCK_SIZE"));
  assert.ok(
    bar.includes("calc(5.5625rem + env(safe-area-inset-bottom, 0px))"),
  );
  assert.ok(page.includes("headerActions={"));
  assert.equal(page.includes("<StickyActionBar"), false);
  assert.ok(!bar.includes("ResizeObserver") && !bar.includes("useLayoutEffect"));
});

test("A05 pilots attach the reservation root and content-independent canvas", () => {
  for (const path of [LOGISTICS_RECENT_PATH, INFORMES_PATH]) {
    const source = read(path);
    assert.ok(source.includes('data-dashboard-adaptive-reservation="true"'), path);
    assert.ok(source.includes('data-dashboard-adaptive-rows-canvas="true"'), path);
    assert.ok(!source.includes("limit = 2") && !source.includes("limit = 3"), path);
  }
});

test("A05 covers every physical rendering of the canonical adaptive consumers", () => {
  for (const path of ADAPTIVE_RENDERINGS) {
    assert.ok(
      read(path).includes('data-dashboard-adaptive-rows-canvas="true"'),
      `${path} must expose its measured rows canvas to the A05 contract`,
    );
  }
});

test("A05 preserves the capacity API and introduces no fixed limit or viewport patch", () => {
  // The three legacy hooks were retired once their consumer count reached 0;
  // their API surface collapsed into one owner plus the pure engine it calls.
  for (const [path, exportedSymbol] of [
    ["frontend/src/hooks/useDashboardCanvasCapacity.ts", "useDashboardCanvasCapacity"],
    ["frontend/src/lib/dashboard/capacity/computeCapacity.ts", "computeCapacity"],
  ] as const) {
    assert.ok(read(path).includes(`export function ${exportedSymbol}(`), path);
  }

  const contract = [
    read(DASHBOARD_PAGER_PATH),
    ...ADAPTIVE_RENDERINGS.map(read),
  ].join("\n");
  assert.doesNotMatch(contract, /(?:360|375|390|412|430|1024|1280|1366)px/);
  assert.doesNotMatch(contract, /limit\s*[:=]\s*(?:2|3|12|16)\b/);
  assert.doesNotMatch(contract, /overflow-y\s*:\s*auto/);
});
