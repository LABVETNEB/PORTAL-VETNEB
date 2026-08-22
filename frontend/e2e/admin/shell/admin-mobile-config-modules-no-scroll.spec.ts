import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  ADMIN_MOBILE_TOLERANCE as TOLERANCE,
  applyColorMode,
  assertGutterContract,
  assertModuleNoScrollContract as assertNoScrollContract,
  fulfillJson,
  readModuleNoScrollContract as readNoScrollContract,
  setPopulatedAdminSession,
  suppressNextDevIndicator,
} from "../../helpers/admin-mobile-contracts";

// PR-C — Admin mobile CONFIG modules (Precios + Mantenimiento). These rendered
// the desktop editor card / ModuleTabs on mobile; with populated data they
// overflowed under the bottom nav. This spec pins dedicated mobile variants
// (`[data-admin-mobile-config-module]`) that fit 360/390/430 in light + dark
// with zero scroll, balanced bottom gutter and no header divider.

const MOBILE_VIEWPORTS = [
  { name: "android-short-360x640", width: 360, height: 640 },
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const COLOR_MODES = ["light", "dark"] as const;

const DESKTOP_VIEWPORT = { name: "desktop-1280x800", width: 1280, height: 800 } as const;

type Viewport = { name: string; width: number; height: number };

type ConfigModule = {
  key: "admin-pricing" | "admin-maintenance";
  moduleId: "admin-pricing" | "admin-maintenance";
  desktopReady: string | RegExp;
};

const CONFIG_MODULES: ConfigModule[] = [
  { key: "admin-pricing", moduleId: "admin-pricing", desktopReady: "Lista de precios" },
  {
    key: "admin-maintenance",
    moduleId: "admin-maintenance",
    desktopReady: /Mantenimiento|Estado de esquema/i,
  },
];

const PRICING_CATEGORIES = ["Histopatología", "Citología", "Inmunohistoquímica"].map(
  (category, c) => ({
    category,
    items: Array.from({ length: 4 }, (_, i) => {
      const id = 5000 + c * 10 + i;
      return {
        id,
        studyName: `${category} — estudio ${i + 1}`,
        priceLabel: i % 3 === 0 ? null : `$${(c + 1) * 1000 + i * 100}`,
        displayOrder: i,
        isActive: i % 4 !== 3,
        updatedAt: "2026-06-18T10:00:00.000Z",
      };
    }),
  }),
);

const DRY_RUN_CANDIDATES = Array.from({ length: 7 }, (_, i) => ({
  label: `Grupo de limpieza ${i + 1}`,
  category: `purge.category.${i + 1}`,
  supported: i % 2 === 0,
  count: 10 + i,
  destructiveAction: i % 2 === 0 ? `delete_${i}` : null,
  reason: i % 3 === 0 ? "Pendiente de soporte backend." : null,
}));

const CONFIG_SNAPSHOT_PHASE =
  process.env.CONFIG_SNAPSHOT_PHASE === "before" ? "before" : "after";

async function mockConfigApis(page: Page) {
  await page.route("**/api/admin/pricing**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/pricing") {
      await fulfillJson(route, { success: true, categories: PRICING_CATEGORIES });
      return;
    }
    if (request.method() === "PATCH" && /\/api\/admin\/pricing\/\d+$/.test(url.pathname)) {
      const id = Number(url.pathname.split("/").pop());
      let patch: Record<string, unknown> = {};
      try {
        patch = JSON.parse(request.postData() ?? "{}");
      } catch {
        patch = {};
      }
      await fulfillJson(route, {
        success: true,
        pricingItem: {
          id,
          category: "Histopatología",
          studyName: "Estudio actualizado",
          priceLabel: "priceLabel" in patch ? patch.priceLabel : "$1000",
          displayOrder: "displayOrder" in patch ? patch.displayOrder : 0,
          isActive: "isActive" in patch ? patch.isActive : true,
          updatedAt: "2026-06-19T10:00:00.000Z",
        },
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/admin/system/schema-health**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, {
      success: true,
      status: "ok",
      generatedAt: "2026-06-18T14:30:00.000Z",
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
      summary: { requiredTables: 18, requiredColumns: 96, presentColumns: 96, missingColumns: 0 },
      missing: [],
    });
  });

  await page.route("**/api/admin/system/maintenance/purge-dry-run**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, {
      success: true,
      dryRun: true,
      generatedAt: "2026-06-18T14:30:00.000Z",
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
      totals: { candidateRecords: 88, supportedCandidateRecords: 40, unsupportedGroups: 3 },
      candidates: DRY_RUN_CANDIDATES,
    });
  });
}

