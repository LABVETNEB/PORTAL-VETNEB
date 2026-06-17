import { expect, test } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// PR-A — Internal no-scroll contract for the dashboard App Shell.
//
// Governing audit: docs/audit/dashboard-masked-master-detail-no-scroll-audit.md
//
// The fixed shell (`h-dvh overflow-hidden`) already prevents document/body
// scroll. The remaining defect was that `main.dashboard-main` re-enabled an
// operational vertical scroll via `overflow-y: auto`, letting modules behave as
// a "vertical page". This spec blinda the corrected contract:
//
//   1. `main.dashboard-main` is NOT an operational scroll container
//      (computed overflow-y is neither `auto` nor `scroll`).
//   2. `main`, `body` and `documentElement` do not scroll (scrollHeight ≤
//      clientHeight within a small sub-pixel tolerance).
//
// Verified on the principal admin and clinic shells at one desktop viewport
// (1366×768) and one mobile viewport (390×844). The e2e server runs with
// NEXT_PUBLIC_API_URL="" so the shells render their degraded/empty frame; the
// fixed composition must still hold without scroll.
//
// NOT covered here (deferred): the heavy in-card modules whose OWN content can
// still overflow with real data — clinic Tokens particulares (PR-B) and the
// Informes master-detail density (PR-C). This PR does not maquillar those.
// ─────────────────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;

// Small tolerance for sub-pixel rounding only. Real scroll is far larger.
const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

type Surface = "clinic" | "admin";

type ShellCase = {
  label: string;
  surface: Surface;
  path: string;
  ready: string;
};

const SHELLS: ShellCase[] = [
  {
    label: "clinic dashboard shell",
    surface: "clinic",
    path: "/dashboard",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "admin dashboard shell",
    surface: "admin",
    path: "/dashboard/admin",
    ready: '[data-dashboard-module-hub="true"]',
  },
];

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

type ScrollContract = {
  htmlScrollHeight: number;
  htmlClientHeight: number;
  bodyScrollHeight: number;
  bodyClientHeight: number;
  mainScrollHeight: number;
  mainClientHeight: number;
  /** Computed `overflow-y` keyword for each element. */
  htmlOverflowY: string;
  bodyOverflowY: string;
  mainOverflowY: string;
  mainClassName: string;
  hasMain: boolean;
};

// Reusable measurement helper: reads scroll geometry + computed overflow modes
// for documentElement / body / main.dashboard-main in a single page evaluation.
async function readScrollContract(page: Page): Promise<ScrollContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector(
      "main.dashboard-main",
    ) as HTMLElement | null;

    return {
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      htmlOverflowY: window.getComputedStyle(html).overflowY,
      bodyOverflowY: window.getComputedStyle(body).overflowY,
      mainOverflowY: main ? window.getComputedStyle(main).overflowY : "none",
      mainClassName: typeof main?.className === "string" ? main.className : "",
      hasMain: main !== null,
    };
  });
}

function assertNoInternalScroll(metrics: ScrollContract, label: string) {
  expect(metrics.hasMain, `${label}: main.dashboard-main present`).toBe(true);

  // Contract 1: main must NOT be an operational scroll container.
  expect(
    metrics.mainOverflowY,
    `${label}: main.dashboard-main must not enable vertical scroll (overflow-y=${metrics.mainOverflowY}, class="${metrics.mainClassName}")`,
  ).not.toBe("auto");
  expect(
    metrics.mainOverflowY,
    `${label}: main.dashboard-main must not enable vertical scroll (overflow-y=${metrics.mainOverflowY})`,
  ).not.toBe("scroll");

  // Contract 2: nothing in the shell chain scrolls (scrollHeight ≤ clientHeight).
  expect(
    metrics.mainScrollHeight,
    `${label}: main scrolled (${metrics.mainScrollHeight} > ${metrics.mainClientHeight})`,
  ).toBeLessThanOrEqual(metrics.mainClientHeight + TOLERANCE);
  expect(
    metrics.bodyScrollHeight,
    `${label}: body scrolled (${metrics.bodyScrollHeight} > ${metrics.bodyClientHeight})`,
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
  expect(
    metrics.htmlScrollHeight,
    `${label}: documentElement scrolled (${metrics.htmlScrollHeight} > ${metrics.htmlClientHeight})`,
  ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
}

for (const viewport of VIEWPORTS) {
  test.describe(`dashboard internal no-scroll contract — ${viewport.name}`, () => {
    for (const shell of SHELLS) {
      test(`${shell.label} keeps main/body/html free of operational scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        if (shell.surface === "clinic") {
          await setClinicSession(page);
        } else {
          await setAdminSession(page);
        }

        await page.goto(shell.path);
        await expect(page.locator(shell.ready).first()).toBeVisible({
          timeout: 12_000,
        });

        // Poll to absorb hydration/layout settling (fonts, async panels).
        await expect(async () => {
          const metrics = await readScrollContract(page);
          assertNoInternalScroll(metrics, `${viewport.name} ${shell.label}`);
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}
