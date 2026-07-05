import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
] as const;

const ROUTES = [
  {
    path: "/dashboard/logistica/visitas",
    canvas: "visitas",
    pagerName: "Paginación de visitas",
    mobileRow: '[data-logistics-mobile-row="visita"]',
  },
  {
    path: "/dashboard/logistica/rutas",
    canvas: "rutas",
    pagerName: "Paginación de planes de ruta",
    mobileRow: '[data-logistics-mobile-row="ruta"]',
  },
  {
    path: "/dashboard/logistica/metricas",
    canvas: "metricas",
    pagerName: "Paginación de métricas de ruta",
    mobileRow: '[data-logistics-metric-block="true"]',
  },
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

async function readHorizontalScrollers(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("main.dashboard-main");
    if (!root) {
      return [];
    }

    const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

    return candidates.flatMap((element) => {
      const delta = element.scrollWidth - element.clientWidth;
      if (delta <= 2) {
        return [];
      }

      const style = window.getComputedStyle(element);
      if (style.display === "none") {
        return [];
      }

      return [
        {
          tag: element.tagName,
          className:
            typeof element.className === "string" ? element.className : "",
          delta,
        },
      ];
    });
  });
}

test.describe("logistics full routes — mobile rows without horizontal table scroll", () => {
  for (const route of ROUTES) {
    for (const viewport of MOBILE_VIEWPORTS) {
      test(`${route.canvas} renders mobile rows and no horizontal scroll at ${viewport.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setPopulatedClinicSession(page);
        await page.goto(route.path);

        const pager = page.getByRole("navigation", { name: route.pagerName });
        const mobileRows = page.locator(route.mobileRow);

        await expect(async () => {
          await expect(pager).toBeVisible();
          expect(
            await mobileRows.count(),
            `${route.canvas} ${viewport.name}: mobile row variant active`,
          ).toBeGreaterThan(0);
        }).toPass({ timeout: 15_000 });

        // Desktop table must be inactive on mobile (visitas/rutas only).
        if (route.canvas !== "metricas") {
          await expect(
            page.locator(`[data-dashboard-table-canvas="${route.canvas}"] table`),
          ).toBeHidden();
        }

        // No document-level scroll in either axis.
        const external = await page.evaluate(() => ({
          vertical:
            document.documentElement.scrollHeight -
            document.documentElement.clientHeight,
          horizontal:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        }));
        expect(
          external.vertical,
          `${route.canvas} ${viewport.name}: external vertical scroll`,
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(
          external.horizontal,
          `${route.canvas} ${viewport.name}: external horizontal scroll`,
        ).toBeLessThanOrEqual(TOLERANCE);

        // No internal horizontal scroller (the legacy 508px table overflow).
        const horizontalScrollers = await readHorizontalScrollers(page);
        expect(
          horizontalScrollers,
          `${route.canvas} ${viewport.name}: horizontal scrollers must be empty, found ${JSON.stringify(horizontalScrollers)}`,
        ).toEqual([]);

        // Pager fully inside the viewport (the legacy below-the-fold failure).
        const pagerBox = await pager.boundingBox();
        expect(pagerBox).not.toBeNull();
        expect(
          pagerBox!.y,
          `${route.canvas} ${viewport.name}: pager top inside viewport`,
        ).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(
          pagerBox!.y + pagerBox!.height,
          `${route.canvas} ${viewport.name}: pager bottom inside viewport`,
        ).toBeLessThanOrEqual(viewport.height + TOLERANCE);

        // Every mobile row stays inside the horizontal viewport.
        const rowCount = await mobileRows.count();
        for (let index = 0; index < rowCount; index += 1) {
          const box = await mobileRows.nth(index).boundingBox();
          if (!box) {
            continue;
          }
          expect(
            box.x + box.width,
            `${route.canvas} ${viewport.name}: row ${index} right edge`,
          ).toBeLessThanOrEqual(viewport.width + TOLERANCE);
        }
      });
    }
  }
});
