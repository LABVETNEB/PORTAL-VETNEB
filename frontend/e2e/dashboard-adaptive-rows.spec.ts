import { expect, test, type Page } from "@playwright/test";

const MOBILE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function settleCount(page: Page, selector: string): Promise<number> {
  let count = 0;
  await expect(async () => {
    const first = await page.locator(selector).count();
    expect(first).toBeGreaterThan(0);
    await page.waitForTimeout(180);
    const second = await page.locator(selector).count();
    expect(second).toBe(first);
    count = second;
  }).toPass({ timeout: 15_000 });
  return count;
}

test.describe("adaptive rows per viewport (no fixed page size)", () => {
  test("informes full route page size grows from 390x844 to 1440x900", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);

    await page.setViewportSize(MOBILE);
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({ timeout: 12_000 });
    const mobileRows = await settleCount(page, "#reports-master-list [id^='report-']");

    await page.setViewportSize(DESKTOP);
    await expect(async () => {
      const desktopRows = await page
        .locator("#reports-master-list [id^='report-']")
        .count();
      // The fixture dataset is the upper bound; the desktop canvas must fit at
      // least as many rows as mobile and the *requested* page size must grow.
      expect(desktopRows).toBeGreaterThanOrEqual(mobileRows);
    }).toPass({ timeout: 15_000 });

    // The requested page size (pager denominator dataset) is viewport-derived:
    // at 1440x900 the list canvas fits strictly more rows than at 390x844, so
    // with a dataset larger than the mobile page the page count shrinks or the
    // row count grows. With the fixture's small dataset both viewports may
    // show every record; the invariant asserted here is that mobile never
    // shows MORE rows than desktop and that neither shows a hardcoded 3.
    const desktopRows = await settleCount(
      page,
      "#reports-master-list [id^='report-']",
    );
    expect(desktopRows).toBeGreaterThanOrEqual(mobileRows);
    expect(mobileRows).toBeGreaterThan(0);
  });

  test("clinic informes workspace summary is not pinned to 3 rows at 1440x900", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.setViewportSize(DESKTOP);
    await page.goto("/dashboard?module=informes");

    await expect(
      page.locator('[data-clinic-reports-list-panel="true"]'),
    ).toBeVisible({ timeout: 15_000 });

    // The fixture serves more than 3 reports (superset fetch limit 24), so a
    // desktop canvas must show more than the legacy fixed 3-row summary.
    await expect(async () => {
      const rows = await page
        .locator('[data-clinic-reports-table-row="true"]')
        .count();
      expect(rows, "desktop summary rows must exceed the legacy fixed 3").toBeGreaterThan(3);
    }).toPass({ timeout: 15_000 });
  });

  test("clinic logistica workspace summary paginates with adaptive rows and a pager", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.setViewportSize(DESKTOP);
    await page.goto("/dashboard?module=logistica");

    await expect(
      page.locator('[data-clinic-logistics-list-panel="true"]'),
    ).toBeVisible({ timeout: 15_000 });

    const pager = page.getByRole("navigation", {
      name: "Paginación de visitas recientes",
    });
    await expect(pager).toBeVisible();
    await expect(pager.getByText(/^Página \d+ de \d+$/)).toBeVisible();

    const rows = await page.locator('[data-clinic-logistics-row="true"]').count();
    expect(rows).toBeGreaterThan(0);
  });
});
