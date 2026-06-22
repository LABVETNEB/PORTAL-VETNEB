import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";

// PR-B — Admin mobile STATUS modules (Administración/Resumen + Estado del
// sistema). These two modules still rendered the desktop ModuleTabs/grids on
// mobile, collapsing to a single column whose last cards fell under the bottom
// nav (P1 no-scroll defect). This spec pins a dedicated mobile variant
// (`[data-admin-mobile-status-module]`) that fits 360/390/430 in light + dark
// with zero scroll, zero overflow auto/scroll, and nothing under the bottom nav.

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const COLOR_MODES = ["light", "dark"] as const;

const DESKTOP_VIEWPORT = {
  name: "desktop-1280x800",
  width: 1280,
  height: 800,
} as const;

type ColorMode = (typeof COLOR_MODES)[number];
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

const MOCK_FAILED_LOGIN_ALERTS = Array.from({ length: 8 }, (_, index) => ({
  id: 6100 + index,
  surface: (["admin", "clinic", "particular"] as const)[index % 3],
  username: index % 4 === 0 ? null : `intento_${index}`,
  reason: (
    ["invalid_credentials", "missing_credentials", "rate_limited"] as const
  )[index % 3],
  ipAddress: `203.0.113.${10 + index}`,
  userAgent: "Mozilla/5.0 (e2e-status-module)",
  createdAt: `2026-06-${String(10 + index).padStart(2, "0")}T09:30:00.000Z`,
}));

const STATUS_SNAPSHOT_PHASE =
  process.env.STATUS_SNAPSHOT_PHASE === "before" ? "before" : "after";

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

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
    const limit = Number(url.searchParams.get("limit") ?? "3");
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

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function applyColorMode(page: Page, mode: ColorMode) {
  if (mode === "dark") {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vetneb-theme-mode", "dark-gray");
      } catch {
        /* localStorage unavailable: emulateMedia still hints dark */
      }
    });
  }
  await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
}

type NoScrollContract = {
  html: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  body: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  module: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  forbiddenOverflow: Array<{
    tag: string;
    className: string;
    overflowX: string;
    overflowY: string;
  }>;
};

async function readNoScrollContract(
  page: Page,
  selector: string,
): Promise<NoScrollContract> {
  return page.evaluate((moduleSelector) => {
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const moduleRoot = document.querySelector<HTMLElement>(moduleSelector);

    if (!moduleRoot) throw new Error(`Missing module root: ${moduleSelector}`);

    const candidates = [
      document.documentElement,
      document.body,
      ...(shell ? [shell] : []),
      ...(main ? [main] : []),
      moduleRoot,
      ...Array.from(moduleRoot.querySelectorAll<HTMLElement>("*")),
    ];

    const forbiddenOverflow = candidates.flatMap((element) => {
      const style = window.getComputedStyle(element);
      if (
        !["auto", "scroll"].includes(style.overflowX) &&
        !["auto", "scroll"].includes(style.overflowY)
      ) {
        return [];
      }
      return [
        {
          tag: element.tagName,
          className: element.className,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        },
      ];
    });

    const metrics = (element: HTMLElement) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    });

    return {
      html: metrics(document.documentElement),
      body: metrics(document.body),
      module: metrics(moduleRoot),
      forbiddenOverflow,
    };
  }, selector);
}

function assertNoScrollContract(contract: NoScrollContract, label: string) {
  for (const [surface, metrics] of Object.entries({
    html: contract.html,
    body: contract.body,
    module: contract.module,
  })) {
    expect(
      metrics.scrollHeight,
      `${label}: ${surface} vertical clipping/overflow`,
    ).toBeLessThanOrEqual(metrics.clientHeight + TOLERANCE);
    expect(
      metrics.scrollWidth,
      `${label}: ${surface} horizontal clipping/overflow`,
    ).toBeLessThanOrEqual(metrics.clientWidth + TOLERANCE);
  }

  expect(contract.forbiddenOverflow, `${label}: overflow auto/scroll`).toEqual([]);
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
        const shortViewport = String(viewport.width);
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

        // Every section chip must be reachable, fit the content band and keep
        // the no-scroll contract — no section may fall under the bottom nav.
        const chips = moduleRoot.locator("[data-admin-mobile-status-chip]");
        const chipCount = await chips.count();
        expect(
          chipCount,
          `${viewport.name} ${mode} ${moduleSpec.key}: section chips`,
        ).toBeGreaterThan(1);

        for (let index = 0; index < chipCount; index += 1) {
          const chip = chips.nth(index);
          await expectInsideContentBand(
            page,
            chip,
            viewport,
            `${viewport.name} ${mode} ${moduleSpec.key} chip ${index + 1}`,
          );
          await chip.click();

          const panel = moduleRoot.locator(
            "[data-admin-mobile-status-panel]",
          );
          await expect(
            panel,
            `${viewport.name} ${mode} ${moduleSpec.key} panel ${index + 1}`,
          ).toBeVisible();
          await expectInsideContentBand(
            page,
            panel,
            viewport,
            `${viewport.name} ${mode} ${moduleSpec.key} panel ${index + 1}`,
          );
          assertNoScrollContract(
            await readNoScrollContract(page, moduleSelector),
            `${viewport.name} ${mode} ${moduleSpec.key} section ${index + 1}`,
          );
        }

        // No console errors during the whole interaction.
        const consoleErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });

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
