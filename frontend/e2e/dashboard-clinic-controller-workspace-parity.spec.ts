import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const TOLERANCE = 2;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

const CLINIC_MODULES: ClinicModule[] = [
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
];

/**
 * Nav items whose href resolves to `/dashboard?module=<id>` exactly, so
 * aria-current is verifiable there. "informes"/"logistica" nav items point to
 * standalone routes (/dashboard/informes, /dashboard/logistica) instead of the
 * `?module=` workspace, so aria-current is not applicable on those module URLs.
 */
const CLINIC_MODULES_WITH_VERIFIABLE_NAV: Record<ClinicModule, string | null> = {
  operaciones: "Resumen",
  informes: null,
  logistica: null,
  perfil: "Perfil",
  tokens: "Tokens",
};

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

async function expectMainNotScrollContainer(page: Page) {
  const metric = await page.evaluate(() => {
    const main = document.querySelector("main.dashboard-main") as HTMLElement | null;
    if (!main) return null;
    return {
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
      scrollWidth: main.scrollWidth,
      clientWidth: main.clientWidth,
    };
  });

  expect(metric, "main.dashboard-main present").not.toBeNull();
  expect(metric!.scrollHeight).toBeLessThanOrEqual(metric!.clientHeight + TOLERANCE);
  expect(metric!.scrollWidth).toBeLessThanOrEqual(metric!.clientWidth + TOLERANCE);
}

async function expectNoHorizontalOverflow(page: Page) {
  const metric = await page.evaluate(() => ({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));

  expect(metric.htmlScrollWidth).toBeLessThanOrEqual(metric.htmlClientWidth + TOLERANCE);
  expect(metric.bodyScrollWidth).toBeLessThanOrEqual(metric.bodyClientWidth + TOLERANCE);
}

test.describe("clinic controller/workspace parity contract (PR-CL1)", () => {
  test("clinic /dashboard loads the module hub", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  for (const moduleId of CLINIC_MODULES) {
    test(`clinic /dashboard?module=${moduleId} loads workspace ${moduleId}`, async ({
      page,
    }) => {
      await setClinicSession(page);
      await page.goto(`/dashboard?module=${moduleId}`);
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 8_000 });
    });
  }

  test("admin /dashboard/admin baseline still loads hub", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin baseline module still loads workspace", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("clinic Vista general returns to hub in a single click (no double-hop)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator('[data-dashboard-module-workspace="operaciones"]');
    await expect(workspace).toBeVisible({ timeout: 8_000 });

    await workspace.locator('button[aria-label="Vista general"]').click();

    await expect(page.locator('[data-dashboard-module-hub="true"]')).toBeVisible({
      timeout: 4_000,
    });
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(page).not.toHaveURL(/module=/);
  });

  for (const moduleId of CLINIC_MODULES) {
    const navLabel = CLINIC_MODULES_WITH_VERIFIABLE_NAV[moduleId];
    if (!navLabel) continue;

    test(`clinic ${moduleId} keeps active nav item aria-current visible`, async ({
      page,
    }) => {
      await setClinicSession(page);
      await page.goto(`/dashboard?module=${moduleId}`);
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 8_000 });

      const navigation = page.getByRole("navigation", {
        name: "Navegación principal",
      });
      await expect(
        navigation.getByRole("button", { name: navLabel, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    });
  }

  for (const moduleId of CLINIC_MODULES) {
    test(`clinic ${moduleId} fits 390x844 without horizontal overflow or main scroll`, async ({
      page,
    }) => {
      await setClinicSession(page);
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(`/dashboard?module=${moduleId}`);
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 8_000 });

      await expectNoHorizontalOverflow(page);
      await expectMainNotScrollContainer(page);
    });
  }

  test("clinic hub fits 390x844 without horizontal overflow or main scroll", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });
});
