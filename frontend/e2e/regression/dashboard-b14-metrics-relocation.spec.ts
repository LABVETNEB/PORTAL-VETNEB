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
        const desktopStats = commandCenter.locator(".dashboard-metric-card:visible");
        await expect(desktopStats, "desktop clinic metrics retain the detailed cards").toHaveCount(4);
        await expect(desktopStats.getByText("Planes de ruta", { exact: true })).toBeVisible();
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

  // B14 moved the clinic metric strip INTO the command center's header band,
  // which is what this test used to assert: the compact run painting on a phone.
  // The product contract changed — that band is redundant on mobile and its
  // 29px were returned to the module — so the assertion is inverted rather than
  // dropped: the run must not paint, the band must not survive as an empty
  // strip, and the chip band must have taken the freed height. What B14 itself
  // established and still holds is asserted unchanged below it: the phone never
  // renders the desktop metric cards.
  test("mobile clinic retires the metric band and returns its height to the tabs", async ({
    page,
  }) => {
    const clinic = SURFACES.find((surface) => surface.id === "clinic-operaciones");
    if (!clinic) throw new Error("clinic operations surface missing");

    await page.setViewportSize({ width: 390, height: 844 });
    await prepareSurface(page, clinic);
    await openSurface(page, clinic);

    const commandCenter = page.locator('[data-clinic-command-center="true"]');
    await expect(commandCenter.locator(".dashboard-metric-card:visible")).toHaveCount(0);

    const metricRun = commandCenter.locator('[data-dashboard-b14-metrics="clinic-operaciones"]');
    await expect(metricRun, "the run stays mounted for desktop").toHaveCount(1);
    await expect(metricRun, "the run must not paint on a phone").toBeHidden();

    const band = await metricRun.evaluate((element) => {
      const px = (raw: string) => Number.parseFloat(raw) || 0;
      const paints = (node: Element) => node.getClientRects().length > 0;
      const host = element.parentElement;
      const card = element.closest("section.dashboard-surface");
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const firstPainted = card ? (Array.from(card.children).find(paints) ?? null) : null;

      return {
        runHeight: element.getBoundingClientRect().height,
        runRects: element.getClientRects().length,
        hostHeight: host ? host.getBoundingClientRect().height : -1,
        hostRects: host ? host.getClientRects().length : -1,
        firstPaintedRole: firstPainted ? firstPainted.getAttribute("role") : null,
        firstPaintedOffset: firstPainted
          ? firstPainted.getBoundingClientRect().top -
            (card ? card.getBoundingClientRect().top : 0) -
            (cardStyle ? px(cardStyle.borderBlockStartWidth) : 0)
          : -1,
      };
    });

    expect(band.runHeight, "the run must occupy no band").toBe(0);
    expect(band.runRects, "the run must generate no box").toBe(0);
    expect(band.hostRects, "the header band must not paint as an empty strip").toBe(0);
    expect(band.hostHeight, "the header band must occupy no height").toBe(0);
    expect(band.firstPaintedRole, "the chip band must be the card's first painted child").toBe(
      "tablist",
    );
    expect(band.firstPaintedOffset, "the chip band must take the freed height").toBeLessThanOrEqual(
      1,
    );

    await expect(
      commandCenter.getByRole("tab", { name: "Métricas" }),
      "metric ownership still belongs to the Métricas tab",
    ).toHaveAttribute("aria-selected", "true");
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
