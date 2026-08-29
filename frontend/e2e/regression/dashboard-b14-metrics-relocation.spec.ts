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
const SURFACE_IDS = [
  "clinic-operaciones",
  "admin-tokens",
  "admin-sesiones",
  "admin-usuarios",
  "admin-auditoria",
] as const;
const SURFACES = SURFACE_IDS.map((surfaceId) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === surfaceId);
  if (!surface) throw new Error(`B14 surface missing from canonical geometry matrix: ${surfaceId}`);
  return surface;
});

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
  expect(SURFACES).toHaveLength(5);
  expect(new Set(SURFACES.map((surface) => surface.id)).size).toBe(5);
});

test.describe("B14 · metrics relocation", () => {
  test("desktop keeps every moved metric inside an existing header or toolbar", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });

    for (const surface of SURFACES) {
      await prepareSurface(page, surface);
      await openSurface(page, surface);

      if (surface.id === "clinic-operaciones") {
        const commandCenter = page.locator('[data-clinic-command-center="true"]');
        await expect(commandCenter.getByRole("tab", { name: "Métricas" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(commandCenter.locator(".dashboard-kpi-pill")).toHaveCount(0);
        await expect(commandCenter.getByText("Métricas operativas")).toBeVisible();
        continue;
      }

      const metrics = page.locator('[data-dashboard-b14-metrics] >> visible=true');
      await expect(metrics, `${surface.id}: exactly one visible integrated metrics owner`).toHaveCount(1);
      await expect(metrics).toBeVisible();

      if (surface.id === "admin-auditoria") {
        const latest = page.locator("[data-admin-audit-latest]");
        await expect(latest, "both audit recency dates must be rendered").toHaveCount(2);
        for (const key of ["roles", "avisos"]) {
          const date = page.locator(`[data-admin-audit-latest="${key}"]`);
          await expect(date, `${key}: recency date must be visible to sighted users`).toBeVisible();
          const clipped = await date.evaluate((node) => {
            const line = node.closest("p") as HTMLElement;
            const own = node.getBoundingClientRect();
            return {
              lineClipped: line.scrollWidth > line.clientWidth + 1,
              width: own.width,
              srOnly: node.className.includes("sr-only"),
            };
          });
          expect(clipped.srOnly, `${key}: recency date must not be sr-only`).toBe(false);
          expect(clipped.width, `${key}: recency date must occupy real width`).toBeGreaterThan(0);
          expect(clipped.lineClipped, `${key}: recency line is clipped by truncate`).toBe(false);
        }
      }
    }
  });

  test("mobile keeps audit metrics inside the existing filters toolbar", async ({ page }) => {
    const audit = SURFACES.find((surface) => surface.id === "admin-auditoria");
    if (!audit) throw new Error("B14 audit surface missing");

    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await prepareSurface(page, audit);
      await openSurface(page, audit);

      const metrics = page.locator('[data-dashboard-b14-metrics="admin-audit"] >> visible=true');
      await expect(metrics).toHaveCount(1);
      await expect(metrics.locator("xpath=ancestor::div[contains(@class, 'border-b')]")).toHaveCount(1);

      for (const key of ["eventos", "roles", "avisos"]) {
        const chip = metrics.locator(`[data-admin-audit-metric="${key}"]`);
        await expect(chip, `${width}px: ${key} metric must be visible`).toBeVisible();
        await expect(chip).toContainText(key);
        const box = await chip.boundingBox();
        expect(box, `${width}px: ${key} bounding box`).not.toBeNull();
        expect(box!.width, `${width}px: ${key} must have real width`).toBeGreaterThan(0);
        expect(box!.x, `${width}px: ${key} clipped on the left`).toBeGreaterThanOrEqual(0);
        expect(
          box!.x + box!.width,
          `${width}px: ${key} clipped on the right`,
        ).toBeLessThanOrEqual(width);
      }

      const clipped = await metrics.evaluate(
        (node) => node.scrollWidth > node.clientWidth + 1,
      );
      expect(clipped, `${width}px: metrics row is truncated`).toBe(false);

      const filters = page.getByRole("button", { name: "Filtros", exact: true });
      await expect(filters, `${width}px: Filters trigger must stay usable`).toBeVisible();
      await expect(filters).toBeEnabled();
      const filtersBox = await filters.boundingBox();
      expect(filtersBox, `${width}px: Filters bounding box`).not.toBeNull();
      expect(
        filtersBox!.x + filtersBox!.width,
        `${width}px: Filters clipped on the right`,
      ).toBeLessThanOrEqual(width);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `${width}px: mobile audit toolbar causes horizontal overflow`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });
});
