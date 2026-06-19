import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOLERANCE = 2;
const VERTICAL_TOLERANCE = 5;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_SESSIONS = [
  {
    sessionType: "clinic",
    sessionId: 7401,
    actorType: "clinic_user",
    actorId: 77,
    createdAt: "2026-06-18T10:00:00.000Z",
    lastAccess: "2026-06-19T12:00:00.000Z",
    expiresAt: "2026-06-26T12:00:00.000Z",
    status: "active",
  },
] as const;

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function mockAdminSessions(page: Page) {
  await page.route("**/api/admin/sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() !== "GET" || url.pathname !== "/api/admin/sessions") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "8");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const sessions = MOCK_SESSIONS.slice(offset, offset + limit);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        sessions,
        total: MOCK_SESSIONS.length,
        limit,
        offset,
        currentAdminSessionId: 9999,
        checkedBy: {
          adminUserId: 41,
          username: "admin_operaciones",
        },
      }),
    });
  });
}

function readCssAlpha(color: string) {
  const normalized = color.trim().toLowerCase();

  if (!normalized || normalized === "transparent") return 0;

  const commaAlpha = normalized.match(
    /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/,
  );
  if (commaAlpha) return Number(commaAlpha[1]);

  const slashAlpha = normalized.match(/\/\s*([\d.]+)(%)?\s*\)$/);
  if (slashAlpha) {
    const alpha = Number(slashAlpha[1]);
    return slashAlpha[2] ? alpha / 100 : alpha;
  }

  return 1;
}

type LayerContract = {
  topbarBackdropFilter: string;
  topbarBackgroundColor: string;
  bottomNavBackdropFilter: string;
  bottomNavBackgroundColor: string;
  horizontalNavVisible: boolean;
  activeIsolation: string;
  activeBackgroundColor: string;
  htmlOverflowX: number;
  bodyOverflowX: number;
  documentOverflowY: number;
  bodyOverflowY: number;
  mainOverflowY: number;
  shellOverflowYMode: string;
  mainOverflowYMode: string;
};

async function readLayerContract(
  page: Page,
  activeRegionSelector: string,
): Promise<LayerContract> {
  return page.evaluate((selector) => {
    const topbar = document.querySelector<HTMLElement>(
      '[data-dashboard-topbar-polish="true"]',
    );
    const bottomNav = document.querySelector<HTMLElement>(
      '[data-admin-mobile-bottom-nav="true"]',
    );
    const horizontalNav = document.querySelector<HTMLElement>(
      '[data-dashboard-horizontal-nav-shell="true"]',
    );
    const activeRegion = document.querySelector<HTMLElement>(selector);
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");

    if (!topbar || !bottomNav || !activeRegion || !shell || !main) {
      throw new Error(`Admin layer contract is incomplete for ${selector}`);
    }

    const topbarStyle = window.getComputedStyle(topbar);
    const bottomNavStyle = window.getComputedStyle(bottomNav);
    const activeStyle = window.getComputedStyle(activeRegion);
    const shellStyle = window.getComputedStyle(shell);
    const mainStyle = window.getComputedStyle(main);

    return {
      topbarBackdropFilter:
        topbarStyle.getPropertyValue("backdrop-filter") || "none",
      topbarBackgroundColor: topbarStyle.backgroundColor,
      bottomNavBackdropFilter:
        bottomNavStyle.getPropertyValue("backdrop-filter") || "none",
      bottomNavBackgroundColor: bottomNavStyle.backgroundColor,
      horizontalNavVisible: horizontalNav
        ? window.getComputedStyle(horizontalNav).display !== "none" &&
          horizontalNav.getBoundingClientRect().height > 1
        : false,
      activeIsolation: activeStyle.isolation,
      activeBackgroundColor: activeStyle.backgroundColor,
      htmlOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
      documentOverflowY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      bodyOverflowY: document.body.scrollHeight - document.body.clientHeight,
      mainOverflowY: main.scrollHeight - main.clientHeight,
      shellOverflowYMode: shellStyle.overflowY,
      mainOverflowYMode: mainStyle.overflowY,
    };
  }, activeRegionSelector);
}

