import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_MOBILE_VIEWPORTS,
  assertDocumentNoScrollContract,
  expectInsideViewport,
  fulfillJson,
  readDocumentNoScrollContract,
  suppressNextDevIndicator,
} from "../../helpers/admin-mobile-contracts";
import { A03_ADAPTIVE_DATASET_COOKIE } from "../../helpers/dashboard-adaptive-limit-matrix";
import {
  addAppCookies,
  sessionCookie,
  setAdminSession,
} from "../../helpers/session";

// 40 clinics (R-02): guarantees a page 2 exists for any effectiveLimit <= 36
// (HY superset cap), same margin used by Sessions/Users/Alerts.
const MOCK_CLINICS = Array.from({ length: 40 }, (_, index) => {
  const id = index + 1;
  return {
    clinicId: id,
    clinicName: `Clínica Core ${id}`,
    contactEmail: `clinica.core.${id}@example.test`,
    contactPhone: `+54 11 5555-${String(id).padStart(4, "0")}`,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: `2026-06-${String((id % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    users: [
      {
        userId: 100 + id,
        username: `core-owner-${id}`,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
});

async function mockAdminClinics(page: Page) {
  await page.route("**/api/admin/clinics**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const clinics = MOCK_CLINICS.slice(offset, offset + limit);
    await fulfillJson(route, {
      success: true,
      clinics,
      total: MOCK_CLINICS.length,
      limit,
      offset,
    });
  });
}

type ModuleSpec = {
  key: "clinics" | "reports" | "tokens";
  moduleId: string;
  mock?: (page: Page) => Promise<void>;
  // Viewport-safe page-size ceiling for this module's mobile list; differs per module.
  maxItemsPerPage: number;
};

const MODULES: ModuleSpec[] = [
  // Clinics: R-02 raised the ceiling to the HY superset cap (36); the real
  // guarantee is per-item viewport fit, not a fixed page size.
  { key: "clinics", moduleId: "admin-clinics", mock: mockAdminClinics, maxItemsPerPage: 36 },
  { key: "reports", moduleId: "admin-report-upload", maxItemsPerPage: 36 },
  // R-05 raised the ceiling to the OF superset cap (30); the real guarantee
  // is per-item viewport fit, not a fixed page size.
  { key: "tokens", moduleId: "admin-particular-tokens", maxItemsPerPage: 30 },
];

async function prepareModuleDataset(page: Page, moduleSpec: ModuleSpec) {
  if (moduleSpec.mock) {
    await setAdminSession(page, "default");
    await moduleSpec.mock(page);
    return;
  }

  await addAppCookies(page, [
    sessionCookie("admin", "populated"),
    A03_ADAPTIVE_DATASET_COOKIE,
  ]);
}

for (const moduleSpec of MODULES) {
  for (const viewport of ADMIN_MOBILE_VIEWPORTS) {
    test(`Admin mobile core module "${moduleSpec.key}" is no-scroll at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareModuleDataset(page, moduleSpec);
      await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);
      await suppressNextDevIndicator(page);

      const workspace = page.locator(
        `[data-dashboard-module-workspace="${moduleSpec.moduleId}"]`,
      );
      await expect(workspace, `${viewport.name}: module workspace visible`).toBeVisible({
        timeout: 15_000,
      });

      const moduleRoot = page.locator(
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      await expect(moduleRoot, `${viewport.name}: module root visible`).toBeVisible();

      await expect(
        page.locator('[data-admin-mobile-app-bar="true"]'),
        `${viewport.name}: app bar visible`,
      ).toBeVisible();
      await expect(
        page
          .locator('[data-dashboard-mobile-nav="admin"]')
          .filter({ visible: true }),
        `${viewport.name}: bottom nav visible`,
      ).toBeVisible();
      await expect(
        page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
        `${viewport.name}: horizontal nav absent`,
      ).toBeHidden();

      const contract = await readDocumentNoScrollContract(
        page,
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      assertDocumentNoScrollContract(contract, `${viewport.name} ${moduleSpec.key} page 1`);

      const itemSelector = `[data-admin-mobile-core-module="${moduleSpec.key}"] [data-admin-mobile-core-item="true"]`;
      const items = page.locator(itemSelector);
      await expect(
        items.first(),
        `${viewport.name}: ${moduleSpec.key} first item visible`,
      ).toBeVisible({ timeout: 15_000 });

      // R-02: clinics derives its page size from the measured list container
      // (adaptive, HY cap 36), so the first paint can render the fallback
      // count and a follow-up fetch re-renders with the settled fit. Reading
      // count() once mid-settle made .nth(i) chase items from a superseded
      // render (CI failure: "item 10/13/15 not found"). Wait for two
      // consecutive equal counts before iterating; harmless for the fixed-size
      // modules (reports/tokens), whose count is stable immediately.
      let settledCount = -1;
      await expect(async () => {
        const current = await items.count();
        expect(
          current,
          `${viewport.name}: ${moduleSpec.key} has visible items`,
        ).toBeGreaterThan(0);
        if (settledCount !== current) {
          settledCount = current;
          throw new Error(
            `${moduleSpec.key} item count not yet stable: ${current}`,
          );
        }
      }).toPass({ intervals: [250, 350, 500, 750, 1_000], timeout: 10_000 });

      const itemCount = settledCount;
      expect(itemCount, `${viewport.name}: ${moduleSpec.key} has visible items`).toBeGreaterThan(0);
      expect(
        itemCount,
        `${viewport.name}: ${moduleSpec.key} page size must remain viewport-safe`,
      ).toBeLessThanOrEqual(moduleSpec.maxItemsPerPage);

      for (let index = 0; index < itemCount; index += 1) {
        await expectInsideViewport(
          items.nth(index),
          viewport,
          `${viewport.name}: ${moduleSpec.key} item ${index + 1}`,
        );
      }

      const pager = page.locator(
        `[data-admin-mobile-core-module="${moduleSpec.key}"] [data-admin-mobile-core-pager="true"]`,
      );
      await expectInsideViewport(
        pager,
        viewport,
        `${viewport.name}: ${moduleSpec.key} pager`,
      );

      const nextButton = pager.getByRole("button", { name: /siguiente|próxim/i });
      await expect(nextButton, `${viewport.name}: ${moduleSpec.key} next page button`).toBeVisible();
      await expect(nextButton, `${viewport.name}: ${moduleSpec.key} next page button enabled`).toBeEnabled();

      const firstPageLabels = await items.allTextContents();
      await nextButton.click();
      await expect
        .poll(async () => (await items.allTextContents()).join("|"), {
          message: `${viewport.name}: ${moduleSpec.key} page changes after pagination`,
        })
        .not.toBe(firstPageLabels.join("|"));

      const page2Contract = await readDocumentNoScrollContract(
        page,
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      assertDocumentNoScrollContract(page2Contract, `${viewport.name} ${moduleSpec.key} page 2`);

      const bottomNav = page
        .locator('[data-dashboard-mobile-nav="admin"]')
        .filter({ visible: true });
      await bottomNav.getByRole("button", { name: "Inicio", exact: true }).click();
      await expect(
        page.locator('[data-admin-mobile-hub-launcher="true"]'),
        `${viewport.name}: returning Inicio shows hub launcher`,
      ).toBeVisible({ timeout: 15_000 });
    });
  }
}

test("Admin mobile core modules reachable from bottom nav and Más menu", async ({ page }) => {
  const viewport = ADMIN_MOBILE_VIEWPORTS[0];
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await addAppCookies(page, [
    sessionCookie("admin", "populated"),
    A03_ADAPTIVE_DATASET_COOKIE,
  ]);
  await mockAdminClinics(page);
  await page.goto("/dashboard/admin?hub=1");
  await suppressNextDevIndicator(page);

  const bottomNav = page
    .locator('[data-dashboard-mobile-nav="admin"]')
    .filter({ visible: true });
  await expect(bottomNav).toBeVisible();

  await bottomNav.getByRole("button", { name: "Clínicas", exact: true }).click();
  await expect(
    page.locator('[data-admin-mobile-core-module="clinics"]'),
  ).toBeVisible({ timeout: 15_000 });

  await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
  const moduleMenu = page.locator('[data-dashboard-mobile-nav-overflow="true"]');
  await expect(moduleMenu).toBeVisible();
  await moduleMenu
    .locator('[data-dashboard-mobile-nav-overflow-link]')
    .filter({ hasText: "Informes" })
    .click();
  await expect(
    page.locator('[data-admin-mobile-core-module="reports"]'),
  ).toBeVisible({ timeout: 15_000 });

  await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
  await expect(moduleMenu).toBeVisible();
  await moduleMenu
    .locator('[data-dashboard-mobile-nav-overflow-link]')
    .filter({ hasText: "Tokens" })
    .click();
  await expect(
    page.locator('[data-admin-mobile-core-module="tokens"]'),
  ).toBeVisible({ timeout: 15_000 });
});

test("Admin mobile reports pagination advances through measured pages with pager anchored at the bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addAppCookies(page, [
    sessionCookie("admin", "populated"),
    A03_ADAPTIVE_DATASET_COOKIE,
  ]);

  await page.goto("/dashboard/admin?module=admin-report-upload");
  await expect(
    page.locator('[data-dashboard-module-workspace="admin-report-upload"]'),
  ).toBeVisible({ timeout: 15_000 });

  const list = page.locator("[data-admin-reports-mobile-list='true']");
  await expect(list).toBeVisible();
  // R-03: the page size is measured (HY cap 36), not a fixed 10. The first
  // record is always on page 1; assert the adaptive contract instead of a
  // hard-coded per-page count.
  const items = list.locator("[data-admin-mobile-core-item='true']");
  await expect(items.first()).toBeVisible();
  await expect(list.getByText("#7400 ", { exact: false })).toBeVisible();

  // Wait for the measurement↔fetch settle (two consecutive equal counts)
  // before reading the page-1 contents, same pattern as the no-scroll loop.
  let settledCount = -1;
  await expect(async () => {
    const current = await items.count();
    expect(current).toBeGreaterThan(0);
    if (settledCount !== current) {
      settledCount = current;
      throw new Error(`reports item count not yet stable: ${current}`);
    }
  }).toPass({ intervals: [250, 350, 500, 750, 1_000], timeout: 10_000 });
  expect(settledCount).toBeGreaterThan(0);
  expect(settledCount).toBeLessThanOrEqual(36);

  const pager = page.locator("[data-admin-mobile-core-pager='true']");
  await expect(pager.getByText("Pág. 1")).toBeVisible();

  const [pagerBox, bottomNavBox] = await Promise.all([
    pager.boundingBox(),
    page
      .locator('[data-dashboard-mobile-nav="admin"]')
      .filter({ visible: true })
      .boundingBox(),
  ]);
  expect(pagerBox).not.toBeNull();
  expect(bottomNavBox).not.toBeNull();
  expect(pagerBox!.y + pagerBox!.height).toBeLessThanOrEqual(bottomNavBox!.y + 2);

  const firstPageLabels = (await items.allTextContents()).join("|");
  await pager.getByRole("button", { name: "Página siguiente" }).click();
  // Page 2 shows different records; the first record (#7400) is no longer here.
  await expect
    .poll(async () => (await items.allTextContents()).join("|"))
    .not.toBe(firstPageLabels);
  await expect(list.getByText("#7400 ", { exact: false })).toHaveCount(0);
  await expect(pager.getByText("Pág. 2")).toBeVisible();
});

for (const moduleSpec of MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepareModuleDataset(page, moduleSpec);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    await expect(
      page
        .locator('[data-dashboard-navigation-drawer="admin"]')
        .filter({ visible: true }),
      `${moduleSpec.key} desktop: lateral nav visible`,
    ).toBeVisible({ timeout: 15_000 });
    // `DashboardMobileNav` streams through a Suspense boundary whose fallback
    // mounts a SECOND <nav> carrying the same attribute, so the bare selector
    // resolves to two nodes and `toBeHidden()` dies on strict mode BEFORE
    // visibility is ever considered. The desktop contract is "no PAINTED bar",
    // not "at most one DOM node": assert zero VISIBLE bars, which still fails
    // with one visible and with two, and excludes only the hidden staging copy.
    await expect(
      page
        .locator('[data-dashboard-mobile-nav="admin"]')
        .filter({ visible: true }),
      `${moduleSpec.key} desktop: bottom nav absent`,
    ).toHaveCount(0);
    await expect(
      page.locator(`[data-admin-mobile-core-module="${moduleSpec.key}"]`),
      `${moduleSpec.key} desktop: mobile core module root absent`,
    ).toBeHidden();
  });
}
