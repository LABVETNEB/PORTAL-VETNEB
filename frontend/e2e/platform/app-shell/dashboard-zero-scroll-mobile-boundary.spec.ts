import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
] as const;

const CLINIC_ROUTES = [
  { path: "/dashboard", ready: '[data-vetneb-app-shell="true"]' },
  { path: "/dashboard?module=informes", ready: '[data-dashboard-module-workspace="informes"]' },
  { path: "/dashboard?module=logistica", ready: '[data-dashboard-module-workspace="logistica"]' },
] as const;

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function readBoundary(page: Page, bottomNavSelector: string) {
  return page.evaluate((navSelector) => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const bottomNav = document.querySelector<HTMLElement>(navSelector);
    const mainRect = main?.getBoundingClientRect() ?? null;
    const navRect = bottomNav?.getBoundingClientRect() ?? null;
    const navStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;

    return {
      externalScrollDelta: html.scrollHeight - html.clientHeight,
      bodyScrollDelta: body.scrollHeight - body.clientHeight,
      horizontalScrollDelta: html.scrollWidth - html.clientWidth,
      mainBottom: mainRect?.bottom ?? null,
      navTop: navRect?.top ?? null,
      navVisible:
        navRect !== null &&
        navRect.height > 0 &&
        navStyle !== null &&
        navStyle.display !== "none" &&
        navStyle.visibility !== "hidden",
    };
  }, bottomNavSelector);
}

test.describe("dashboard zero-scroll mobile lower boundary", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    for (const route of CLINIC_ROUTES) {
      // The clinic main dashboard (`/dashboard`, with or without ?module=) no
      // longer mounts the mobile bottom nav — the module rail is the single
      // clinic navigation there — so the lower boundary is the viewport edge.
      test(`clinic ${route.path} keeps content inside the viewport at ${viewport.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setPopulatedClinicSession(page);
        await page.goto(route.path);

        await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 12_000 });

        await expect(async () => {
          const boundary = await readBoundary(
            page,
            '[data-clinic-mobile-bottom-nav="true"]',
          );

          expect(
            boundary.externalScrollDelta,
            `${route.path} ${viewport.name}: external scroll delta`,
          ).toBeLessThanOrEqual(TOLERANCE);
          expect(
            boundary.bodyScrollDelta,
            `${route.path} ${viewport.name}: body scroll delta`,
          ).toBeLessThanOrEqual(TOLERANCE);
          expect(
            boundary.horizontalScrollDelta,
            `${route.path} ${viewport.name}: horizontal scroll delta`,
          ).toBeLessThanOrEqual(TOLERANCE);
          expect(boundary.mainBottom, "main rect resolved").not.toBeNull();

          // Lower boundary: the bottom nav top when it is mounted (secondary
          // clinic routes), otherwise the viewport edge.
          const lowerBoundary =
            boundary.navVisible && boundary.navTop !== null
              ? boundary.navTop
              : viewport.height;
          expect(
            boundary.mainBottom!,
            `${route.path} ${viewport.name}: main must not escape below its lower boundary`,
          ).toBeLessThanOrEqual(lowerBoundary + TOLERANCE);
        }).toPass({ timeout: 12_000 });
      });
    }

    test(`admin /dashboard/admin keeps content above the bottom nav at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedAdminSession(page);
      await page.goto("/dashboard/admin");

      await expect(
        page.locator('[data-vetneb-app-shell="true"]').first(),
      ).toBeVisible({ timeout: 12_000 });

      await expect(async () => {
        const boundary = await readBoundary(
          page,
          '[data-admin-mobile-bottom-nav="true"]',
        );

        expect(
          boundary.externalScrollDelta,
          `admin ${viewport.name}: external scroll delta`,
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(
          boundary.horizontalScrollDelta,
          `admin ${viewport.name}: horizontal scroll delta`,
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(
          boundary.navVisible,
          `admin ${viewport.name}: admin bottom nav visible`,
        ).toBe(true);
        expect(
          boundary.mainBottom!,
          `admin ${viewport.name}: main must not escape below the bottom nav`,
        ).toBeLessThanOrEqual(boundary.navTop! + TOLERANCE);
      }).toPass({ timeout: 12_000 });
    });
  }
});
