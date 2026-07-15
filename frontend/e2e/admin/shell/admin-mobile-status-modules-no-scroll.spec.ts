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

// PR-B — Admin mobile STATUS modules (Administración/Resumen + Estado del
// sistema). These two modules still rendered the desktop ModuleTabs/grids on
// mobile, collapsing to a single column whose last cards fell under the bottom
// nav (P1 no-scroll defect). This spec pins a dedicated mobile variant
// (`[data-admin-mobile-status-module]`) that fits 360/390/430 in light + dark
// with zero scroll, zero overflow auto/scroll, and nothing under the bottom nav.

const MOBILE_VIEWPORTS = [
  { name: "android-short-360x640", width: 360, height: 640 },
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const COLOR_MODES = ["light", "dark"] as const;

const DESKTOP_VIEWPORT = {
  name: "desktop-1280x800",
  width: 1280,
  height: 800,
} as const;

type Viewport = { name: string; width: number; height: number };

type StatusModule = {
  key: "admin" | "admin-health";
  moduleId: "admin" | "admin-health";
  screenshotKey: "admin" | "admin-health";
  desktopReady: string | RegExp;
};

const STATUS_MODULES: StatusModule[] = [
  {
    key: "admin",
    moduleId: "admin",
    screenshotKey: "admin",
    desktopReady: "Resumen operativo",
  },
  {
    key: "admin-health",
    moduleId: "admin-health",
    screenshotKey: "admin-health",
    desktopReady: /Base de datos|Estado y mantenimiento/i,
  },
];

// 40 alerts so a second page exists for any adaptive fit (RF cap 25): the
// failed-login list is now sized by the measured viewport, not a fixed 10.
const MOCK_FAILED_LOGIN_ALERTS = Array.from({ length: 40 }, (_, index) => ({
  id: 6100 + index,
  surface: (["admin", "clinic", "particular"] as const)[index % 3],
  username: index % 4 === 0 ? null : `intento_${index}`,
  reason: (
    ["invalid_credentials", "missing_credentials", "rate_limited"] as const
  )[index % 3],
  ipAddress: `203.0.113.${10 + index}`,
  userAgent: "Mozilla/5.0 (e2e-status-module)",
  createdAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T09:30:00.000Z`,
}));

// Pre-measurement fallback and re-fetch cap of the adaptive failed-login
// contract (mirrors AdminFailedLoginAlertsReadOnlyCard).
const FAILED_LOGIN_FALLBACK_ROWS = 5;
const FAILED_LOGIN_LIMIT_CAP = 25;

const STATUS_SNAPSHOT_PHASE =
  process.env.STATUS_SNAPSHOT_PHASE === "before" ? "before" : "after";

// The status modules fetch two client-side surfaces on demand (failed-login
// alerts and schema health). The populated fixture server does not serve them,
// so mock them here to keep the Alertas/Esquema chips populated.
async function mockStatusApis(page: Page) {
  await page.route("**/api/admin/failed-login-alerts**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.method() !== "GET" ||
      url.pathname !== "/api/admin/failed-login-alerts"
    ) {
      await route.fallback();
      return;
    }
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      failedLoginAlerts: MOCK_FAILED_LOGIN_ALERTS.slice(offset, offset + limit),
      total: MOCK_FAILED_LOGIN_ALERTS.length,
      limit,
      offset,
    });
  });

  await page.route("**/api/admin/system/schema-health**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, {
      success: true,
      status: "ok",
      generatedAt: "2026-06-18T14:30:00.000Z",
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
      summary: {
        requiredTables: 18,
        requiredColumns: 96,
        presentColumns: 96,
        missingColumns: 0,
      },
      missing: [],
    });
  });
}

async function expectInsideContentBand(
  page: Page,
  locator: Locator,
  viewport: Viewport,
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const [appBarBox, bottomNavBox, box] = await Promise.all([
    page.locator('[data-admin-mobile-app-bar="true"]').boundingBox(),
    page.locator('[data-admin-mobile-bottom-nav="true"]').boundingBox(),
    locator.boundingBox(),
  ]);

  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(appBarBox, `${label}: app bar bounding box`).not.toBeNull();
  expect(bottomNavBox, `${label}: bottom nav bounding box`).not.toBeNull();

  expect(box!.x, `${label}: left`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right`).toBeLessThanOrEqual(
    viewport.width + TOLERANCE,
  );
  expect(box!.y, `${label}: below app bar`).toBeGreaterThanOrEqual(
    appBarBox!.y + appBarBox!.height - TOLERANCE,
  );
  expect(
    box!.y + box!.height,
    `${label}: above bottom nav`,
  ).toBeLessThanOrEqual(bottomNavBox!.y + TOLERANCE);
}

async function captureScreen(
  page: Page,
  testInfo: TestInfo,
  fileName: string,
) {
  const screenshotDirectory = resolve(
    testInfo.config.rootDir,
    "..",
    "test-results",
    "admin-mobile-status-modules-no-scroll",
  );
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, `${fileName}.png`),
    animations: "disabled",
    fullPage: false,
  });
}

