import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-short-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
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

type InternalScroller = {
  tag: string;
  className: string;
  delta: number;
};

async function readCoreInternalScrollers(page: Page): Promise<InternalScroller[]> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("main.dashboard-main");
    if (!root) {
      return [];
    }

    const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

    return candidates.flatMap((element) => {
      // Dialog bodies are the only sanctioned internal scroll containers and
      // they are portaled outside main, so everything found here is core.
      const style = window.getComputedStyle(element);
      const scrollableY =
        ["auto", "scroll"].includes(style.overflowY) &&
        element.scrollHeight - element.clientHeight > 2;
      const scrollableX =
        ["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth - element.clientWidth > 2;

      if (!scrollableY && !scrollableX) {
        return [];
      }

      return [
        {
          tag: element.tagName,
          className:
            typeof element.className === "string" ? element.className : "",
          delta: Math.max(
            element.scrollHeight - element.clientHeight,
            element.scrollWidth - element.clientWidth,
          ),
        },
      ];
    });
  });
}

test.describe("clinic informes full route — zero internal core scroll", () => {
  for (const viewport of VIEWPORTS) {
    test(`no core internal scroller and bounded detail at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedClinicSession(page);
      await page.goto("/dashboard/informes");

      const list = page.locator("#reports-master-list");
      const rows = list.locator("[id^='report-']");
      const pager = page.getByRole("navigation", { name: "Paginación de informes" });

      await expect(async () => {
        await expect(list).toBeVisible();
        await expect(pager).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);
      }).toPass({ timeout: 12_000 });

      // Row-count settle (fallback -> measured page size), then assert.
      await expect(async () => {
        const first = await rows.count();
        await page.waitForTimeout(150);
        expect(await rows.count()).toBe(first);
      }).toPass({ timeout: 10_000 });

      // 1. No external scroll.
      const external = await page.evaluate(() => ({
        vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(external.vertical, `${viewport.name}: external vertical`).toBeLessThanOrEqual(TOLERANCE);
      expect(external.horizontal, `${viewport.name}: external horizontal`).toBeLessThanOrEqual(TOLERANCE);

      // 2. Zero core internal scrollers (the legacy +1981px inline scroller).
      const scrollers = await readCoreInternalScrollers(page);
      expect(
        scrollers,
        `${viewport.name}: core internal scrollers must be empty, found ${JSON.stringify(scrollers)}`,
      ).toEqual([]);

      // 3. Detail bounded: on desktop the panel is fully inside the viewport.
      if (viewport.width >= 1024) {
        const detail = page.locator("#report-detail");
        await expect(detail).toBeVisible();
        const box = await detail.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y, `${viewport.name}: detail top`).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(
          box!.y + box!.height,
          `${viewport.name}: detail bottom must stay inside the viewport`,
        ).toBeLessThanOrEqual(viewport.height + TOLERANCE);

        // Segmented sections + persistent action dock stay reachable.
        await expect(
          page.locator('[data-informes-detail-sections="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-informes-detail-action-dock="true"]'),
        ).toBeVisible();
      } else {
        // Mobile: compact selected summary + dialog-based detail.
        await expect(
          page.locator('[data-informes-selected-report-summary="true"]'),
        ).toBeVisible();
        await page.getByRole("button", { name: "Ver detalle" }).click();
        await expect(page.locator('[data-informes-detail-dialog="true"]')).toBeVisible();
        await expect(
          page.locator('[data-informes-detail-action-dock="true"]'),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      }

      // 4. Pager bounded inside the viewport.
      const pagerBox = await pager.boundingBox();
      expect(pagerBox).not.toBeNull();
      expect(
        pagerBox!.y + pagerBox!.height,
        `${viewport.name}: pager must not clip below viewport`,
      ).toBeLessThanOrEqual(viewport.height + TOLERANCE);
    });
  }

  test("detail segmented sections switch without introducing scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");

    const detail = page.locator("#report-detail");
    await expect(detail).toBeVisible({ timeout: 12_000 });

    for (const section of ["Archivos", "Timeline", "Resumen"]) {
      await detail.getByRole("tab", { name: section }).click();
      const scrollers = await readCoreInternalScrollers(page);
      expect(scrollers, `section ${section}: no core internal scroller`).toEqual([]);
      const external = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      );
      expect(external, `section ${section}: no external scroll`).toBeLessThanOrEqual(TOLERANCE);
    }

    await expect(detail.getByText("Línea de tiempo del estudio")).toHaveCount(0);
    await detail.getByRole("tab", { name: "Timeline" }).click();
    await expect(detail.getByText("Línea de tiempo del estudio")).toBeVisible();
  });
});
