import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

test.describe("dashboard master-detail state polish — smoke (PR-3)", () => {
  test("informes: master panel renders (dashboard-master-panel)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator(".dashboard-master-panel")).toBeVisible({
      timeout: 8_000,
    });
  });

  test("informes: detail panel renders with data-detail-state attribute", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    const detailPanel = page.locator(".dashboard-detail-panel");
    await expect(detailPanel).toBeVisible({ timeout: 8_000 });
    const state = await detailPanel.getAttribute("data-detail-state");
    expect(["empty", "selected"]).toContain(state);
  });

  test("informes: workspace has data-master-detail-workspace attribute", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(
      page.locator('[data-master-detail-workspace="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("informes: master panel contains table element", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    const masterPanel = page.locator(".dashboard-master-panel");
    await expect(masterPanel).toBeVisible({ timeout: 8_000 });
    await expect(masterPanel.locator("table")).toBeVisible({ timeout: 4_000 });
  });

  test("informes: no horizontal overflow at 768px (tablet)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard/informes");
    await expect(page.locator(".dashboard-master-panel")).toBeVisible({
      timeout: 8_000,
    });
    const overflow = await page
      .locator(".dashboard-master-panel")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("informes: no horizontal overflow at 375px (mobile)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/informes");
    await expect(page.locator("main.dashboard-main")).toBeVisible({
      timeout: 8_000,
    });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("informes: PR-2 contract preserved — filter bar region visible", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(
      page.getByRole("region", { name: "Filtros del dashboard" }),
    ).toBeVisible({ timeout: 8_000 });
  });
});
