import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 1;

const MOBILE_VIEWPORTS = [
  { name: "android-short-360x640", width: 360, height: 640 },
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const LANDSCAPE_DIAGNOSTIC_VIEWPORT = {
  name: "landscape-diagnostic-740x360",
  width: 740,
  height: 360,
} as const;

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
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

type ShellContract = {
  html: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  body: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  shellOverflowX: string;
  shellOverflowY: string;
  mainOverflowX: string;
  mainOverflowY: string;
  appBarHeight: number;
  appBarBackdropFilter: string;
  appBarBackgroundColor: string;
  shellIsolation: string;
  mainIsolation: string;
  forbiddenChromeOverflow: Array<{ selector: string; overflowX: string; overflowY: string }>;
};

async function readShellContract(page: Page): Promise<ShellContract> {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const appBar = document.querySelector<HTMLElement>(
      '[data-admin-mobile-app-bar="true"]',
    );

    if (!shell || !main || !appBar) {
      throw new Error("Admin mobile app shell contract is incomplete");
    }

    const shellStyle = window.getComputedStyle(shell);
    const mainStyle = window.getComputedStyle(main);
    const appBarStyle = window.getComputedStyle(appBar);
    const selectors = [
      '[data-admin-mobile-app-bar="true"]',
      '[data-admin-mobile-kebab-menu="true"]',
      '[data-dashboard-mobile-nav="admin"]',
      '[data-dashboard-mobile-nav-overflow="true"]',
    ];
    const forbiddenChromeOverflow = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
        const style = window.getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowX) ||
          ["auto", "scroll"].includes(style.overflowY)
          ? [{ selector, overflowX: style.overflowX, overflowY: style.overflowY }]
          : [];
      }),
    );

    return {
      html: {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      body: {
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
      },
      shellOverflowX: shellStyle.overflowX,
      shellOverflowY: shellStyle.overflowY,
      mainOverflowX: mainStyle.overflowX,
      mainOverflowY: mainStyle.overflowY,
      appBarHeight: appBar.getBoundingClientRect().height,
      appBarBackdropFilter:
        appBarStyle.getPropertyValue("backdrop-filter") || "none",
      appBarBackgroundColor: appBarStyle.backgroundColor,
      shellIsolation: shellStyle.isolation,
      mainIsolation: mainStyle.isolation,
      forbiddenChromeOverflow,
    };
  });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`Admin mobile app shell is absolute no-scroll at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setPopulatedAdminSession(page);
    await page.goto("/dashboard/admin");

    const surface = page.locator('[data-vetneb-app-shell-surface="admin"]');
    const appBar = page.locator('[data-admin-mobile-app-bar="true"]');
    const bottomNav = page
      .locator('[data-dashboard-mobile-nav="admin"]')
      .filter({ visible: true });
    const horizontalNav = page.locator(
      '[data-dashboard-horizontal-nav-shell="true"]',
    );

    await expect(surface).toBeVisible({ timeout: 15_000 });
    await expect(appBar).toBeVisible();
    await expect(bottomNav).toBeVisible();
    await expect(horizontalNav).toBeHidden();
    await expect(
      appBar.locator('[data-dashboard-topbar-subtitle="true"]'),
    ).toHaveCount(0);

    const contract = await readShellContract(page);

    expect(contract.html.scrollHeight).toBeLessThanOrEqual(
      contract.html.clientHeight + TOLERANCE,
    );
    expect(contract.body.scrollHeight).toBeLessThanOrEqual(
      contract.body.clientHeight + TOLERANCE,
    );
    expect(contract.html.scrollWidth).toBeLessThanOrEqual(
      contract.html.clientWidth + TOLERANCE,
    );
    expect(contract.body.scrollWidth).toBeLessThanOrEqual(
      contract.body.clientWidth + TOLERANCE,
    );
    expect(["auto", "scroll"]).not.toContain(contract.shellOverflowX);
    expect(["auto", "scroll"]).not.toContain(contract.shellOverflowY);
    expect(["auto", "scroll"]).not.toContain(contract.mainOverflowX);
    expect(["auto", "scroll"]).not.toContain(contract.mainOverflowY);
    expect(contract.appBarHeight).toBeLessThanOrEqual(49);
    expect(contract.appBarBackdropFilter).toBe("none");
    expect(readCssAlpha(contract.appBarBackgroundColor)).toBe(1);
    expect(contract.shellIsolation).toBe("isolate");
    expect(contract.mainIsolation).toBe("isolate");
    expect(contract.forbiddenChromeOverflow).toEqual([]);
  });
}

// Landscape diagnostic — the fluid tokens are width/height-keyed, not
// breakpoint-specific, so the same no-scroll/opaque/isolate contract should
// hold at a short, wide viewport too. This is diagnostic coverage for the
// PR-E audit ("no hardcodear 360x740"), not a redesign requirement: it only
// asserts the existing core contract, not the fine-grained gutter/tile
// assertions other specs enforce for portrait phones.
test(`Admin mobile app shell is absolute no-scroll at ${LANDSCAPE_DIAGNOSTIC_VIEWPORT.name}`, async ({
  page,
}) => {
  await page.setViewportSize({
    width: LANDSCAPE_DIAGNOSTIC_VIEWPORT.width,
    height: LANDSCAPE_DIAGNOSTIC_VIEWPORT.height,
  });
  await setPopulatedAdminSession(page);
  await page.goto("/dashboard/admin");

  const surface = page.locator('[data-vetneb-app-shell-surface="admin"]');
  const appBar = page.locator('[data-admin-mobile-app-bar="true"]');
  const bottomNav = page
    .locator('[data-dashboard-mobile-nav="admin"]')
    .filter({ visible: true });

  await expect(surface).toBeVisible({ timeout: 15_000 });
  await expect(appBar).toBeVisible();
  await expect(bottomNav).toBeVisible();

  const contract = await readShellContract(page);

  expect(contract.html.scrollHeight).toBeLessThanOrEqual(
    contract.html.clientHeight + TOLERANCE,
  );
  expect(contract.body.scrollHeight).toBeLessThanOrEqual(
    contract.body.clientHeight + TOLERANCE,
  );
  expect(contract.html.scrollWidth).toBeLessThanOrEqual(
    contract.html.clientWidth + TOLERANCE,
  );
  expect(contract.body.scrollWidth).toBeLessThanOrEqual(
    contract.body.clientWidth + TOLERANCE,
  );
  expect(["auto", "scroll"]).not.toContain(contract.shellOverflowX);
  expect(["auto", "scroll"]).not.toContain(contract.shellOverflowY);
  expect(["auto", "scroll"]).not.toContain(contract.mainOverflowX);
  expect(["auto", "scroll"]).not.toContain(contract.mainOverflowY);
  expect(contract.appBarHeight).toBeLessThanOrEqual(49);
  expect(contract.appBarBackdropFilter).toBe("none");
  expect(readCssAlpha(contract.appBarBackgroundColor)).toBe(1);
  expect(contract.shellIsolation).toBe("isolate");
  expect(contract.mainIsolation).toBe("isolate");
  expect(contract.forbiddenChromeOverflow).toEqual([]);
});
