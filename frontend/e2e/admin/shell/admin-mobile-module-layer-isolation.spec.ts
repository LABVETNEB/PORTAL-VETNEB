import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

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
  // Persistent ancestors that survive the Hub<->module swap. They must paint an
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
    .locator('[data-dashboard-mobile-nav="admin"]')
    .filter({ visible: true })
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

    await page.goto("/dashboard/admin?hub=1");
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
      sessionsWorkspace.locator(
        '[data-admin-mobile-ops-module="sessions"] [aria-label="Paginación de sesiones"]',
      ),
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
      auditWorkspace.locator('[data-admin-mobile-ops-module="audit"]'),
    ).toBeVisible();
    await expect(auditWorkspace.locator("#audit-log")).toBeVisible();

    await backToHub(page, viewport.name);
    await expect(page.locator("#audit-log")).toHaveCount(0);
    await expect(
      page.locator('[data-admin-mobile-ops-module="audit"]'),
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

// ── PR-A: real-device opaque paint chain (light + dark) ──────────────────────
// The hub leaf surface and active workspace were already opaque, but their
// persistent ancestors (app-shell frame, dashboard-main, hub root) painted no
// background, letting the mobile GPU compositor recycle a stale tile from the
// previous module behind them (ghosting / scanlines on real devices). This
// guards the full opaque paint chain after a real Hub→Tokens→Hub round trip in
// both light and dark, and emits structural before/after screenshots. Headless
// Chromium does not reproduce the GPU recycling itself, so the screenshots are
// structural; the opaque-ancestor invariant is the automated guard.
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

async function openTokensFromHub(page: Page) {
  const launcher = page.locator('[data-admin-mobile-hub-launcher="true"]');
  const tile = launcher.locator(
    '[data-admin-mobile-hub-tile="admin-particular-tokens"]',
  );
  if ((await tile.count()) === 0) {
    await launcher
      .locator('[data-admin-mobile-hub-pager="true"]')
      .getByRole("button", { name: "Siguiente", exact: true })
      .click();
  }
  await expect(tile).toBeVisible();
  const workspace = page.locator(
    '[data-dashboard-module-workspace="admin-particular-tokens"]',
  );
  // Hydration race: re-click the tile until the workspace actually mounts.
  await expect(async () => {
    await tile.click();
    await expect(workspace).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
  await expect(
    workspace.locator('[data-admin-particulars-mobile-list="true"]'),
  ).toBeVisible({ timeout: 15_000 });
}

async function readHubPaintChain(page: Page) {
  return page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const frame = surface?.querySelector<HTMLElement>(
      ':scope > [data-vetneb-app-shell-frame="true"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const hubRoot = document.querySelector<HTMLElement>(
      "[data-dashboard-hub-root]",
    );
    const launcher = document.querySelector<HTMLElement>(
      '[data-admin-mobile-hub-launcher="true"]',
    );
    const appBar = document.querySelector<HTMLElement>(
      '[data-admin-mobile-app-bar="true"]',
    );
    const bottomNav = document.querySelector<HTMLElement>(
      '[data-dashboard-mobile-nav="admin"]',
    );

    if (
      !surface ||
      !frame ||
      !main ||
      !hubRoot ||
      !launcher ||
      !appBar ||
      !bottomNav
    ) {
      throw new Error("Admin mobile paint chain is incomplete on the hub");
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
      hubRoot: describe(hubRoot),
      launcher: describe(launcher),
      appBar: describe(appBar),
      bottomNav: describe(bottomNav),
    };
  });
}

for (const cell of PAINT_CHAIN_MATRIX) {
  test(`admin mobile hub keeps an opaque paint chain after tokens — ${cell.width}x${cell.height} ${cell.mode}`, async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: cell.width, height: cell.height });
    await applyColorMode(page, cell.mode);
    await setPopulatedAdminSession(page);
    await mockAdminSessions(page);

    await page.goto("/dashboard/admin?hub=1");
    await suppressNextDevIndicator(page);

    const hub = page.locator('[data-admin-mobile-hub-launcher="true"]');
    await expect(hub).toBeVisible({ timeout: 15_000 });

    await openTokensFromHub(page);

    // Real SPA round trip: tapping the bottom-nav "Inicio" must return the
    // controller to the hub with NO stale module workspace left mounted. This
    // guards the bottom-nav/controller restore-last-module desync directly,
    // with no hard reload / localStorage workaround.
    await page
      .locator('[data-dashboard-mobile-nav="admin"]')
      .filter({ visible: true })
      .getByRole("button", { name: "Inicio", exact: true })
      .click();
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(
      0,
    );
    await expect(
      page.locator('[data-admin-particulars-mobile-list="true"]'),
    ).toHaveCount(0);

    // Structural screenshot first, so the red (pre-fix) run still emits
    // before-* evidence even though the assertions below fail.
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
        `${SNAPSHOT_PHASE}-${cell.width}-${cell.mode}-hub-after-tokens.png`,
      ),
      animations: "disabled",
      fullPage: false,
    });

    // Opaque paint-chain invariant: every persistent ancestor must paint an
    // opaque background (alpha 1, opacity 1, no backdrop-filter) so no recycled
    // GPU tile can show through. FAILS before the fix (frame/main/hub-root are
    // transparent); PASSES after.
    await expect(async () => {
      const chain = await readHubPaintChain(page);
      const label = `${cell.width}x${cell.height} ${cell.mode}`;

      expect(chain.workspaceCount, `${label}: stale workspace mounted`).toBe(0);

      const opaqueNodes = {
        frame: chain.frame,
        main: chain.main,
        hubRoot: chain.hubRoot,
        launcher: chain.launcher,
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

      // No scroll container introduced on the persistent shell ancestors:
      // overflow may be hidden/clip/visible, but never a scrollable auto/scroll.
      for (const [name, node] of Object.entries({
        frame: chain.frame,
        main: chain.main,
        hubRoot: chain.hubRoot,
        launcher: chain.launcher,
      })) {
        expect(
          ["auto", "scroll"],
          `${label}: ${name} overflow-y must not be scrollable`,
        ).not.toContain(node.overflowY);
      }
    }).toPass({ timeout: 10_000 });
  });
}
