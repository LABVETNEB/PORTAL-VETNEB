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

test.describe("clinic Logística Visitas full route adaptive contract (R-12)", () => {
  for (const viewport of VIEWPORTS) {
    test(`renders an always-visible pager sized to ${viewport.name} without external scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedClinicSession(page);

      await page.goto("/dashboard/logistica/visitas");

      const pager = page.getByRole("navigation", { name: "Paginación de visitas" });
      const previousButton = page.getByRole("button", { name: "Página anterior" });
      const nextButton = page.getByRole("button", { name: "Página siguiente" });
      const pageIndicator = pager.locator(".dashboard-pagination-context");
      const rows = page.locator("table tbody tr");

      await expect(async () => {
        await expect(pager).toBeVisible();
        await expect(previousButton).toBeVisible();
        await expect(nextButton).toBeVisible();

        const rowCount = await rows.count();
        expect(rowCount, `${viewport.name}: at least one row rendered`).toBeGreaterThan(0);
      }).toPass({ timeout: 12_000 });

      // Fixture dataset (3 visits) is far below the default page-size limit
      // (50), so this is the "everything fits on page 1" contract state:
      // no previous page, and the page-full heuristic correctly reports no
      // further page either.
      await expect(previousButton).toBeDisabled();
      await expect(nextButton).toBeDisabled();
      await expect(pageIndicator).toHaveText("Página 1");
      await expect(
        page.getByText(
          "Conteos calculados sobre la página visible, no sobre el total general de visitas.",
        ),
      ).toBeVisible();

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
      expect(
        pagerBox!.x + pagerBox!.width,
        `${viewport.name}: pager right edge`,
      ).toBeLessThanOrEqual(viewport.width + TOLERANCE);
      expect(pagerBox!.x, `${viewport.name}: pager left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
    });
  }

  test("page-full heuristic enables next/previous navigation and keeps the offset contract in the URL", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setPopulatedClinicSession(page);

    // The fixture serves exactly 3 field visits regardless of limit/offset,
    // so requesting `limit=3` forces the deterministic "page full" state
    // (visits.length === limit) without depending on real production data.
    await page.goto("/dashboard/logistica/visitas?limit=3&offset=0");

    const pager = page.getByRole("navigation", { name: "Paginación de visitas" });
    const previousButton = page.getByRole("button", { name: "Página anterior" });
    const nextButton = page.getByRole("button", { name: "Página siguiente" });
    const pageIndicator = pager.locator(".dashboard-pagination-context");

    await expect(async () => {
      await expect(nextButton).toBeEnabled();
      await expect(previousButton).toBeDisabled();
    }).toPass({ timeout: 12_000 });

    await expect(pageIndicator).toHaveText("Página 1");
    await expect(page.getByText(/puede haber más visitas disponibles/)).toBeVisible();

    await nextButton.click();

    await expect(async () => {
      const url = new URL(page.url());
      expect(url.searchParams.get("offset")).toBe("3");
      expect(url.searchParams.get("limit")).toBe("3");
    }).toPass({ timeout: 10_000 });

    await expect(pageIndicator).toHaveText("Página 2");
    await expect(previousButton).toBeEnabled();

    await previousButton.click();

    await expect(async () => {
      const url = new URL(page.url());
      expect(url.searchParams.get("offset")).toBe("0");
    }).toPass({ timeout: 10_000 });
    await expect(pageIndicator).toHaveText("Página 1");
    await expect(previousButton).toBeDisabled();
  });
});
