import { expect, test, type Page } from "@playwright/test";

// The centered cluster may sit a few px off exact center when auxiliary
// content (range labels) shares the row; the contract is "centered cluster,
// not a right-aligned footer".
const CENTER_TOLERANCE_PX = 40;

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

type PagerGeometry = {
  pagerCenter: number;
  surfaceCenter: number;
  clusterLeft: number;
  clusterRight: number;
  surfaceLeft: number;
  surfaceRight: number;
};

async function readPagerGeometry(
  page: Page,
  pagerSelector: string,
): Promise<PagerGeometry | null> {
  return page.evaluate((selector) => {
    const pager = document.querySelector<HTMLElement>(selector);
    if (!pager) {
      return null;
    }

    const surface = pager.parentElement;
    if (!surface) {
      return null;
    }

    const prev = pager.querySelector<HTMLElement>("[data-dashboard-pager-prev]");
    const next = pager.querySelector<HTMLElement>("[data-dashboard-pager-next]");
    if (!prev || !next) {
      return null;
    }

    const prevRect = prev.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();

    return {
      pagerCenter: (prevRect.left + nextRect.right) / 2,
      surfaceCenter: (surfaceRect.left + surfaceRect.right) / 2,
      clusterLeft: prevRect.left,
      clusterRight: nextRect.right,
      surfaceLeft: surfaceRect.left,
      surfaceRight: surfaceRect.right,
    };
  }, pagerSelector);
}

const SURFACES = [
  {
    name: "informes full route",
    path: "/dashboard/informes",
    ready: "#reports-master-list",
    pagerSelector: '#reports-master-list [data-dashboard-pager="true"]',
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "logistica visitas full route",
    path: "/dashboard/logistica/visitas",
    ready: '[data-dashboard-table-surface="true"]',
    pagerSelector: '[aria-label="Paginación de visitas"][data-dashboard-pager="true"]',
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "logistica rutas full route",
    path: "/dashboard/logistica/rutas",
    ready: '[data-dashboard-table-surface="true"]',
    pagerSelector:
      '[aria-label="Paginación de planes de ruta"][data-dashboard-pager="true"]',
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "clinic informes workspace summary",
    path: "/dashboard?module=informes",
    ready: '[data-clinic-reports-list-panel="true"]',
    pagerSelector: '[data-clinic-reports-pagination-controls="true"]',
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "clinic logistica workspace summary",
    path: "/dashboard?module=logistica",
    ready: '[data-clinic-logistics-list-panel="true"]',
    pagerSelector:
      '[data-clinic-logistics-pagination-footer="true"] [data-dashboard-pager="true"]',
    viewport: { width: 1440, height: 900 },
  },
] as const;

test.describe("shared centered pager contract", () => {
  for (const surface of SURFACES) {
    test(`${surface.name} shows a visible centered pager cluster`, async ({ page }) => {
      await page.setViewportSize(surface.viewport);
      await setPopulatedClinicSession(page);
      await page.goto(surface.path);

      await expect(page.locator(surface.ready).first()).toBeVisible({
        timeout: 15_000,
      });

      const pager = page.locator(surface.pagerSelector).first();
      await expect(pager, `${surface.name}: pager visible`).toBeVisible({
        timeout: 12_000,
      });

      // Stable selectors of the shared grammar.
      await expect(
        pager.locator("[data-dashboard-pager-prev]"),
      ).toHaveCount(1);
      await expect(
        pager.locator("[data-dashboard-pager-state]"),
      ).toHaveCount(1);
      await expect(
        pager.locator("[data-dashboard-pager-next]"),
      ).toHaveCount(1);

      await expect(async () => {
        const geometry = await readPagerGeometry(page, surface.pagerSelector);
        expect(geometry, `${surface.name}: pager geometry resolved`).not.toBeNull();

        const offCenter = Math.abs(geometry!.pagerCenter - geometry!.surfaceCenter);
        expect(
          offCenter,
          `${surface.name}: pager cluster centered (off by ${offCenter.toFixed(1)}px)`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

        // Explicitly not a right-aligned footer: the cluster must not hug the
        // right edge of its surface.
        const rightGap = geometry!.surfaceRight - geometry!.clusterRight;
        const leftGap = geometry!.clusterLeft - geometry!.surfaceLeft;
        expect(
          Math.abs(rightGap - leftGap),
          `${surface.name}: left/right gaps balanced`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX * 2);
      }).toPass({ timeout: 10_000 });
    });
  }
});
