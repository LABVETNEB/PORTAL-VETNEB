import { expect, test, type Page } from "@playwright/test";
import { suppressNextDevIndicator } from "../helpers/admin-mobile-contracts";
import { setAdminSession } from "../helpers/session";

const ADMIN_KEY = "vetneb:dashboard:last-module:admin";
const DRAWER = '[data-dashboard-navigation-drawer="admin"]';
const RAIL = '[data-dashboard-navigation-rail="admin"]';
const MOBILE = '[data-dashboard-mobile-nav="admin"]';
const HUB = '[data-dashboard-hub-root="true"]';

async function prepare(page: Page, lastModule: string | null = null) {
  await setAdminSession(page, "populated");
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

// Desktop/tablet space pass: the admin hub ("Inicio") is retired at every
// width. Every entry still resolves deterministically; the legacy hub URL and
// an unknown ?module= land where a bare route lands (the persisted module,
// else Resumen), replaced in place so Back never strands on a hub.
test.describe("B13 · durable admin entry with the hub retired", () => {
  test("1 valid ?module wins over the persisted module", async ({ page }) => {
    await open(page, "/dashboard/admin?module=admin-clinics", "admin-sessions");
    await expectModule(page, "admin-clinics");
  });

  test("2 an alias is a valid URL module and wins over persistence", async ({ page }) => {
    await open(page, "/dashboard/admin?module=maintenance", "admin-sessions");
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=maintenance$/);
    await expect(page.locator('[data-dashboard-module-workspace="admin-maintenance"]')).toBeVisible();
  });

  test("3 a legacy ?hub=1 lands on the persisted module, never on a hub", async ({ page }) => {
    await open(page, "/dashboard/admin?hub=1", "admin-sessions");
    await expectModule(page, "admin-sessions");
    await expect(page.locator(HUB)).toHaveCount(0);
  });

  test("4 an invalid module lands on the persisted module", async ({ page }) => {
    await open(page, "/dashboard/admin?module=unknown-b13", "admin-sessions");
    await expectModule(page, "admin-sessions");
    await expect(page.locator(HUB)).toHaveCount(0);
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

  test("9 desktop and tablet have no Inicio: ?hub=1 lands on the persisted module and keeps it", async ({ page }) => {
    for (const [width, height, band] of [[1366, 768, DRAWER], [1024, 768, RAIL], [768, 1024, RAIL]] as const) {
      await page.setViewportSize({ width, height });
      await open(page, "/dashboard/admin?module=admin-clinics");
      await expectPersistedLastModule(page, "admin-clinics");
      await expect(page.locator(`${band} [data-dashboard-navigation-item="home"]`), `${width}x${height}: no Inicio`).toHaveCount(0);
      await open(page, "/dashboard/admin?hub=1", "admin-clinics");
      await expectModule(page, "admin-clinics");
      await expect(page.locator(HUB)).toHaveCount(0);
      await expectPersistedLastModule(page, "admin-clinics");
    }
  });

  test("10 desktop: the resolved legacy hub entry is stable after reload", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, "/dashboard/admin?hub=1", "admin-sessions");
    await expectModule(page, "admin-sessions");
    await page.reload();
    await expectModule(page, "admin-sessions");
    await expect(page.locator(HUB)).toHaveCount(0);
  });

  test("11 mobile has no Inicio: ?hub=1 lands on the persisted module and keeps it", async ({ page }) => {
    // Pre-C05 mobile space: the admin mobile hub (Inicio) is retired below 768px.
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/dashboard/admin?module=admin-clinics");
    await expectPersistedLastModule(page, "admin-clinics");
    await expect(page.locator(`${MOBILE} [data-dashboard-mobile-nav-item="home"]`)).toHaveCount(0);
    // `open` re-seeds storage on every load; seed the module this visit persisted.
    await open(page, "/dashboard/admin?hub=1", "admin-clinics");
    await expectModule(page, "admin-clinics");
    await expect(page.locator(HUB)).toBeHidden();
    await expectPersistedLastModule(page, "admin-clinics");
  });

  test("12 Back from a module never returns to a hub: the legacy entry was replaced", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, "/dashboard/admin?hub=1", "admin-clinics");
    await expectModule(page, "admin-clinics");
    await page.locator(`${DRAWER} [data-dashboard-navigation-item="admin-sessions"]`).click();
    await expectModule(page, "admin-sessions");
    await page.goBack();
    await expectModule(page, "admin-clinics");
    await expect(page.locator(HUB)).toHaveCount(0);
  });
});
