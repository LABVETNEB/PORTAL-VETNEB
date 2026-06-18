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

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

test.describe("dashboard workspace layout polish — smoke (PR-2)", () => {
  test("clinic /dashboard loads module hub", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("clinic /dashboard?module=operaciones renders workspace with enter class", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(workspace).toHaveClass(/dashboard-workspace-enter/);
  });

  test("admin /dashboard/admin loads module hub", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin /dashboard/admin?module=admin-clinics renders workspace with enter class", async ({
    page,
  }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-clinics"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(workspace).toHaveClass(/dashboard-workspace-enter/);
  });

  test("/dashboard/informes layout loads", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator("main.dashboard-main")).toBeVisible({
      timeout: 8_000,
    });
    await expect(
      page.getByRole("region", { name: "Lista de informes" }),
    ).toBeVisible({ timeout: 8_000 });
    // Inline master-detail: the detail expands inside the selected report row,
    // so there is no standalone "Detalle del informe" region without a selection.
    await expect(page.locator("#report-detail")).toHaveCount(0);
  });

  test("workspace Volver button keeps dashboard-btn-interactive (PR-1 contract preserved)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    const volverBtn = workspace.locator('button[aria-label="Volver a módulos"]');
    await expect(volverBtn).toBeVisible();
    await expect(volverBtn).toHaveClass(/dashboard-btn-interactive/);
  });

  test("reduced-motion: workspace still visible with prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(workspace).toHaveClass(/dashboard-workspace-enter/);
  });

  test("no global scroll: shell keeps h-dvh overflow-hidden layout", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
    );
    expect(overflow).toBeLessThanOrEqual(5);
  });
});
