import { expect, test, type Page } from "@playwright/test";

import {
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometrySurface,
} from "../helpers/dashboard-geometry-matrix";

const APP_ORIGIN = "http://127.0.0.1:3000";
const WORKSPACE_SELECTOR = "[data-dashboard-module-workspace]";
const OWNER_SELECTOR = '[data-dashboard-b12-module-card="true"]';
const HEADER_SELECTOR = '[data-workspace-header="true"]';
const MODULES = DASHBOARD_GEOMETRY_SURFACES.filter(
  (surface) => surface.shellType === "admin-module" || surface.shellType === "clinic-module",
);
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const EXPECTED_OWNER_COUNTS: Readonly<Record<string, 0 | 1>> = {
  "admin-resumen": 0,
  "admin-informes": 1,
  "admin-estado": 0,
  "admin-clinicas": 1,
  "admin-tokens": 1,
  "admin-precios": 0,
  "admin-sesiones": 1,
  "admin-usuarios": 1,
  "admin-auditoria": 1,
  "admin-mantenimiento": 0,
  "clinic-operaciones": 0,
  "clinic-informes": 0,
  "clinic-logistica": 0,
  "clinic-perfil": 0,
  "clinic-tokens": 0,
};

async function prepareSurface(page: Page, surface: DashboardGeometrySurface) {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role];
  await page.context().addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);
  await installSurfaceMocks(page, surface);
}

async function openSurface(page: Page, surface: DashboardGeometrySurface) {
  await page.goto(surface.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(surface.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await waitForLayoutSettled(page);
}

test.beforeAll(() => {
  expect(MODULES).toHaveLength(15);
  expect(MODULES.filter((surface) => surface.role === "admin")).toHaveLength(10);
  expect(MODULES.filter((surface) => surface.role === "clinic")).toHaveLength(5);
  expect(Object.keys(EXPECTED_OWNER_COUNTS).sort()).toEqual(MODULES.map((surface) => surface.id).sort());
});

test.describe("B12 · module card removal", () => {
  for (const surface of MODULES) {
    for (const viewport of VIEWPORTS) {
      test(`${surface.id} @ ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await prepareSurface(page, surface);
        await openSurface(page, surface);

        const workspace = page.locator(WORKSPACE_SELECTOR).filter({ visible: true });
        await expect(workspace).toHaveCount(1);
        const owners = workspace.locator(OWNER_SELECTOR);
        const expectedOwnerCount = EXPECTED_OWNER_COUNTS[surface.id];
        expect(expectedOwnerCount, `${surface.id}: B12 owner census must be explicit`).toBeDefined();
        await expect(owners, `${surface.id}: B12 owner cardinality`).toHaveCount(expectedOwnerCount);

        if (expectedOwnerCount === 1) {
          const metrics = await owners.evaluate((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const viewport = element.parentElement?.getBoundingClientRect();
            return {
              backgroundColor: style.backgroundColor,
              borderColor: style.borderColor,
              borderRadius: style.borderRadius,
              boxShadow: style.boxShadow,
              borderLeftWidth: style.borderLeftWidth,
              width: rect.width,
              viewportWidth: viewport?.width ?? -1,
            };
          });

          expect(metrics.backgroundColor).toBe("rgba(0, 0, 0, 0)");
          expect(metrics.borderColor).toBe("rgba(0, 0, 0, 0)");
          expect(metrics.borderRadius).toBe("0px");
          expect(metrics.boxShadow).toBe("none");
          expect(Number.parseFloat(metrics.borderLeftWidth)).toBeGreaterThan(0);
          if (await owners.isVisible()) {
            expect(metrics.width).toBeGreaterThan(0);
            expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth + 0.5);
          }
        }

        const outerScroll = await page.evaluate(() => {
          const read = (node: Element) => ({
            vertical: node.scrollHeight - node.clientHeight,
            horizontal: node.scrollWidth - node.clientWidth,
          });
          return { html: read(document.documentElement), body: read(document.body) };
        });
        expect(outerScroll.html).toEqual({ vertical: 0, horizontal: 0 });
        expect(outerScroll.body).toEqual({ vertical: 0, horizontal: 0 });
        await expect(page).toHaveURL(new RegExp(surface.route.replace("?", "\\?")));

        const header = workspace.locator(HEADER_SELECTOR);
        if (viewport.width >= 768) {
          await expect(header).toBeVisible();
          const height = await header.evaluate((element) => element.getBoundingClientRect().height);
          expect(height).toBeGreaterThanOrEqual(38);
          expect(height).toBeLessThanOrEqual(42);
        }
      });
    }
  }
});

// B13/B14/B15/B16 are deliberately outside this visual-only B12 contract.
