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

async function readNoExternalScroll(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
    };
  });
}

test.describe("clinic Informes full route server-adaptive pagination (R-07)", () => {
  for (const viewport of VIEWPORTS) {
    test(`renders an always-visible pager sized to ${viewport.name} without external scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedClinicSession(page);

      await page.goto("/dashboard/informes");

      const list = page.locator("#reports-master-list");
      const pager = page.getByRole("navigation", { name: "Paginación de informes" });
      const previousButton = page.getByRole("button", { name: "Página anterior" });
      const nextButton = page.getByRole("button", { name: "Página siguiente" });
      const rows = list.locator("[id^='report-']");

      await expect(async () => {
        await expect(list).toBeVisible();
        await expect(pager).toBeVisible();
        await expect(previousButton).toBeVisible();
        await expect(nextButton).toBeVisible();

        const rowCount = await rows.count();
        expect(rowCount, `${viewport.name}: at least one row rendered`).toBeGreaterThan(0);
      }).toPass({ timeout: 12_000 });

      // The measured rowsPerPage can still settle across a couple of
      // ResizeObserver/rAF passes right after mount (fallback -> real row
      // height), so wait for two consecutive stable reads before measuring
      // geometry — same anti-flake pattern used on Admin Audit (R-06).
      await expect(async () => {
        const first = await rows.count();
        await page.waitForTimeout(150);
        const second = await rows.count();
        expect(second, `${viewport.name}: row count settled`).toBe(first);
      }).toPass({ timeout: 10_000 });

      await expect(async () => {
        const metrics = await readNoExternalScroll(page);
        expect(
          metrics.htmlScrollHeight,
          `${viewport.name}: documentElement must not scroll globally`,
        ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
        expect(
          metrics.bodyScrollHeight,
          `${viewport.name}: body must not scroll globally`,
        ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
      }).toPass({ timeout: 10_000 });

      const pagerBox = await pager.boundingBox();
      expect(pagerBox, `${viewport.name}: pager bounding box`).not.toBeNull();
      expect(pagerBox!.y + pagerBox!.height, `${viewport.name}: pager must not clip below viewport`).toBeLessThanOrEqual(
        viewport.height + TOLERANCE,
      );
      expect(pagerBox!.x, `${viewport.name}: pager left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(
        pagerBox!.x + pagerBox!.width,
        `${viewport.name}: pager right edge`,
      ).toBeLessThanOrEqual(viewport.width + TOLERANCE);

      const rowCount = await rows.count();
      for (let index = 0; index < rowCount; index += 1) {
        const box = await rows.nth(index).boundingBox();
        expect(box, `${viewport.name}: row ${index} bounding box`).not.toBeNull();
        expect(box!.x, `${viewport.name}: row ${index} left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(
          box!.x + box!.width,
          `${viewport.name}: row ${index} right edge`,
        ).toBeLessThanOrEqual(viewport.width + TOLERANCE);
      }
    });
  }

  test("pagination navigation swaps rows and keeps the page indicator in sync", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setPopulatedClinicSession(page);

    await page.goto("/dashboard/informes");

    const list = page.locator("#reports-master-list");
    const nextButton = page.getByRole("button", { name: "Página siguiente" });
    const previousButton = page.getByRole("button", { name: "Página anterior" });
    // CMP-09: pager label wording aligned to Admin's "Pág. X / Y" (G-010).
    const pageIndicator = page.getByText(/^Pág\. \d+ \/ \d+$/);

    await expect(async () => {
      await expect(list).toBeVisible();
      await expect(nextButton).toBeEnabled();
    }).toPass({ timeout: 12_000 });

    const firstPageFirstRowId = await list.locator("[id^='report-']").first().getAttribute("id");
    await expect(pageIndicator).toContainText("Pág. 1 /");

    await nextButton.click();

    await expect(async () => {
      await expect(pageIndicator).toContainText("Pág. 2 /");
      const currentFirstRowId = await list.locator("[id^='report-']").first().getAttribute("id");
      expect(currentFirstRowId).not.toBe(firstPageFirstRowId);
    }).toPass({ timeout: 10_000 });

    await expect(previousButton).toBeEnabled();
    await previousButton.click();
    await expect(pageIndicator).toContainText("Pág. 1 /");
  });

  test("full route no longer paginates through a URL page parameter", async ({ page }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");

    const nextButton = page.getByRole("button", { name: "Página siguiente" });
    await expect(nextButton).toBeVisible({ timeout: 12_000 });
    await nextButton.click();

    await expect(async () => {
      const url = new URL(page.url());
      expect(url.searchParams.has("page")).toBe(false);
    }).toPass({ timeout: 5_000 });
  });
});
