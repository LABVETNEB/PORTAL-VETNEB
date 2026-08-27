import { expect, test, type Page } from "@playwright/test";
import { suppressNextDevIndicator } from "../helpers/admin-mobile-contracts";

const ORIGIN = "http://127.0.0.1:3000";
const ADMIN_KEY = "vetneb:dashboard:last-module:admin";
const DRAWER = '[data-dashboard-navigation-drawer="admin"]';
const MOBILE = '[data-dashboard-mobile-nav="admin"]';
const HUB = '[data-dashboard-hub-root="true"]';

async function prepare(page: Page, lastModule: string | null = null) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: ORIGIN,
    },
  ]);
  await page.addInitScript(
    ({ key, value }) => {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // The no-storage scenario installs its own failure shim.
      }
    },
    { key: ADMIN_KEY, value: lastModule },
  );
}

async function open(page: Page, path: string, lastModule: string | null = null) {
  await prepare(page, lastModule);
  await page.goto(path);
  await expect(page.locator("main.dashboard-main")).toBeVisible({ timeout: 25_000 });
  await suppressNextDevIndicator(page);
}

async function expectModule(page: Page, moduleId: string) {
  await expect(page).toHaveURL(new RegExp(`/dashboard/admin\\?module=${moduleId}$`), {
    timeout: 20_000,
  });
  await expect(
    page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
  ).toBeVisible({ timeout: 20_000 });
}

async function expectPersistedLastModule(page: Page, moduleId: string) {
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), ADMIN_KEY))
    .toBe(moduleId);
}

test.describe("B13 · durable admin entry and explicit hub", () => {
  test("1 valid ?module wins over the persisted module", async ({ page }) => {
    await open(page, "/dashboard/admin?module=admin-clinics", "admin-sessions");
    await expectModule(page, "admin-clinics");
  });

  test("2 an alias is a valid URL module and wins over persistence", async ({ page }) => {
    await open(page, "/dashboard/admin?module=maintenance", "admin-sessions");
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=maintenance$/);
    await expect(page.locator('[data-dashboard-module-workspace="admin-maintenance"]')).toBeVisible();
  });

  test("3 ?hub=1 wins over a persisted module", async ({ page }) => {
    await open(page, "/dashboard/admin?hub=1", "admin-sessions");
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/);
    await expect(page.locator(HUB)).toBeVisible();
  });

  test("4 an invalid module remains on the legacy hub URL", async ({ page }) => {
    await open(page, "/dashboard/admin?module=unknown-b13", "admin-sessions");
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=unknown-b13$/);
    await expect(page.locator(HUB)).toBeVisible();
  });

  test("5 a bare landing restores the valid persisted module with replace", async ({ page }) => {
    await open(page, "/dashboard/admin", "admin-sessions");
    await expectModule(page, "admin-sessions");
  });

  test("6 a bare landing without persistence replaces to the explicit default", async ({ page }) => {
    await open(page, "/dashboard/admin");
    await expectModule(page, "admin");
  });

  test("7 a stale persisted value replaces to the explicit default", async ({ page }) => {
    await open(page, "/dashboard/admin", "not-an-admin-module");
    await expectModule(page, "admin");
  });

  test("8 unavailable storage replaces to the explicit default", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Storage.prototype, "getItem", {
        configurable: true,
        value() {
          throw new Error("storage unavailable");
        },
      });
    });
    await open(page, "/dashboard/admin");
    await expectModule(page, "admin");
  });

  test("9 desktop Inicio uses the explicit hub URL and preserves the last module", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, "/dashboard/admin?module=admin-clinics");
    await expectPersistedLastModule(page, "admin-clinics");
    await page.locator(`${DRAWER} [data-dashboard-navigation-item="home"]`).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/);
    await expect(page.locator(HUB)).toBeVisible();
    await expectPersistedLastModule(page, "admin-clinics");
  });

  test("10 desktop explicit hub remains stable after reload", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, "/dashboard/admin?hub=1", "admin-sessions");
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/);
    await expect(page.locator(HUB)).toBeVisible();
  });

  test("11 mobile Inicio uses the explicit hub URL and preserves the last module", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/dashboard/admin?module=admin-clinics");
    await expectPersistedLastModule(page, "admin-clinics");
    await page.locator(`${MOBILE} [data-dashboard-mobile-nav-item="home"]`).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/);
    await expect(page.locator(HUB)).toBeVisible();
    await expectPersistedLastModule(page, "admin-clinics");
  });

  test("12 Back returns from explicit hub to the previous module", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, "/dashboard/admin?module=admin-clinics");
    await page.locator(`${DRAWER} [data-dashboard-navigation-item="home"]`).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/);
    await page.goBack();
    await expectModule(page, "admin-clinics");
  });
});