async function expectLayerContract(
  page: Page,
  activeRegionSelector: string,
  label: string,
) {
  await expect(async () => {
    const contract = await readLayerContract(page, activeRegionSelector);

    expect(contract.topbarBackdropFilter, `${label}: topbar blur`).toBe("none");
    expect(readCssAlpha(contract.topbarBackgroundColor), `${label}: topbar alpha`).toBe(
      1,
    );
    expect(contract.bottomNavBackdropFilter, `${label}: bottom nav blur`).toBe(
      "none",
    );
    expect(
      readCssAlpha(contract.bottomNavBackgroundColor),
      `${label}: bottom nav alpha`,
    ).toBe(1);
    expect(contract.horizontalNavVisible, `${label}: legacy nav hidden`).toBe(
      false,
    );
    expect(contract.activeIsolation, `${label}: active region isolation`).toBe(
      "isolate",
    );
    expect(
      readCssAlpha(contract.activeBackgroundColor),
      `${label}: active region alpha`,
    ).toBe(1);

    expect(contract.htmlOverflowX, `${label}: document horizontal overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.bodyOverflowX, `${label}: body horizontal overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.documentOverflowY, `${label}: document vertical overflow`).toBeLessThanOrEqual(
      VERTICAL_TOLERANCE,
    );
    expect(contract.bodyOverflowY, `${label}: body vertical overflow`).toBeLessThanOrEqual(
      VERTICAL_TOLERANCE,
    );
    expect(contract.mainOverflowY, `${label}: main vertical overflow`).toBeLessThanOrEqual(
      VERTICAL_TOLERANCE,
    );
    expect(contract.shellOverflowYMode, `${label}: shell overflow mode`).toBe(
      "hidden",
    );
    expect(contract.mainOverflowYMode, `${label}: main overflow mode`).toBe(
      "hidden",
    );
  }).toPass({ timeout: 10_000 });
}

async function openModule(
  page: Page,
  moduleId: string,
  viewportLabel: string,
) {
  const launcher = page.locator('[data-admin-mobile-hub-launcher="true"]');
  const moduleTile = launcher.locator(`[data-admin-mobile-hub-tile="${moduleId}"]`);
  const workspace = page.locator(
    `[data-dashboard-module-workspace="${moduleId}"]`,
  );

  if ((await moduleTile.count()) === 0) {
    await launcher
      .locator('[data-admin-mobile-hub-pager="true"]')
      .getByRole("button", { name: "Siguiente", exact: true })
      .click();
  }

  await expect(moduleTile).toBeVisible();
  await moduleTile.click();
  await expect(workspace).toBeVisible({ timeout: 15_000 });
  await expectLayerContract(
    page,
    `[data-dashboard-module-workspace="${moduleId}"]`,
    `${viewportLabel} ${moduleId}`,
  );

  return workspace;
}

async function backToHub(page: Page, viewportLabel: string) {
  await page
    .locator('[data-admin-mobile-bottom-nav="true"]')
    .getByRole("button", { name: "Inicio", exact: true })
    .click();

  const hub = page.locator('[data-admin-mobile-hub-launcher="true"]');
  await expect(hub).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
  await expectLayerContract(
    page,
    '[data-admin-mobile-hub-launcher="true"]',
    `${viewportLabel} hub`,
  );
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`admin mobile modules keep isolated paint layers — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await setPopulatedAdminSession(page);
    await mockAdminSessions(page);

    await page.goto("/dashboard/admin");
    await suppressNextDevIndicator(page);

    const hub = page.locator('[data-admin-mobile-hub-launcher="true"]');
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await expectLayerContract(
      page,
      '[data-admin-mobile-hub-launcher="true"]',
      `${viewport.name} initial hub`,
    );

    const sessionsWorkspace = await openModule(
      page,
      "admin-sessions",
      viewport.name,
    );
    await expect(
      sessionsWorkspace.getByRole("button", {
        name: "Revocar sesión Clínica #7401",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      sessionsWorkspace.locator('[aria-label="Paginación de sesiones"]'),
    ).toBeVisible();

    await backToHub(page, viewport.name);
    await expect(
      page.locator('button[aria-label^="Revocar sesión"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[aria-label="Paginación de sesiones"]'),
    ).toHaveCount(0);
    await expect(page.locator('[aria-label="Lista de sesiones"]')).toHaveCount(0);
    await expect(page.getByText(/Sesión #\d+/)).toHaveCount(0);

    const auditWorkspace = await openModule(page, "audit-log", viewport.name);
    await expect(
      auditWorkspace.getByRole("heading", { name: "Registro operativo" }),
    ).toBeVisible();
    await expect(auditWorkspace.locator("#audit-log")).toBeVisible();

    await backToHub(page, viewport.name);
    await expect(page.locator("#audit-log")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Registro operativo" }),
    ).toHaveCount(0);

    const tokensWorkspace = await openModule(
      page,
      "admin-particular-tokens",
      viewport.name,
    );
    await expect(
      tokensWorkspace.locator('[data-admin-particulars-toolbar="true"]'),
    ).toBeVisible();
    await expect(
      tokensWorkspace.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      tokensWorkspace.getByRole("button", { name: "Actualizar", exact: true }),
    ).toBeVisible();

    await backToHub(page, viewport.name);
    await expect(page.locator("#admin-particular-tokens")).toHaveCount(0);
    await expect(
      page.locator('[data-admin-particulars-toolbar="true"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toHaveCount(0);
  });
}
