import { expect, test, type Page } from "@playwright/test";

import {
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometrySurface,
} from "../helpers/dashboard-geometry-matrix";

// B11 is the target-geometry bridge for A02, the height-ledger analysis for
// A03, and a zero-scroll-preserving change under A08. The complete matrices
// remain owned by those three contracts; this spec proves the B11 delta itself
// on both shared DashboardModuleWorkspace consumers and both viewport classes.

const APP_ORIGIN = "http://127.0.0.1:3000";
const HEADER_SELECTOR = '[data-workspace-header="true"]';
const DESCRIPTION_SELECTOR = '[data-workspace-header-description="true"]';
const APP_SHELL_SELECTOR = '[data-vetneb-app-shell="true"]';
const MAIN_SELECTOR = "main.dashboard-main";
const MOBILE_NAV_SELECTOR = '[data-dashboard-mobile-nav="clinic"]';
const TARGET_HEIGHT_PX = 40;
const TOLERANCE_PX = 2;

const SURFACE_IDS = ["admin-tokens", "clinic-tokens"] as const;
const VIEWPORT_SLUGS = ["w390x844", "w1366x768"] as const;

const SURFACES = SURFACE_IDS.map((id) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`B11: missing canonical surface ${id}`);
  return surface;
});

const VIEWPORTS = VIEWPORT_SLUGS.map((slug) => {
  const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find(
    (candidate) => candidate.slug === slug,
  );
  if (!viewport) throw new Error(`B11: missing canonical viewport ${slug}`);
  return viewport;
});

async function prepareSurface(page: Page, surface: DashboardGeometrySurface) {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

  const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role];
  await page.context().addCookies([
    { name: cookie.name, value: cookie.value, url: APP_ORIGIN },
  ]);
  await installSurfaceMocks(page, surface);
}

async function openSurface(page: Page, surface: DashboardGeometrySurface) {
  await page.goto(surface.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(surface.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await waitForLayoutSettled(page);
}

async function expectNoOuterScroll(page: Page, label: string) {
  const metrics = await page.evaluate((mainSelector) => {
    const read = (element: Element | null) => ({
      vertical: (element?.scrollHeight ?? 0) - (element?.clientHeight ?? 0),
      horizontal: (element?.scrollWidth ?? 0) - (element?.clientWidth ?? 0),
    });
    const main = document.querySelector<HTMLElement>(mainSelector);
    return {
      html: read(document.documentElement),
      body: read(document.body),
      main: read(main),
      mainOverflowY: main ? getComputedStyle(main).overflowY : "absent",
    };
  }, MAIN_SELECTOR);

  expect(metrics, `${label}: A08 outer scroll`).toEqual({
    html: { vertical: 0, horizontal: 0 },
    body: { vertical: 0, horizontal: 0 },
    main: { vertical: 0, horizontal: 0 },
    mainOverflowY: "hidden",
  });
}

test.beforeAll(() => {
  expect(SURFACES.map((surface) => surface.id)).toEqual(SURFACE_IDS);
  expect(VIEWPORTS.map((viewport) => viewport.slug)).toEqual(VIEWPORT_SLUGS);
});

test.describe("B11 · canonical WorkspaceHeader shared owner", () => {
  for (const surface of SURFACES) {
    for (const viewport of VIEWPORTS) {
      test(`${surface.id} @ ${viewport.slug}`, async ({ page }) => {
        const label = `${surface.id} @ ${viewport.slug}`;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await prepareSurface(page, surface);
        await openSurface(page, surface);

        const workspace = page.locator(surface.contentRootSelector);
        const allHeaders = workspace.locator(HEADER_SELECTOR);
        await expect(allHeaders, `${label}: one canonical owner in the DOM`).toHaveCount(1);
        await expect(page.locator(APP_SHELL_SELECTOR), `${label}: one app shell`).toHaveCount(1);

        const isAdminMobile = surface.role === "admin" && viewport.width < 768;
        if (isAdminMobile) {
          await expect(
            allHeaders,
            `${label}: preserved B09 admin-mobile header reclaim`,
          ).toBeHidden();
        } else {
          const header = allHeaders;
          await expect(header, `${label}: painted canonical header`).toBeVisible();

          const geometry = await header.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const title = element.querySelector<HTMLElement>("h2");
            const titleStyle = title ? getComputedStyle(title) : null;
            return {
              height: rect.height,
              width: rect.width,
              parentWidth: element.parentElement?.getBoundingClientRect().width ?? -1,
              paddingLeft: Number.parseFloat(style.paddingLeft),
              paddingRight: Number.parseFloat(style.paddingRight),
              borderRadius: style.borderRadius,
              boxShadow: style.boxShadow,
              titleFontSize: titleStyle?.fontSize ?? "absent",
              titleLineHeight: titleStyle?.lineHeight ?? "absent",
              titleWeight: titleStyle?.fontWeight ?? "absent",
            };
          });

          expect(geometry.height, `${label}: A02 target height`).toBeGreaterThanOrEqual(
            TARGET_HEIGHT_PX - TOLERANCE_PX,
          );
          expect(geometry.height, `${label}: A02 target height`).toBeLessThanOrEqual(
            TARGET_HEIGHT_PX + TOLERANCE_PX,
          );
          expect(Math.abs(geometry.width - geometry.parentWidth), `${label}: full width`).toBeLessThanOrEqual(0.5);
          expect(geometry.paddingLeft).toBe(16);
          expect(geometry.paddingRight).toBe(16);
          expect(geometry.borderRadius).toBe("0px");
          expect(geometry.boxShadow).toBe("none");
          expect(geometry.titleFontSize).toBe("14px");
          expect(geometry.titleLineHeight).toBe("20px");
          expect(geometry.titleWeight).toBe("600");

          const heading = header.locator("h2");
          const description = header.locator(DESCRIPTION_SELECTOR);
          await expect(heading).toHaveCount(1);
          await expect(description).toHaveCount(1);
          const accessibility = await workspace.evaluate((element) => {
            const description = element.querySelector<HTMLElement>(
              '[data-workspace-header-description="true"]',
            );
            const rect = description?.getBoundingClientRect();
            return {
              labelledBy: element.getAttribute("aria-labelledby"),
              describedBy: element.getAttribute("aria-describedby"),
              headingId: element.querySelector("h2")?.id ?? null,
              descriptionId: description?.id ?? null,
              descriptionPosition: description ? getComputedStyle(description).position : null,
              descriptionWidth: rect?.width ?? -1,
              descriptionHeight: rect?.height ?? -1,
              descriptionText: description?.textContent?.trim() ?? "",
            };
          });

          expect(accessibility.labelledBy).toBe(accessibility.headingId);
          expect(accessibility.describedBy).toBe(accessibility.descriptionId);
          expect(accessibility.descriptionPosition).toBe("absolute");
          expect(accessibility.descriptionWidth).toBeLessThanOrEqual(1);
          expect(accessibility.descriptionHeight).toBeLessThanOrEqual(1);
          expect(accessibility.descriptionText.length).toBeGreaterThan(0);
        }

        await expect(page).toHaveURL(new RegExp(surface.route.replace("?", "\\?")));
        await expectNoOuterScroll(page, label);

        if (surface.role === "clinic" && viewport.width < 768) {
          await expect(
            page.locator(MOBILE_NAV_SELECTOR).filter({ visible: true }),
            `${label}: B09 mobile navigation owner`,
          ).toHaveCount(1);
        }
      });
    }
  }
});