type ContentGutters = {
  bottomGutter: number;
  sideGutter: number;
  appBarToChipsGap: number;
  headerVisible: boolean;
};

// Measures, for the active panel of a status module: the gutter below the last
// visible content element (down to the bottom nav), the side gutter of the
// panel, the app-bar -> chips gap, and whether the redundant workspace header is
// still painted. Used to enforce the balanced-gutter + no-divider contract.
async function readContentGutters(
  page: Page,
  moduleSelector: string,
): Promise<ContentGutters> {
  return page.evaluate((selector) => {
    const moduleRoot = document.querySelector<HTMLElement>(selector);
    const panel = moduleRoot?.querySelector<HTMLElement>(
      "[data-admin-mobile-status-panel]",
    );
    const chipRow = moduleRoot?.querySelector<HTMLElement>('[role="tablist"]');
    const bottomNav = document.querySelector<HTMLElement>(
      '[data-admin-mobile-bottom-nav="true"]',
    );
    const appBar = document.querySelector<HTMLElement>(
      '[data-admin-mobile-app-bar="true"]',
    );
    const workspace = moduleRoot?.closest<HTMLElement>(
      "[data-dashboard-module-workspace]",
    );
    const header = workspace?.querySelector<HTMLElement>(
      ".dashboard-workspace-header",
    );

    if (!moduleRoot || !panel || !chipRow || !bottomNav || !appBar) {
      throw new Error(`Gutter contract incomplete for ${selector}`);
    }

    const navTop = bottomNav.getBoundingClientRect().top;
    // Lowest visible content pixel inside the active panel (the real content,
    // not an empty wrapper): take the max bottom across visible descendants.
    let maxBottom = Number.NEGATIVE_INFINITY;
    for (const element of Array.from(panel.querySelectorAll<HTMLElement>("*"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1 && rect.bottom > maxBottom) {
        maxBottom = rect.bottom;
      }
    }
    const panelRect = panel.getBoundingClientRect();
    const headerStyle = header ? window.getComputedStyle(header) : null;

    return {
      bottomGutter: navTop - maxBottom,
      sideGutter: Math.min(panelRect.left, window.innerWidth - panelRect.right),
      appBarToChipsGap:
        chipRow.getBoundingClientRect().top -
        appBar.getBoundingClientRect().bottom,
      headerVisible: headerStyle ? headerStyle.display !== "none" : false,
    };
  }, moduleSelector);
}

for (const moduleSpec of STATUS_MODULES) {
  for (const viewport of MOBILE_VIEWPORTS) {
    for (const mode of COLOR_MODES) {
      test(`Admin mobile status "${moduleSpec.key}" is no-scroll at ${viewport.name} ${mode}`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(60_000);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await applyColorMode(page, mode);
        await setPopulatedAdminSession(page);
        await mockStatusApis(page);
        await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);
        await suppressNextDevIndicator(page);

        // Mobile chrome present, desktop nav gone.
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

        // Screenshot first so a RED (pre-fix) run still emits before-* evidence.
        const shortViewport = `${viewport.width}x${viewport.height}`;
        await captureScreen(
          page,
          testInfo,
          `${STATUS_SNAPSHOT_PHASE}-${shortViewport}-${mode}-${moduleSpec.screenshotKey}`,
        );

        const moduleSelector = `[data-admin-mobile-status-module="${moduleSpec.key}"]`;
        const moduleRoot = page.locator(moduleSelector);
        await expect(
          moduleRoot,
          `${viewport.name} ${mode}: status module root`,
        ).toBeVisible({ timeout: 15_000 });

        await expectInsideContentBand(
          page,
          moduleRoot,
          viewport,
          `${viewport.name} ${mode} ${moduleSpec.key} module`,
        );
        assertNoScrollContract(
          await readNoScrollContract(page, moduleSelector),
          `${viewport.name} ${mode} ${moduleSpec.key} initial`,
        );

        // No redundant workspace-header divider/band between the app bar and the
        // chips on Admin mobile (the app-bar -> chips gap is asserted per chip).
        await expect(
          page.locator(
            `[data-dashboard-module-workspace="${moduleSpec.moduleId}"] .dashboard-workspace-header`,
          ),
          `${viewport.name} ${mode} ${moduleSpec.key}: workspace header hidden`,
        ).toBeHidden();

        // No console errors during the whole interaction.
        const consoleErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });

        // Every section chip must be reachable, fit the content band, keep the
        // no-scroll contract and land its last visible element ~one gutter above
        // the bottom nav (balanced bottom margin, no void, not pegged).
        const chips = moduleRoot.locator("[data-admin-mobile-status-chip]");
        const chipCount = await chips.count();
        expect(
          chipCount,
          `${viewport.name} ${mode} ${moduleSpec.key}: section chips`,
        ).toBeGreaterThan(1);

        for (let index = 0; index < chipCount; index += 1) {
          const chip = chips.nth(index);
          const chipId =
            (await chip.getAttribute("data-admin-mobile-status-chip")) ??
            String(index);
          await expectInsideContentBand(
            page,
            chip,
            viewport,
            `${viewport.name} ${mode} ${moduleSpec.key} chip ${chipId}`,
          );
          await chip.click();

          const panel = moduleRoot.locator(
            "[data-admin-mobile-status-panel]",
          );
          await expect(
            panel,
            `${viewport.name} ${mode} ${moduleSpec.key} panel ${chipId}`,
          ).toBeVisible();
          // Wait for the (possibly lazy-fetched) content to render so the
          // gutter is measured against real content, not a transient state.
          await panel
            .locator(
              '[data-admin-mobile-status-item="true"], [data-admin-mobile-ops-pager="true"]',
            )
            .first()
            .waitFor({ state: "visible", timeout: 10_000 })
            .catch(() => {});

          await expectInsideContentBand(
            page,
            panel,
            viewport,
            `${viewport.name} ${mode} ${moduleSpec.key} panel ${chipId}`,
          );
          assertNoScrollContract(
            await readNoScrollContract(page, moduleSelector),
            `${viewport.name} ${mode} ${moduleSpec.key} section ${chipId}`,
          );

          const gutters = await readContentGutters(page, moduleSelector);
          expect(
            gutters.appBarToChipsGap,
            `${viewport.name} ${mode} ${moduleSpec.key} ${chipId}: app bar -> chips gap <= 14px; got ${gutters.appBarToChipsGap}`,
          ).toBeLessThanOrEqual(14);
          assertGutterContract(
            gutters,
            `${viewport.name} ${mode} ${moduleSpec.key} ${chipId}`,
          );

          await captureScreen(
            page,
            testInfo,
            `${STATUS_SNAPSHOT_PHASE}-${shortViewport}-${mode}-${moduleSpec.screenshotKey}-${chipId}`,
          );
        }

        await page
          .locator('[data-admin-mobile-bottom-nav="true"]')
          .getByRole("button", { name: "Inicio", exact: true })
          .click();
        await expect(
          page.locator('[data-admin-mobile-hub-launcher="true"]'),
          `${viewport.name} ${mode}: back to hub`,
        ).toBeVisible({ timeout: 15_000 });

        expect(
          consoleErrors,
          `${viewport.name} ${mode} ${moduleSpec.key}: console errors`,
        ).toEqual([]);
      });
    }
  }
}

