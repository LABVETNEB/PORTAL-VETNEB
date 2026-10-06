import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { setAdminSession } from "../../helpers/session";

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
  // Persistent ancestors that survive the module swap. They must paint an
  // opaque background so the mobile GPU compositor cannot keep a recycled tile
  // from the previous module behind them (real-device ghosting / scanlines).
  frameBackgroundColor: string;
  frameBackdropFilter: string;
  mainBackgroundColor: string;
  hubRootBackgroundColor: string | null;
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
      '[data-dashboard-mobile-nav="admin"]',
    );
    const horizontalNav = document.querySelector<HTMLElement>(
      '[data-dashboard-horizontal-nav-shell="true"]',
    );
    const activeRegion = document.querySelector<HTMLElement>(selector);
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const frame = shell?.querySelector<HTMLElement>(
      ':scope > [data-vetneb-app-shell-frame="true"]',
    );
    // Hub root only exists while the Hub is mounted (absent inside a module).
    const hubRoot = document.querySelector<HTMLElement>(
      "[data-dashboard-hub-root]",
    );

    if (!topbar || !bottomNav || !activeRegion || !shell || !main || !frame) {
      throw new Error(`Admin layer contract is incomplete for ${selector}`);
    }

    const topbarStyle = window.getComputedStyle(topbar);
    const bottomNavStyle = window.getComputedStyle(bottomNav);
    const activeStyle = window.getComputedStyle(activeRegion);
    const shellStyle = window.getComputedStyle(shell);
    const mainStyle = window.getComputedStyle(main);
    const frameStyle = window.getComputedStyle(frame);
    const hubRootStyle = hubRoot ? window.getComputedStyle(hubRoot) : null;

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
      frameBackgroundColor: frameStyle.backgroundColor,
      frameBackdropFilter:
        frameStyle.getPropertyValue("backdrop-filter") || "none",
      mainBackgroundColor: mainStyle.backgroundColor,
      hubRootBackgroundColor: hubRootStyle
        ? hubRootStyle.backgroundColor
        : null,
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

    // Persistent ancestors of the active region must be opaque too: the leaf
    // surface being opaque is not enough if a transparent ancestor lets a
    // recycled GPU tile of the previous module show through.
    expect(
      readCssAlpha(contract.frameBackgroundColor),
      `${label}: app shell frame alpha`,
    ).toBe(1);
    expect(contract.frameBackdropFilter, `${label}: app shell frame blur`).toBe(
      "none",
    );
    expect(
      readCssAlpha(contract.mainBackgroundColor),
      `${label}: dashboard main alpha`,
    ).toBe(1);
    if (contract.hubRootBackgroundColor !== null) {
      expect(
        readCssAlpha(contract.hubRootBackgroundColor),
        `${label}: hub root alpha`,
      ).toBe(1);
    }

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