type ContentGutters = {
  bottomGutter: number;
  sideGutter: number;
  appBarToChipsGap: number;
};

async function readContentGutters(page: Page, moduleSelector: string): Promise<ContentGutters> {
  return page.evaluate((selector) => {
    const moduleRoot = document.querySelector<HTMLElement>(selector);
    const panel = moduleRoot?.querySelector<HTMLElement>("[data-admin-mobile-config-panel]");
    const chipRow = moduleRoot?.querySelector<HTMLElement>('[role="tablist"]');
    const bottomNav = document.querySelector<HTMLElement>('[data-admin-mobile-bottom-nav="true"]');
    const appBar = document.querySelector<HTMLElement>('[data-admin-mobile-app-bar="true"]');
    if (!moduleRoot || !panel || !chipRow || !bottomNav || !appBar) {
      throw new Error(`Gutter contract incomplete for ${selector}`);
    }
    const navTop = bottomNav.getBoundingClientRect().top;
    let maxBottom = Number.NEGATIVE_INFINITY;
    for (const element of Array.from(panel.querySelectorAll<HTMLElement>("*"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1 && rect.bottom > maxBottom) maxBottom = rect.bottom;
    }
    const panelRect = panel.getBoundingClientRect();
    return {
      bottomGutter: navTop - maxBottom,
      sideGutter: Math.min(panelRect.left, window.innerWidth - panelRect.right),
      appBarToChipsGap: chipRow.getBoundingClientRect().top - appBar.getBoundingClientRect().bottom,
    };
  }, moduleSelector);
}

async function expectInsideContentBand(page: Page, locator: Locator, viewport: Viewport, label: string) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const [appBarBox, bottomNavBox, box] = await Promise.all([
    page.locator('[data-admin-mobile-app-bar="true"]').boundingBox(),
    page.locator('[data-admin-mobile-bottom-nav="true"]').boundingBox(),
    locator.boundingBox(),
  ]);
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(appBarBox, `${label}: app bar box`).not.toBeNull();
  expect(bottomNavBox, `${label}: bottom nav box`).not.toBeNull();
  expect(box!.x, `${label}: left`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right`).toBeLessThanOrEqual(viewport.width + TOLERANCE);
  expect(box!.y, `${label}: below app bar`).toBeGreaterThanOrEqual(appBarBox!.y + appBarBox!.height - TOLERANCE);
  expect(box!.y + box!.height, `${label}: above bottom nav`).toBeLessThanOrEqual(bottomNavBox!.y + TOLERANCE);
}

async function captureScreen(page: Page, testInfo: TestInfo, fileName: string) {
  const dir = resolve(
    testInfo.config.rootDir,
    "..",
    "test-results",
    "admin-mobile-config-modules-no-scroll",
  );
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `${fileName}.png`), animations: "disabled", fullPage: false });
}

for (const moduleSpec of CONFIG_MODULES) {
  for (const viewport of MOBILE_VIEWPORTS) {
    for (const mode of COLOR_MODES) {
      test(`Admin mobile config "${moduleSpec.key}" is no-scroll at ${viewport.name} ${mode}`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await applyColorMode(page, mode);
        await setPopulatedAdminSession(page);
        await mockConfigApis(page);
        await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);
        await suppressNextDevIndicator(page);

        await expect(
          page.locator('[data-admin-mobile-app-bar="true"]'),
          `${viewport.name} ${mode}: app bar`,
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          page.locator('[data-admin-mobile-bottom-nav="true"]'),
          `${viewport.name} ${mode}: bottom nav`,
        ).toBeVisible();
        await expect(
          page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
          `${viewport.name} ${mode}: desktop nav hidden`,
        ).toBeHidden();

        const shortViewport = `${viewport.width}x${viewport.height}`;
        await captureScreen(page, testInfo, `${CONFIG_SNAPSHOT_PHASE}-${shortViewport}-${mode}-${moduleSpec.key}`);

        const moduleSelector = `[data-admin-mobile-config-module="${moduleSpec.key}"]`;
        const moduleRoot = page.locator(moduleSelector);
        await expect(moduleRoot, `${viewport.name} ${mode}: config module root`).toBeVisible({
          timeout: 15_000,
        });

        await expectInsideContentBand(page, moduleRoot, viewport, `${viewport.name} ${mode} ${moduleSpec.key} module`);
        assertNoScrollContract(
          await readNoScrollContract(page, moduleSelector),
          `${viewport.name} ${mode} ${moduleSpec.key} initial`,
        );

        // No redundant workspace-header divider between the app bar and the chips.
        await expect(
          page.locator(`[data-dashboard-module-workspace="${moduleSpec.moduleId}"] .dashboard-workspace-header`),
          `${viewport.name} ${mode} ${moduleSpec.key}: workspace header hidden`,
        ).toBeHidden();

        const consoleErrors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(m.text());
        });

        const chips = moduleRoot.locator("[data-admin-mobile-config-chip]");
        const chipCount = await chips.count();
        expect(chipCount, `${viewport.name} ${mode} ${moduleSpec.key}: section chips`).toBeGreaterThan(1);

        for (let index = 0; index < chipCount; index += 1) {
          const chip = chips.nth(index);
          const chipId = (await chip.getAttribute("data-admin-mobile-config-chip")) ?? String(index);
          await expectInsideContentBand(page, chip, viewport, `${viewport.name} ${mode} ${moduleSpec.key} chip ${chipId}`);
          await chip.click();

          const panel = moduleRoot.locator("[data-admin-mobile-config-panel]");
          await expect(panel, `${viewport.name} ${mode} ${moduleSpec.key} panel ${chipId}`).toBeVisible();

          // Dry-run starts empty: populate it so the contract is checked against
          // real content (also exercises the analyze action).
          const analyze = panel.getByRole("button", { name: "Analizar", exact: true });
          if (await analyze.count()) await analyze.click();

          await panel
            .locator('[data-admin-mobile-config-item="true"], [data-admin-mobile-ops-pager="true"]')
            .first()
            .waitFor({ state: "visible", timeout: 10_000 })
            .catch(() => {});

          await expectInsideContentBand(page, panel, viewport, `${viewport.name} ${mode} ${moduleSpec.key} panel ${chipId}`);
          assertNoScrollContract(
            await readNoScrollContract(page, moduleSelector),
            `${viewport.name} ${mode} ${moduleSpec.key} section ${chipId}`,
          );

          const gutters = await readContentGutters(page, moduleSelector);
          expect(
            gutters.appBarToChipsGap,
            `${viewport.name} ${mode} ${moduleSpec.key} ${chipId}: app bar -> chips gap <= 14px; got ${gutters.appBarToChipsGap}`,
          ).toBeLessThanOrEqual(14);
          assertGutterContract(gutters, `${viewport.name} ${mode} ${moduleSpec.key} ${chipId}`);

          await captureScreen(page, testInfo, `${CONFIG_SNAPSHOT_PHASE}-${shortViewport}-${mode}-${moduleSpec.key}-${chipId}`);
        }

        await page
          .locator('[data-admin-mobile-bottom-nav="true"]')
          .getByRole("button", { name: "Inicio", exact: true })
          .click();
        await expect(
          page.locator('[data-admin-mobile-hub-launcher="true"]'),
          `${viewport.name} ${mode}: back to hub`,
        ).toBeVisible({ timeout: 15_000 });

        expect(consoleErrors, `${viewport.name} ${mode} ${moduleSpec.key}: console errors`).toEqual([]);
      });
    }
  }
}

for (const moduleSpec of CONFIG_MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height });
    await setPopulatedAdminSession(page);
    await mockConfigApis(page);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    await expect(
      page.locator('[data-dashboard-navigation-drawer="admin"]'),
      `${moduleSpec.key} desktop: lateral nav visible`,
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-admin-mobile-bottom-nav="true"]'),
      `${moduleSpec.key} desktop: bottom nav absent`,
    ).toBeHidden();
    await expect(
      page.locator(`[data-admin-mobile-config-module="${moduleSpec.key}"]`),
      `${moduleSpec.key} desktop: mobile config module hidden`,
    ).toBeHidden();
    await expect(
      page.locator(`[data-dashboard-module-workspace="${moduleSpec.moduleId}"] .dashboard-workspace-header`),
      `${moduleSpec.key} desktop: workspace header visible`,
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator(`[data-dashboard-module-workspace="${moduleSpec.moduleId}"]`)
        .getByText(moduleSpec.desktopReady)
        .filter({ visible: true })
        .first(),
      `${moduleSpec.key} desktop: populated desktop content`,
    ).toBeVisible({ timeout: 15_000 });
  });
}
