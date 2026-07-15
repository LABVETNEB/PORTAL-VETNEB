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
  fulfillJson,
  setPopulatedAdminSession,
  suppressNextDevIndicator,
} from "../../helpers/admin-mobile-contracts";

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const DESKTOP_VIEWPORT = {
  name: "desktop-1280x800",
  width: 1280,
  height: 800,
} as const;

const MOCK_CLINICS = Array.from({ length: 9 }, (_, index) => {
  const id = index + 1;
  return {
    clinicId: id,
    clinicName: `Clínica Final ${id}`,
    contactEmail: `clinica.final.${id}@example.test`,
    contactPhone: `+54 11 5555-${String(id).padStart(4, "0")}`,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: `2026-06-${String(id).padStart(2, "0")}T12:00:00.000Z`,
    users: [
      {
        userId: 100 + id,
        username: `final-owner-${id}`,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
});

const MOCK_SESSIONS = Array.from({ length: 9 }, (_, index) => ({
  sessionType: (["admin", "clinic", "particular"] as const)[index % 3],
  sessionId: 8200 + index,
  actorType: (["admin_user", "clinic_user", "particular_token"] as const)[
    index % 3
  ],
  actorId: 410 + index,
  createdAt: "2026-06-15T09:00:00.000Z",
  lastAccess: "2026-06-19T18:45:00.000Z",
  expiresAt: "2026-06-30T09:00:00.000Z",
  status: index % 4 === 0 ? ("expired" as const) : ("active" as const),
}));

type Viewport = {
  name: string;
  width: number;
  height: number;
};

type AdminModuleScreen = {
  key: "clinics" | "reports" | "tokens" | "audit" | "sessions" | "users";
  moduleId:
    | "admin-clinics"
    | "admin-report-upload"
    | "admin-particular-tokens"
    | "audit-log"
    | "admin-sessions"
    | "admin-users-roles";
  mobileRoot: string;
  itemSelector: string;
  pagerSelector: string;
  desktopReady: string | RegExp;
};

const MODULE_SCREENS: AdminModuleScreen[] = [
  {
    key: "clinics",
    moduleId: "admin-clinics",
    mobileRoot: '[data-admin-mobile-core-module="clinics"]',
    itemSelector: '[data-admin-mobile-core-item="true"]',
    pagerSelector: '[data-admin-mobile-core-pager="true"]',
    desktopReady: "Clínica Final 1",
  },
  {
    key: "reports",
    moduleId: "admin-report-upload",
    mobileRoot: '[data-admin-mobile-core-module="reports"]',
    itemSelector: '[data-admin-mobile-core-item="true"]',
    pagerSelector: '[data-admin-mobile-core-pager="true"]',
    desktopReady: "#7301",
  },
  {
    key: "tokens",
    moduleId: "admin-particular-tokens",
    mobileRoot: '[data-admin-mobile-core-module="tokens"]',
    itemSelector: '[data-admin-mobile-core-item="true"]',
    pagerSelector: '[data-admin-mobile-core-pager="true"]',
    desktopReady: "****4201",
  },
  {
    key: "audit",
    moduleId: "audit-log",
    mobileRoot: '[data-admin-mobile-ops-module="audit"]',
    itemSelector: '[data-admin-mobile-ops-item="true"]',
    pagerSelector: 'nav[aria-label="Paginación de auditoría"]',
    desktopReady: "Login admin",
  },
  {
    key: "sessions",
    moduleId: "admin-sessions",
    mobileRoot: '[data-admin-mobile-ops-module="sessions"]',
    itemSelector: '[data-admin-mobile-ops-item="true"]',
    pagerSelector: 'nav[aria-label="Paginación de sesiones"]',
    desktopReady: "#8200",
  },
  {
    key: "users",
    moduleId: "admin-users-roles",
    mobileRoot: '[data-admin-mobile-ops-module="users"]',
    itemSelector: '[data-admin-mobile-ops-item="true"]',
    pagerSelector: 'nav[aria-label="Paginación de usuarios"]',
    desktopReady: "admin_operaciones",
  },
];

async function mockMissingPopulatedApis(page: Page) {
  await page.route("**/api/admin/clinics**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/clinics") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      clinics: MOCK_CLINICS.slice(offset, offset + limit),
      total: MOCK_CLINICS.length,
      limit,
      offset,
    });
  });

  await page.route("**/api/admin/sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/sessions") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "8");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      sessions: MOCK_SESSIONS.slice(offset, offset + limit),
      total: MOCK_SESSIONS.length,
      limit,
      offset,
      currentAdminSessionId: 8200,
    });
  });
}