// Pre-C05 mobile space: the admin mobile Inicio (hub + its two launcher pages)
// is retired below 768px. The swaps these layers must survive are module ->
// module, through the bottom nav or the "Más" destination overflow; a hub
// request lands on the landing module.
async function openModule(
  page: Page,
  moduleId: string,
  viewportLabel: string,
) {
  const nav = page.locator('[data-dashboard-mobile-nav="admin"]').filter({ visible: true });
  const slot = nav.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`);
  const workspace = page.locator(
    `[data-dashboard-module-workspace="${moduleId}"]`,
  );

  // Hydration race: retry the activation until the workspace actually mounts.
  await expect(async () => {
    if ((await slot.count()) > 0) {
      await slot.click();
    } else {
      const overflow = page.locator('[data-dashboard-mobile-nav-overflow="true"]');
      if (!(await overflow.isVisible())) {
        await nav.locator('[data-dashboard-mobile-nav-item="overflow"]').click();
      }
      const link = overflow.locator(`[data-dashboard-mobile-nav-overflow-link="${moduleId}"]`);
      if ((await link.count()) === 0) {
        await overflow.locator('[data-dashboard-mobile-nav-overflow-page="next"]').click();
      }
      await link.click();
    }
    await expect(workspace).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
  await expectLayerContract(
    page,
    `[data-dashboard-module-workspace="${moduleId}"]`,
    `${viewportLabel} ${moduleId}`,
  );

  return workspace;
}

async function landOnRetiredHub(page: Page, viewportLabel: string) {
  await page.goto("/dashboard/admin?hub=1");
  await suppressNextDevIndicator(page);

  const landing = page.locator('[data-dashboard-module-workspace="admin"]');
  await expect(landing).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-admin-mobile-hub-launcher="true"]')).toBeHidden();
  await expectLayerContract(
    page,
    '[data-dashboard-module-workspace="admin"]',
    `${viewportLabel} landing module`,
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
    await setAdminSession(page, "populated");
    await mockAdminSessions(page);

    await landOnRetiredHub(page, viewport.name);

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
      sessionsWorkspace.locator(
        '[data-admin-mobile-ops-module="sessions"] [aria-label="Paginación de sesiones"]',
      ),
    ).toBeVisible();

    const auditWorkspace = await openModule(page, "audit-log", viewport.name);
    await expect(
      page.locator('button[aria-label^="Revocar sesión"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[aria-label="Paginación de sesiones"]'),
    ).toHaveCount(0);
    await expect(page.locator('[aria-label="Lista de sesiones"]')).toHaveCount(0);
    await expect(page.getByText(/Sesión #\d+/)).toHaveCount(0);
    await expect(
      auditWorkspace.locator('[data-admin-mobile-ops-module="audit"]'),
    ).toBeVisible();
    await expect(auditWorkspace.locator("#audit-log")).toBeVisible();

    const tokensWorkspace = await openModule(
      page,
      "admin-particular-tokens",
      viewport.name,
    );
    await expect(page.locator("#audit-log")).toHaveCount(0);
    await expect(
      page.locator('[data-admin-mobile-ops-module="audit"]'),
    ).toHaveCount(0);
    await expect(
      tokensWorkspace.locator('[data-admin-particulars-toolbar="true"]'),
    ).toBeVisible();
    await expect(
      tokensWorkspace.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      tokensWorkspace.getByRole("button", { name: "Actualizar", exact: true }),
    ).toBeVisible();

    await openModule(page, "admin-clinics", viewport.name);
    await expect(page.locator("#admin-particular-tokens")).toHaveCount(0);
    await expect(
      page.locator('[data-admin-particulars-toolbar="true"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toHaveCount(0);
  });
}

// ── PR-A: real-device opaque paint chain (light + dark) ──────────────────────
// Persistent ancestors (app-shell frame, dashboard-main, the module stage) must
// paint an opaque background, or the mobile GPU compositor can recycle a stale
// tile from the previous module behind them (ghosting / scanlines on real
// devices). With the mobile hub retired (pre-C05) the round trip is
// Tokens -> Clínicas through the bottom nav. Headless Chromium does not
// reproduce the GPU recycling itself, so the screenshots are structural; the
// opaque-ancestor invariant is the automated guard.
const SNAPSHOT_PHASE =
  process.env.PRA_SNAPSHOT_PHASE === "before" ? "before" : "after";

const PAINT_CHAIN_MATRIX = [
  { width: 360, height: 740, mode: "light" as const },
  { width: 360, height: 740, mode: "dark" as const },
  { width: 390, height: 844, mode: "light" as const },
  { width: 430, height: 932, mode: "light" as const },
];

async function applyColorMode(page: Page, mode: "light" | "dark") {
  if (mode === "dark") {
    // Mirror real persistence: theme-init.js reads this before first paint and
    // sets data-theme="dark-gray", which drives the dark token (--card) chain.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vetneb-theme-mode", "dark-gray");
      } catch {
        /* localStorage unavailable: emulateMedia below still hints dark */
      }
    });
  }
  await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
}

async function readModulePaintChain(page: Page) {
  return page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const frame = surface?.querySelector<HTMLElement>(
      ':scope > [data-vetneb-app-shell-frame="true"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const stage = document.querySelector<HTMLElement>(
      '[data-dashboard-module-stage="true"]',
    );
    const appBar = document.querySelector<HTMLElement>(
      '[data-admin-mobile-app-bar="true"]',
    );
    const bottomNav = document.querySelector<HTMLElement>(
      '[data-dashboard-mobile-nav="admin"]',
    );

    if (!surface || !frame || !main || !stage || !appBar || !bottomNav) {
      throw new Error("Admin mobile paint chain is incomplete on the module stage");
    }

    function describe(element: HTMLElement) {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        backdropFilter: style.getPropertyValue("backdrop-filter") || "none",
        opacity: style.opacity,
        overflowY: style.overflowY,
      };
    }

    return {
      workspaceCount: document.querySelectorAll(
        "[data-dashboard-module-workspace]",
      ).length,
      frame: describe(frame),
      main: describe(main),
      stage: describe(stage),
      appBar: describe(appBar),
      bottomNav: describe(bottomNav),
    };
  });
}

for (const cell of PAINT_CHAIN_MATRIX) {
  test(`admin mobile module stage keeps an opaque paint chain after tokens — ${cell.width}x${cell.height} ${cell.mode}`, async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: cell.width, height: cell.height });
    await applyColorMode(page, cell.mode);
    await setAdminSession(page, "populated");
    await mockAdminSessions(page);

    const label = `${cell.width}x${cell.height} ${cell.mode}`;
    await landOnRetiredHub(page, label);
    const tokensWorkspace = await openModule(page, "admin-particular-tokens", label);
    await expect(
      tokensWorkspace.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toBeVisible({ timeout: 15_000 });

    // Real SPA swap with NO stale module workspace left mounted.
    await openModule(page, "admin-clinics", label);
    await expect(
      page.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toHaveCount(0);

    const screenshotDirectory = resolve(
      testInfo.config.rootDir,
      "..",
      "test-results",
      "admin-mobile-real-device-layer-isolation",
    );
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: resolve(
        screenshotDirectory,
        `${SNAPSHOT_PHASE}-${cell.width}-${cell.mode}-clinics-after-tokens.png`,
      ),
      animations: "disabled",
      fullPage: false,
    });

    await expect(async () => {
      const chain = await readModulePaintChain(page);

      expect(chain.workspaceCount, `${label}: exactly one workspace mounted`).toBe(1);

      const opaqueNodes = {
        frame: chain.frame,
        main: chain.main,
        stage: chain.stage,
        appBar: chain.appBar,
        bottomNav: chain.bottomNav,
      };
      for (const [name, node] of Object.entries(opaqueNodes)) {
        expect(
          readCssAlpha(node.backgroundColor),
          `${label}: ${name} background alpha`,
        ).toBe(1);
        expect(node.backdropFilter, `${label}: ${name} backdrop-filter`).toBe(
          "none",
        );
        expect(Number(node.opacity), `${label}: ${name} opacity`).toBe(1);
      }

      // No scroll container introduced on the persistent shell ancestors.
      for (const [name, node] of Object.entries({
        frame: chain.frame,
        main: chain.main,
        stage: chain.stage,
      })) {
        expect(
          ["auto", "scroll"],
          `${label}: ${name} overflow-y must not be scrollable`,
        ).not.toContain(node.overflowY);
      }
    }).toPass({ timeout: 10_000 });
  });
}
