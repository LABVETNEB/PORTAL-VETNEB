import { expect, test } from "@playwright/test";
import { setClinicSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

test.describe("dashboard reports profile-layout state polish — smoke", () => {
  test("informes: reports list panel renders", async ({ page }) => {
    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText("Lista de informes")).toBeVisible();
  });

  test("informes: detail is inline, not a standalone lateral panel", async ({
    page,
  }) => {
    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 8_000,
    });
    // Inline master-detail: the detail expands inside the selected list item, so
    // there is no persistent lateral detail panel. With the e2e empty-API frame
    // there is no selected report, hence no #report-detail node is rendered.
    await expect(page.locator("#report-detail")).toHaveCount(0);
  });

  test("informes: compact filter search region visible", async ({ page }) => {
    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    await expect(
      page.getByRole("search", { name: "Filtros compactos de informes" }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("informes: no table-based master-detail workspace is required", async ({
    page,
  }) => {
    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.locator("#reports-master-list table")).toHaveCount(0);
  });

  test("informes: no horizontal overflow at 768px tablet", async ({ page }) => {
    await setClinicSession(page, "default");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 8_000,
    });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });

  test("informes: no horizontal overflow at 375px mobile", async ({ page }) => {
    await setClinicSession(page, "default");
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
    expect(overflow).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });
});