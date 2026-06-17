import { expect, test } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Single-viewport App Shell contract.
//
// Desktop dashboard modules must fit one viewport with ZERO operational scroll:
// no document scroll (vertical or horizontal) and no effective scroll on the
// `.dashboard-main` container (its `overflow-y: auto` is kept only for the legacy
// scroll-container contract; the real metric is scrollHeight ≤ clientHeight).
//
// Verified at the two mandated desktop viewports: 1440×900 (target) and
// 1366×768 (minimum acceptable). The e2e server runs with NEXT_PUBLIC_API_URL=""
// so modules render their degraded/empty state — the frame and bounded content
// must still fit without scroll.
// ─────────────────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

type Surface = "clinic" | "admin";

type RouteCase = {
  label: string;
  surface: Surface;
  path: string;
  /** Locator that must be visible before measuring (hub or module workspace). */
  ready: string;
};

const ROUTE_CASES: RouteCase[] = [
  // Clinic
  {
    label: "clinic hub",
    surface: "clinic",
    path: "/dashboard",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "clinic operaciones",
    surface: "clinic",
    path: "/dashboard?module=operaciones",
    ready: '[data-dashboard-module-workspace="operaciones"]',
  },
  {
    label: "clinic informes",
    surface: "clinic",
    path: "/dashboard?module=informes",
    ready: '[data-dashboard-module-workspace="informes"]',
  },
  {
    label: "clinic logistica",
    surface: "clinic",
    path: "/dashboard?module=logistica",
    ready: '[data-dashboard-module-workspace="logistica"]',
  },
  // Admin
  {
    label: "admin hub",
    surface: "admin",
    path: "/dashboard/admin",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "admin clinics",
    surface: "admin",
    path: "/dashboard/admin?module=admin-clinics",
    ready: '[data-dashboard-module-workspace="admin-clinics"]',
  },
  {
    label: "admin audit-log",
    surface: "admin",
    path: "/dashboard/admin?module=audit-log",
    ready: '[data-dashboard-module-workspace="audit-log"]',
  },
  {
    label: "admin pricing",
    surface: "admin",
    path: "/dashboard/admin?module=admin-pricing",
    ready: '[data-dashboard-module-workspace="admin-pricing"]',
  },
  {
    label: "admin sessions",
    surface: "admin",
    path: "/dashboard/admin?module=admin-sessions",
    ready: '[data-dashboard-module-workspace="admin-sessions"]',
  },
];

type ScrollMetrics = {
  docScrollH: number;
  docClientH: number;
  docScrollW: number;
  docClientW: number;
  bodyScrollH: number;
  bodyClientH: number;
  bodyScrollW: number;
  bodyClientW: number;
  mainScrollH: number;
  mainClientH: number;
  mainScrollW: number;
  mainClientW: number;
  hasMain: boolean;
};

async function readScrollMetrics(page: Page): Promise<ScrollMetrics> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main.dashboard-main") as HTMLElement | null;
    return {
      docScrollH: doc.scrollHeight,
      docClientH: doc.clientHeight,
      docScrollW: doc.scrollWidth,
      docClientW: doc.clientWidth,
      bodyScrollH: body.scrollHeight,
      bodyClientH: body.clientHeight,
      bodyScrollW: body.scrollWidth,
      bodyClientW: body.clientWidth,
      mainScrollH: main?.scrollHeight ?? 0,
      mainClientH: main?.clientHeight ?? 0,
      mainScrollW: main?.scrollWidth ?? 0,
      mainClientW: main?.clientWidth ?? 0,
      hasMain: main !== null,
    };
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`App Shell single-viewport — ${viewport.name}`, () => {
    for (const routeCase of ROUTE_CASES) {
      test(`${routeCase.label} fits one viewport without scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        if (routeCase.surface === "clinic") {
          await setClinicSession(page);
        } else {
          await setAdminSession(page);
        }

        await page.goto(routeCase.path);
        await expect(page.locator(routeCase.ready).first()).toBeVisible({
          timeout: 12_000,
        });

        // Poll to absorb hydration/layout settling (fonts, async panels).
        await expect(async () => {
          const m = await readScrollMetrics(page);

          // Document never scrolls (vertical or horizontal).
          expect(
            m.docScrollH,
            "documentElement vertical scroll",
          ).toBeLessThanOrEqual(m.docClientH + TOLERANCE);
          expect(
            m.docScrollW,
            "documentElement horizontal scroll",
          ).toBeLessThanOrEqual(m.docClientW + TOLERANCE);
          expect(m.bodyScrollH, "body vertical scroll").toBeLessThanOrEqual(
            m.bodyClientH + TOLERANCE,
          );
          expect(m.bodyScrollW, "body horizontal scroll").toBeLessThanOrEqual(
            m.bodyClientW + TOLERANCE,
          );

          // The main dashboard container keeps overflow-y:auto for the legacy
          // contract, but must have no effective scroll.
          expect(m.hasMain, "main.dashboard-main present").toBe(true);
          expect(
            m.mainScrollH,
            "dashboard-main vertical scroll",
          ).toBeLessThanOrEqual(m.mainClientH + TOLERANCE);
          expect(
            m.mainScrollW,
            "dashboard-main horizontal scroll",
          ).toBeLessThanOrEqual(m.mainClientW + TOLERANCE);
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}
