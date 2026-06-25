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

test.describe("dashboard interaction foundation — smoke (PR-1)", () => {
  test("clinic /dashboard loads module hub", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin /dashboard/admin loads module hub", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("clinic /dashboard?module=operaciones renders workspace", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin /dashboard/admin?module=admin-clinics renders workspace", async ({
    page,
  }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("hub cards have dashboard-card-interactive class applied (PR-1 contract)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const interactiveCards = hub.locator(".dashboard-card-interactive");
    await expect(interactiveCards.first()).toBeVisible();
  });

  test("workspace Volver button has dashboard-btn-interactive class applied (PR-1 contract)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });

    const volverBtn = workspace.locator(
      'button[aria-label="Vista general"]',
    );
    await expect(volverBtn).toBeVisible();
    await expect(volverBtn).toHaveClass(/dashboard-btn-interactive/);
  });

  test("reduced-motion: hub still visible with prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });
});
