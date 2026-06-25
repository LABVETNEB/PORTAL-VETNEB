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
 * aria-current is verifiable there. PR-CL4 resolved the Informes/Logística
 * nav dualism (CL-GAP-7): all 5 clinic modules now navigate through the
 * canonical `?module=` workspace, so aria-current is uniformly verifiable.
 */
const CLINIC_MODULES_WITH_VERIFIABLE_NAV: Record<ClinicModule, string | null> = {
  operaciones: "Resumen",
  informes: "Informes",
  logistica: "Logística",
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

async function expectClinicStage(page: Page) {
  const stage = page.locator(
    '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"]',
  );
  await expect(stage).toBeVisible({ timeout: 8_000 });
  await expect(stage).toHaveCount(1);
  return stage;
}

async function expectSingleClinicLayer(
  page: Page,
  expected: "hub" | ClinicModule,
) {
  await expectClinicStage(page);

  if (expected === "hub") {
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toBeVisible();
    await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
    return;
  }

  await expect(
    page.locator(`[data-dashboard-module-workspace="${expected}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
}

test.describe("clinic controller/workspace parity contract (PR-CL1)", () => {
  test("clinic /dashboard loads the module hub", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expectSingleClinicLayer(page, "hub");
    await expect(page.locator('[data-clinic-cockpit="true"]')).toBeVisible();
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

    await expectSingleClinicLayer(page, "hub");
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(page).not.toHaveURL(/module=/);
  });

  test("clinic stage persists when returning to hub", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expectSingleClinicLayer(page, "operaciones");

    const stage = await expectClinicStage(page);
    await stage.evaluate((element) => {
      (element as HTMLElement).dataset.e2eStageToken = "clinic-stage";
    });

    await page
      .locator('[data-dashboard-module-workspace="operaciones"]')
      .locator('button[aria-label="Vista general"]')
      .click();

    await expectSingleClinicLayer(page, "hub");
    await expect(
      page.locator(
        '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"][data-e2e-stage-token="clinic-stage"]',
      ),
    ).toBeVisible();
  });

  for (const moduleId of CLINIC_MODULES) {
    const navLabel = CLINIC_MODULES_WITH_VERIFIABLE_NAV[moduleId];
    if (!navLabel) continue;

    test(`clinic ${moduleId} keeps active nav item aria-current visible`, async ({
      page,
    }) => {
      await setClinicSession(page);
      await page.goto(`/dashboard?module=${moduleId}`);
      await expectSingleClinicLayer(page, moduleId);

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
    await expectSingleClinicLayer(page, "hub");

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });
});

test.describe("clinic cockpit hub parity (PR-CL7)", () => {
  test("hub exposes operational cockpit sections and primary actions", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");

    const cockpit = page.locator('[data-clinic-cockpit="true"]');
    await expect(cockpit).toBeVisible({ timeout: 8_000 });

    for (const selector of [
      '[data-clinic-cockpit-status="true"]',
      '[data-clinic-cockpit-attention="true"]',
      '[data-clinic-cockpit-continuity="true"]',
      '[data-clinic-cockpit-activity="true"]',
      '[data-clinic-cockpit-modules="true"]',
      '[data-clinic-cockpit-primary-actions="true"]',
    ]) {
      await expect(cockpit.locator(selector)).toBeVisible();
    }

    for (const label of [
      "Abrir operaciones",
      "Abrir informes",
      "Abrir logística",
      "Abrir perfil",
      "Generar o abrir tokens",
    ]) {
      await expect(
        cockpit.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
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