async function preparePage(page: Page, viewport: Viewport, path: string) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(path);
  await suppressNextDevIndicator(page);
}

async function captureScreen(
  page: Page,
  testInfo: TestInfo,
  viewportName: string,
  screenName: string,
) {
  const screenshotDirectory = resolve(
    testInfo.config.rootDir,
    "..",
    "test-results",
    "admin-mobile-final-polish-no-scroll",
  );
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, `${viewportName}--${screenName}.png`),
    animations: "disabled",
    fullPage: false,
  });
}

type SurfaceContract = {
  metrics: Array<{
    label: string;
    scrollHeight: number;
    clientHeight: number;
    scrollWidth: number;
    clientWidth: number;
  }>;
  forbiddenOverflow: Array<{
    tag: string;
    className: string;
    overflowX: string;
    overflowY: string;
  }>;
};

async function readSurfaceContract(
  page: Page,
  activeSelector: string,
  includeDescendants = true,
): Promise<SurfaceContract> {
  return page.evaluate(({ selector, includeActiveDescendants }) => {
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const activeRoot = document.querySelector<HTMLElement>(selector);

    if (!shell || !main || !activeRoot) {
      throw new Error(`Admin final polish contract is incomplete for ${selector}`);
    }

    const roots: Array<{ label: string; element: HTMLElement }> = [
      { label: "html", element: document.documentElement },
      { label: "body", element: document.body },
      { label: "shell", element: shell },
      { label: "main", element: main },
      { label: "active", element: activeRoot },
    ];
    const overflowCandidates = [
      shell,
      main,
      activeRoot,
      ...(includeActiveDescendants
        ? Array.from(activeRoot.querySelectorAll<HTMLElement>("*"))
        : []),
    ];

    return {
      metrics: roots.map(({ label, element }) => ({
        label,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
      forbiddenOverflow: overflowCandidates.flatMap((element) => {
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
      }),
    };
  }, { selector: activeSelector, includeActiveDescendants: includeDescendants });
}

function assertSurfaceContract(contract: SurfaceContract, label: string) {
  for (const metrics of contract.metrics) {
    expect(
      metrics.scrollHeight,
      `${label}: ${metrics.label} vertical overflow or clipping`,
    ).toBeLessThanOrEqual(metrics.clientHeight + TOLERANCE);
    expect(
      metrics.scrollWidth,
      `${label}: ${metrics.label} horizontal overflow or clipping`,
    ).toBeLessThanOrEqual(metrics.clientWidth + TOLERANCE);
  }

  expect(contract.forbiddenOverflow, `${label}: overflow auto/scroll`).toEqual([]);
}

async function expectInsideViewport(
  locator: Locator,
  viewport: Viewport,
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.x, `${label}: left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.y, `${label}: top edge`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right edge`).toBeLessThanOrEqual(
    viewport.width + TOLERANCE,
  );
  expect(box!.y + box!.height, `${label}: bottom edge`).toBeLessThanOrEqual(
    viewport.height + TOLERANCE,
  );
}

async function expectInsideMobileContentBand(
  page: Page,
  locator: Locator,
  viewport: Viewport,
  label: string,
) {
  await expectInsideViewport(locator, viewport, label);

  const [appBarBox, bottomNavBox, elementBox] = await Promise.all([
    page.locator('[data-admin-mobile-app-bar="true"]').boundingBox(),
    page.locator('[data-admin-mobile-bottom-nav="true"]').boundingBox(),
    locator.boundingBox(),
  ]);

  expect(appBarBox, `${label}: app bar bounding box`).not.toBeNull();
  expect(bottomNavBox, `${label}: bottom nav bounding box`).not.toBeNull();
  expect(elementBox, `${label}: element bounding box`).not.toBeNull();
  expect(elementBox!.y, `${label}: below app bar`).toBeGreaterThanOrEqual(
    appBarBox!.y + appBarBox!.height - TOLERANCE,
  );
  expect(elementBox!.y + elementBox!.height, `${label}: above bottom nav`).toBeLessThanOrEqual(
    bottomNavBox!.y + TOLERANCE,
  );
}

async function expectNotClippedByAncestors(locator: Locator, label: string) {
  const violations = await locator.evaluate((element, tolerance) => {
    const elementRect = element.getBoundingClientRect();
    const clippedBy: Array<{
      tag: string;
      className: string;
      overflowX: string;
      overflowY: string;
    }> = [];
    let ancestor = element.parentElement;

    while (ancestor && ancestor !== document.body) {
      const style = window.getComputedStyle(ancestor);
      const clipsX = ["auto", "clip", "hidden", "scroll"].includes(style.overflowX);
      const clipsY = ["auto", "clip", "hidden", "scroll"].includes(style.overflowY);

      if (clipsX || clipsY) {
        const ancestorRect = ancestor.getBoundingClientRect();
        const clippedHorizontally =
          clipsX &&
          (elementRect.left < ancestorRect.left - tolerance ||
            elementRect.right > ancestorRect.right + tolerance);
        const clippedVertically =
          clipsY &&
          (elementRect.top < ancestorRect.top - tolerance ||
            elementRect.bottom > ancestorRect.bottom + tolerance);

        if (clippedHorizontally || clippedVertically) {
          clippedBy.push({
            tag: ancestor.tagName,
            className: ancestor.className,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
          });
        }
      }

      ancestor = ancestor.parentElement;
    }

    return clippedBy;
  }, TOLERANCE);

  expect(violations, `${label}: clipped by ancestor`).toEqual([]);
}

async function expectMobileChrome(page: Page, viewport: Viewport, label: string) {
  const appBar = page.locator('[data-admin-mobile-app-bar="true"]');
  const bottomNav = page.locator('[data-admin-mobile-bottom-nav="true"]');
  const horizontalNav = page.locator('[data-dashboard-horizontal-nav-shell="true"]');

  await expectInsideViewport(appBar, viewport, `${label}: app bar`);
  await expectInsideViewport(bottomNav, viewport, `${label}: bottom nav`);
  await expect(horizontalNav, `${label}: desktop nav absent`).toBeHidden();

  const navItems = bottomNav.locator('[data-admin-mobile-bottom-nav-item="true"]');
  await expect(navItems).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expectInsideViewport(
      navItems.nth(index),
      viewport,
      `${label}: bottom nav item ${index + 1}`,
    );
  }
}

async function auditMobileSurface(
  page: Page,
  viewport: Viewport,
  activeSelector: string,
  label: string,
) {
  await expectMobileChrome(page, viewport, label);
  const activeRoot = page.locator(activeSelector);
  await expectInsideMobileContentBand(page, activeRoot, viewport, `${label}: active surface`);
  assertSurfaceContract(await readSurfaceContract(page, activeSelector), label);
}

async function auditModuleItems(
  page: Page,
  viewport: Viewport,
  moduleScreen: AdminModuleScreen,
) {
  const moduleRoot = page.locator(moduleScreen.mobileRoot);
  const items = moduleRoot.locator(moduleScreen.itemSelector);
  const pager = moduleRoot.locator(moduleScreen.pagerSelector);
  await expect(items.first(), `${viewport.name} ${moduleScreen.key}: populated items`).toBeVisible({
    timeout: 15_000,
  });

  // Adaptive server-side lists (audit/sessions/users) can re-fetch once the
  // real row height settles, changing the rendered item count after the
  // first paint. Wait for two consecutive stable reads before asserting
  // geometry, so this never races that re-fetch/remount.
  await expect
    .poll(async () => items.count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
  let settledSignature = "";
  let settledCount = 0;
  await expect(async () => {
    const current = await items.count();
    const pagerText = (await pager.textContent()) ?? "";
    const pagerRange = pagerText.match(/1\s*[–-]\s*(\d+)\s+de/i);
    const pagerVisibleCount = pagerRange ? Number(pagerRange[1]) : current;
    expect(
      current,
      `${viewport.name} ${moduleScreen.key}: visible item count`,
    ).toBeGreaterThan(0);
    expect(
      current,
      `${viewport.name} ${moduleScreen.key}: item count matches pager range`,
    ).toBe(pagerVisibleCount);

    const signature = `${current}:${pagerText}`;
    if (settledSignature !== signature) {
      settledSignature = signature;
      settledCount = current;
      throw new Error(`${moduleScreen.key} item count not yet stable: ${signature}`);
    }
  }).toPass({ intervals: [250, 350, 500, 750, 1_000], timeout: 15_000 });

  expect(settledCount, `${viewport.name} ${moduleScreen.key}: populated item count`).toBeGreaterThan(0);
  for (let index = 0; index < await items.count(); index += 1) {
    await expectInsideMobileContentBand(
      page,
      items.nth(index),
      viewport,
      `${viewport.name} ${moduleScreen.key}: item ${index + 1}`,
    );
    await expectNotClippedByAncestors(
      items.nth(index),
      `${viewport.name} ${moduleScreen.key}: item ${index + 1}`,
    );
  }

  await expectInsideMobileContentBand(
    page,
    pager,
    viewport,
    `${viewport.name} ${moduleScreen.key}: pager`,
  );
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`Admin mobile final polish closeout at ${viewport.name}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await setPopulatedAdminSession(page);
    await mockMissingPopulatedApis(page);
    await preparePage(page, viewport, "/dashboard/admin");

    const launcher = page.locator('[data-admin-mobile-hub-launcher="true"]');
    await expect(launcher).toBeVisible({ timeout: 15_000 });
    await auditMobileSurface(
      page,
      viewport,
      '[data-admin-mobile-hub-launcher="true"]',
      `${viewport.name} launcher page 1`,
    );

    const launcherItems = launcher.locator('[data-admin-mobile-hub-tile]');
    const launcherItemCount = await launcherItems.count();
    expect(launcherItemCount).toBeGreaterThan(0);
    for (let index = 0; index < launcherItemCount; index += 1) {
      await expectInsideMobileContentBand(
        page,
        launcherItems.nth(index),
        viewport,
        `${viewport.name} launcher page 1 tile ${index + 1}`,
      );
    }

    const hubPager = launcher.locator('[data-admin-mobile-hub-pager="true"]');
    await expectInsideMobileContentBand(
      page,
      hubPager,
      viewport,
      `${viewport.name} launcher pager`,
    );
    await captureScreen(page, testInfo, viewport.name, "launcher-page-1");

    await hubPager.getByRole("button", { name: "Siguiente", exact: true }).click();
    await auditMobileSurface(
      page,
      viewport,
      '[data-admin-mobile-hub-launcher="true"]',
      `${viewport.name} launcher page 2`,
    );
    await captureScreen(page, testInfo, viewport.name, "launcher-page-2");

    const bottomNav = page.locator('[data-admin-mobile-bottom-nav="true"]');
    await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
    const moduleMenu = page.locator('[data-admin-mobile-module-menu="true"]');
    await expectInsideViewport(moduleMenu, viewport, `${viewport.name} Más menu`);
    assertSurfaceContract(
      await readSurfaceContract(page, '[data-admin-mobile-module-menu="true"]'),
      `${viewport.name} Más menu`,
    );
    const moduleLinks = moduleMenu.locator('[data-admin-mobile-module-link="true"]');
    const moduleLinkCount = await moduleLinks.count();
    expect(moduleLinkCount).toBeGreaterThan(0);
    for (let index = 0; index < moduleLinkCount; index += 1) {
      await expectInsideViewport(
        moduleLinks.nth(index),
        viewport,
        `${viewport.name} Más menu item ${index + 1}`,
      );
    }
    await captureScreen(page, testInfo, viewport.name, "more-menu");
    await moduleMenu.getByRole("button", { name: "Cerrar menú de módulos", exact: true }).click();

    await page.getByRole("button", { name: "Menú de administración", exact: true }).click();
    const kebabMenu = page.locator('[data-admin-mobile-kebab-menu="true"]');
    await expectInsideViewport(kebabMenu, viewport, `${viewport.name} administration menu`);
    assertSurfaceContract(
      await readSurfaceContract(page, '[data-admin-mobile-kebab-menu="true"]'),
      `${viewport.name} administration menu`,
    );
    await captureScreen(page, testInfo, viewport.name, "administration-menu");

    await kebabMenu.getByRole("button", { name: "Notificaciones", exact: true }).click();
    const notificationsPanel = page.locator('[data-admin-mobile-notifications-panel="true"]');
    await expectInsideViewport(notificationsPanel, viewport, `${viewport.name} notifications`);
    await expect(
      notificationsPanel.getByRole("button", { name: "Actualizar", exact: true }),
    ).toBeEnabled({ timeout: 15_000 });
    assertSurfaceContract(
      await readSurfaceContract(page, '[data-admin-mobile-notifications-panel="true"]'),
      `${viewport.name} notifications`,
    );
    await captureScreen(page, testInfo, viewport.name, "notifications");
    await notificationsPanel
      .getByRole("button", { name: "Cerrar panel de notificaciones", exact: true })
      .click();
    await page.keyboard.press("Escape");

    for (const moduleScreen of MODULE_SCREENS) {
      await preparePage(
        page,
        viewport,
        `/dashboard/admin?module=${moduleScreen.moduleId}`,
      );
      const workspace = page.locator(
        `[data-dashboard-module-workspace="${moduleScreen.moduleId}"]`,
      );
      await expect(workspace, `${viewport.name} ${moduleScreen.key}: workspace`).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator(moduleScreen.mobileRoot)).toBeVisible({ timeout: 15_000 });
      await auditMobileSurface(
        page,
        viewport,
        moduleScreen.mobileRoot,
        `${viewport.name} ${moduleScreen.key}`,
      );
      await captureScreen(page, testInfo, viewport.name, moduleScreen.key);
      await auditModuleItems(page, viewport, moduleScreen);
    }
  });
}

test("Admin desktop final polish smoke at 1280x800", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await setPopulatedAdminSession(page);
  await mockMissingPopulatedApis(page);
  await preparePage(page, DESKTOP_VIEWPORT, "/dashboard/admin");

  const horizontalNav = page.locator('[data-dashboard-horizontal-nav-shell="true"]');
  await expect(horizontalNav).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toBeHidden();
  await expect(page.locator('[data-admin-mobile-hub-launcher="true"]')).toBeHidden();
  const desktopHub = page.locator('[data-dashboard-module-hub="true"]');
  await expect(desktopHub).toBeVisible();
  await expectInsideViewport(desktopHub, DESKTOP_VIEWPORT, "desktop launcher");
  assertSurfaceContract(
    await readSurfaceContract(page, '[data-dashboard-module-hub="true"]'),
    "desktop launcher",
  );
  await captureScreen(page, testInfo, DESKTOP_VIEWPORT.name, "launcher");

  for (const moduleScreen of MODULE_SCREENS) {
    await preparePage(
      page,
      DESKTOP_VIEWPORT,
      `/dashboard/admin?module=${moduleScreen.moduleId}`,
    );
    await expect(horizontalNav).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toBeHidden();
    await expect(page.locator(moduleScreen.mobileRoot)).toBeHidden();

    const workspaceSelector = `[data-dashboard-module-workspace="${moduleScreen.moduleId}"]`;
    const workspace = page.locator(workspaceSelector);
    await expect(workspace, `desktop ${moduleScreen.key}: workspace`).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      workspace.getByText(moduleScreen.desktopReady).filter({ visible: true }).first(),
      `desktop ${moduleScreen.key}: populated content`,
    ).toBeVisible({ timeout: 15_000 });
    await expectInsideViewport(workspace, DESKTOP_VIEWPORT, `desktop ${moduleScreen.key}`);
    assertSurfaceContract(
      await readSurfaceContract(page, workspaceSelector, false),
      `desktop ${moduleScreen.key}`,
    );
    await captureScreen(page, testInfo, DESKTOP_VIEWPORT.name, moduleScreen.key);
  }
});
