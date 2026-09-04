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

async function expectClinicStage(page: Page) {
  const stage = page.locator(
    '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"]',
  );
  await expect(stage).toBeVisible({ timeout: 8_000 });
  await expect(stage).toHaveCount(1);
  return stage;
}

// The clinic hub/cockpit was removed with the horizontal-nav redesign: a bare
// `/dashboard` resolves to the operational default module and the stage always
// renders exactly one workspace. "Single layer" therefore means: one workspace
// mounted, zero hub layers.
async function expectSingleClinicLayer(page: Page, expected: ClinicModule) {
  await expectClinicStage(page);

  await expect(
    page.locator(`[data-dashboard-module-workspace="${expected}"]`),
  ).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
  await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
}

const DEFAULT_CLINIC_MODULE: ClinicModule = "operaciones";

test.describe("clinic controller/workspace parity contract (PR-CL1)", () => {
  test("clinic /dashboard loads the operational default workspace (no hub)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expectSingleClinicLayer(page, DEFAULT_CLINIC_MODULE);
    await expect(page.locator('[data-clinic-cockpit="true"]')).toHaveCount(0);
  });

  for (const moduleId of CLINIC_MODULES) {
    test(`clinic /dashboard?module=${moduleId} loads workspace ${moduleId}`, async ({
      page,
    }) => {
      await setClinicSession(page);
      await page.goto(`/dashboard?module=${moduleId}`);
      await expectSingleClinicLayer(page, moduleId);
    });
  }

  // PR-CL4: Informes/Logística nav items now resolve to `?module=`, but the
  // standalone full routes must keep working as extended surfaces (linked
  // from the "Abrir módulo completo" CTAs inside each workspace summary).
  test("clinic /dashboard/informes full route still loads", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator("main")).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/dashboard\/informes/);
  });

  test("clinic /dashboard/logistica full route still loads", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/logistica");
    await expect(page.locator("main")).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/dashboard\/logistica/);
  });

  test("admin /dashboard/admin baseline still loads hub", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?hub=1");
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

  // The clinic workspace has no "Vista general" back control anymore (module
  // navigation is owned by the lateral band since B08), so single-click module
  // switching is exercised through the lateral navigation item itself.
  test("clinic lateral nav reaches the operational default in a single click", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=tokens");
    await expectSingleClinicLayer(page, "tokens");

    await page
      .locator('[data-dashboard-navigation-drawer="clinic"]')
      .filter({ visible: true })
      .locator(`[data-dashboard-navigation-item="${DEFAULT_CLINIC_MODULE}"]`)
      .click();

    await expectSingleClinicLayer(page, DEFAULT_CLINIC_MODULE);
  });

  test("clinic stage persists when switching modules through the lateral nav", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=tokens");
    await expectSingleClinicLayer(page, "tokens");

    const stage = await expectClinicStage(page);
    await stage.evaluate((element) => {
      (element as HTMLElement).dataset.e2eStageToken = "clinic-stage";
    });

    await page
      .locator('[data-dashboard-navigation-drawer="clinic"]')
      .filter({ visible: true })
      .locator(`[data-dashboard-navigation-item="${DEFAULT_CLINIC_MODULE}"]`)
      .click();

    await expectSingleClinicLayer(page, DEFAULT_CLINIC_MODULE);
    await expect(
      page.locator(
        '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"][data-e2e-stage-token="clinic-stage"]',
      ),
    ).toBeVisible();
  });

  // B08 retired the horizontal top nav and moved clinic module navigation onto
  // the lateral band, which owns >=768px (this spec's default viewport), so
  // aria-current is asserted on the lateral item.
  for (const moduleId of CLINIC_MODULES) {
    test(`clinic ${moduleId} keeps active lateral item aria-current visible`, async ({
      page,
    }) => {
      await setClinicSession(page);
      await page.goto(`/dashboard?module=${moduleId}`);
      await expectSingleClinicLayer(page, moduleId);

      const lateralNav = page.getByRole("navigation", {
        name: "Navegación lateral de clínica",
      });
      await expect(lateralNav).toBeVisible({ timeout: 8_000 });
      await expect(
        lateralNav.locator(`[data-dashboard-navigation-item="${moduleId}"]`),
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

  test("clinic default entry fits 390x844 without horizontal overflow or main scroll", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/dashboard");
    await expectSingleClinicLayer(page, DEFAULT_CLINIC_MODULE);

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });
});

test.describe("clinic command center operational cockpit (PR-CL2)", () => {
  test("operaciones module renders the command center root", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.locator('[data-clinic-command-center="true"]'),
    ).toBeVisible();
  });

  test("Estado tab exposes attention, activity and continuity blocks", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    const commandCenter = page.locator('[data-clinic-command-center="true"]');
    await commandCenter.getByRole("tab", { name: "Estado" }).click();

    await expect(
      commandCenter.locator('[data-clinic-command-attention="true"]'),
    ).toBeVisible();
    await expect(
      commandCenter.locator('[data-clinic-command-activity="true"]'),
    ).toBeVisible();
    await expect(
      commandCenter.locator('[data-clinic-command-continuity="true"]'),
    ).toBeVisible();
  });

  test("Estado tab fits 390x844 without horizontal overflow or main scroll", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    const commandCenter = page.locator('[data-clinic-command-center="true"]');
    await commandCenter.getByRole("tab", { name: "Estado" }).click();
    await expect(
      commandCenter.locator('[data-clinic-command-continuity="true"]'),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });
});