for (const moduleSpec of STATUS_MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    });
    await setPopulatedAdminSession(page);
    await mockStatusApis(page);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    await expect(
      page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
      `${moduleSpec.key} desktop: horizontal nav visible`,
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-admin-mobile-bottom-nav="true"]'),
      `${moduleSpec.key} desktop: bottom nav absent`,
    ).toBeHidden();
    await expect(
      page.locator(`[data-admin-mobile-status-module="${moduleSpec.key}"]`),
      `${moduleSpec.key} desktop: mobile status module hidden`,
    ).toBeHidden();
    // Desktop keeps the workspace header (back button + structural divider) —
    // the mobile reclaim must not bleed into desktop.
    await expect(
      page.locator(
        `[data-dashboard-module-workspace="${moduleSpec.moduleId}"] .dashboard-workspace-header`,
      ),
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

test("Admin mobile Alertas chip paginates failed-login alerts by measured fit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setPopulatedAdminSession(page);
  await mockStatusApis(page);
  await page.goto("/dashboard/admin?module=admin");
  await suppressNextDevIndicator(page);

  const moduleRoot = page.locator('[data-admin-mobile-status-module="admin"]');
  await expect(moduleRoot).toBeVisible({ timeout: 15_000 });
  await moduleRoot.locator('[data-admin-mobile-status-chip="alertas"]').click();

  const panel = moduleRoot.locator('[data-admin-mobile-status-panel="alertas"]');
  const items = panel.locator('[data-admin-mobile-status-item="true"]');
  await expect(items.first()).toBeVisible({ timeout: 10_000 });

  // Cardinality is measured (Zero-Scroll adaptive), not a fixed 10. At
  // 390x844 the measured fit is strictly above the pre-measurement fallback
  // (the legacy fixed mobile page already fit 10 rows here), so waiting for
  // the count to settle past the fallback pins the settled adaptive state and
  // absorbs the measurement -> re-fetch transitions.
  let settledCount = -1;
  await expect(async () => {
    const current = await items.count();
    const stable = current === settledCount;
    settledCount = current;
    expect(current).toBeGreaterThan(FAILED_LOGIN_FALLBACK_ROWS);
    expect(stable).toBe(true);
  }).toPass({ timeout: 15_000, intervals: [400, 600, 800] });
  expect(settledCount).toBeLessThanOrEqual(FAILED_LOGIN_LIMIT_CAP);

  // Every rendered row fits the content band (no clipping under the pager).
  await expectInsideContentBand(
    page,
    items.last(),
    { name: "iphone-standard-390x844", width: 390, height: 844 },
    "alertas last item",
  );

  // With 40 mocked alerts a second page always exists for any measured fit.
  const pager = panel.getByRole("navigation", { name: "Paginación de intentos fallidos" });
  await expect(pager.getByText(/Pág\. 1 \/ \d+/)).toBeVisible();
  await pager.getByRole("button", { name: "Siguiente" }).click();

  await expect(pager.getByText(/Pág\. 2 \/ \d+/)).toBeVisible();
  await expect(items.first()).not.toContainText("#6100");
});
