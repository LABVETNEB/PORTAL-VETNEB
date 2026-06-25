import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const VIEWPORT = { width: 390, height: 844 } as const;
const TOLERANCE = 2;

type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

const MODULES: Array<{ label: string; moduleId: ClinicModule }> = [
  { label: "Operaciones", moduleId: "operaciones" },
  { label: "Informes", moduleId: "informes" },
  { label: "Logística", moduleId: "logistica" },
  { label: "Perfil", moduleId: "perfil" },
  { label: "Tokens", moduleId: "tokens" },
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

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

function bottomNav(page: Page) {
  return page.locator('[data-clinic-mobile-bottom-nav="true"]');
}

function bottomNavItem(page: Page, label: string) {
  return bottomNav(page).getByRole("button", { name: label, exact: true });
}

function horizontalNavItem(page: Page, label: string) {
  return page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: label, exact: true });
}

async function readNoScrollContract(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const nav = document.querySelector<HTMLElement>(
      '[data-clinic-mobile-bottom-nav="true"]',
    );

    return {
      htmlOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
      mainOverflowY: main ? main.scrollHeight - main.clientHeight : 0,
      navOverflowX: nav ? nav.scrollWidth - nav.clientWidth : 0,
      workspaceCount: document.querySelectorAll(
        "[data-dashboard-module-workspace]",
      ).length,
      hubCount: document.querySelectorAll('[data-dashboard-module-hub="true"]')
        .length,
      stageCount: document.querySelectorAll(
        '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"]',
      ).length,
    };
  });
}

async function expectNoScrollContract(page: Page, label: string) {
  await expect(async () => {
    const contract = await readNoScrollContract(page);
    expect(contract.htmlOverflowX, `${label}: html horizontal overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.bodyOverflowX, `${label}: body horizontal overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.mainOverflowY, `${label}: main vertical overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.navOverflowX, `${label}: bottom nav overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.stageCount, `${label}: clinic stage mounted`).toBe(1);
  }).toPass({ timeout: 10_000 });
}

async function expectWorkspace(page: Page, moduleId: ClinicModule) {
  await expect(
    page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
  ).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
}

test.describe("clinic mobile bottom nav/stage parity (PR-CL7)", () => {
  test("mobile 390x844 mounts ClinicMobileBottomNav and never AdminMobileBottomNav", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await setClinicSession(page);
    await page.goto("/dashboard");
    await suppressNextDevIndicator(page);

    await expect(bottomNav(page)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toHaveCount(0);
    await expect(
      page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
    ).toBeHidden();
    await expect(bottomNav(page).locator('[data-clinic-mobile-bottom-nav-item="true"]')).toHaveCount(6);

    await expectNoScrollContract(page, "clinic hub");
  });

  test("bottom nav reaches the five clinic modules and keeps aria-current", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await setClinicSession(page);
    await page.goto("/dashboard");
    await suppressNextDevIndicator(page);
    await expect(bottomNav(page)).toBeVisible({ timeout: 8_000 });

    for (const { label, moduleId } of MODULES) {
      await bottomNavItem(page, label).click();
      await expectWorkspace(page, moduleId);
      await expect(bottomNavItem(page, label)).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expectNoScrollContract(page, moduleId);
    }
  });

  test("hub reset returns to cockpit inside the same clinic stage", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await setClinicSession(page);
    await page.goto("/dashboard?module=tokens");
    await suppressNextDevIndicator(page);
    await expectWorkspace(page, "tokens");

    const stage = page.locator(
      '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"]',
    );
    await stage.evaluate((element) => {
      (element as HTMLElement).dataset.e2eStageToken = "mobile-clinic-stage";
    });

    await bottomNavItem(page, "Inicio").click();
    await expect(page.locator('[data-clinic-cockpit="true"]')).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
    await expect(bottomNavItem(page, "Inicio")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.locator(
        '[data-dashboard-module-stage="true"][data-clinic-dashboard-stage="true"][data-e2e-stage-token="mobile-clinic-stage"]',
      ),
    ).toBeVisible();
    await expectNoScrollContract(page, "hub reset");
  });

  test("desktop horizontal nav still syncs to the clinic controller", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(bottomNav(page)).toBeHidden();

    for (const { label, moduleId } of MODULES) {
      const itemLabel = label === "Operaciones" ? "Resumen" : label;
      await horizontalNavItem(page, itemLabel).click();
      await expectWorkspace(page, moduleId);
      await expect(horizontalNavItem(page, itemLabel)).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("admin dashboard keeps AdminMobileBottomNav and does not mount clinic nav", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await setAdminSession(page);
    await page.goto("/dashboard/admin");

    await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toBeVisible({
      timeout: 8_000,
    });
    await expect(bottomNav(page)).toHaveCount(0);
  });
});
