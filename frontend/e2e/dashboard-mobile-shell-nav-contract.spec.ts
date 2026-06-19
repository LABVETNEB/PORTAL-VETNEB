import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-mini-375x812", width: 375, height: 812 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

type Surface = "clinic" | "admin";

type ShellRouteCase = {
  label: string;
  surface: Surface;
  path: string;
  ready: string;
};

const SHELL_ROUTES: ShellRouteCase[] = [
  {
    label: "clinic hub",
    surface: "clinic",
    path: "/dashboard",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "clinic tokens",
    surface: "clinic",
    path: "/dashboard?module=tokens",
    ready: '[data-dashboard-module-workspace="tokens"]',
  },
  {
    label: "admin hub",
    surface: "admin",
    path: "/dashboard/admin",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "admin audit",
    surface: "admin",
    path: "/dashboard/admin?module=audit-log",
    ready: '[data-dashboard-module-workspace="audit-log"]',
  },
  {
    label: "admin users",
    surface: "admin",
    path: "/dashboard/admin?module=admin-users-roles",
    ready: '[data-dashboard-module-workspace="admin-users-roles"]',
  },
];

async function applySession(page: Page, surface: Surface) {
  await page.context().addCookies([
    {
      name: surface === "clinic" ? "app_session_id" : "admin_session_id",
      value:
        surface === "clinic"
          ? "e2e_test_clinic_session"
          : "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function gotoShellRoute(page: Page, route: ShellRouteCase) {
  await applySession(page, route.surface);
  await page.goto(route.path);
  await expect(page.locator(route.ready).first()).toBeVisible({
    timeout: 15_000,
  });
}

type ShellNavMetric = {
  label: string;
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type ShellNavContract = {
  htmlScrollWidth: number;
  htmlClientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  topbarVisible: boolean;
  horizontalNavVisible: boolean;
  bottomNavVisible: boolean;
  clippedTopbarControls: ShellNavMetric[];
  undersizedShellControls: ShellNavMetric[];
  activeHorizontalNavItemVisible: boolean;
  activeBottomNavItemVisible: boolean;
};

async function readShellNavContract(page: Page): Promise<ShellNavContract> {
  return page.evaluate((tolerance) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const html = document.documentElement;
    const body = document.body;

    const isVisible = (element: Element) => {
      const el = element as HTMLElement;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };

    const textFor = (element: Element) =>
      ((element as HTMLElement).innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);

    const labelFor = (element: Element) =>
      (element as HTMLElement).getAttribute("aria-label") ||
      (element as HTMLElement).getAttribute("title") ||
      textFor(element) ||
      element.tagName.toLowerCase();

    const metricFor = (element: Element): ShellNavMetric => {
      const rect = (element as HTMLElement).getBoundingClientRect();

      return {
        label: labelFor(element),
        text: textFor(element),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const topbar = document.querySelector(
      "header[aria-label='Barra superior del dashboard']",
    );
    const nav = document.querySelector(
      "[data-dashboard-horizontal-nav-shell='true']",
    );
    const bottomNav = document.querySelector(
      "[data-admin-mobile-bottom-nav='true']",
    );

    const topbarControls = Array.from(
      document.querySelectorAll(
        "header[aria-label='Barra superior del dashboard'] > div:first-child a, header[aria-label='Barra superior del dashboard'] > div:first-child button",
      ),
    ).filter(isVisible);

    const shellControls = Array.from(
      document.querySelectorAll(
        "header[aria-label='Barra superior del dashboard'] a, header[aria-label='Barra superior del dashboard'] button, [data-admin-mobile-bottom-nav='true'] button",
      ),
    ).filter(isVisible);

    const clippedTopbarControls = topbarControls
      .filter((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();

        return (
          rect.left < -tolerance ||
          rect.right > viewportWidth + tolerance ||
          rect.top < -tolerance ||
          rect.bottom > viewportHeight + tolerance
        );
      })
      .map(metricFor);

    const undersizedShellControls = shellControls
      .filter((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        return rect.width < 36 || rect.height < 36;
      })
      .map(metricFor);

    const activeHorizontalNavItem = document.querySelector(
      "[data-dashboard-horizontal-nav-shell='true'] [aria-current='page']",
    );
    const activeBottomNavItem = document.querySelector(
      "[data-admin-mobile-bottom-nav='true'] [aria-current='page']",
    );

    let activeHorizontalNavItemVisible = false;
    if (activeHorizontalNavItem) {
      const rect = (activeHorizontalNavItem as HTMLElement).getBoundingClientRect();
      activeHorizontalNavItemVisible =
        isVisible(activeHorizontalNavItem) &&
        rect.left >= -tolerance &&
        rect.right <= viewportWidth + tolerance &&
        rect.top >= -tolerance &&
        rect.bottom <= viewportHeight + tolerance;
    }

    let activeBottomNavItemVisible = false;
    if (activeBottomNavItem) {
      const rect = (activeBottomNavItem as HTMLElement).getBoundingClientRect();
      activeBottomNavItemVisible =
        isVisible(activeBottomNavItem) &&
        rect.left >= -tolerance &&
        rect.right <= viewportWidth + tolerance &&
        rect.top >= -tolerance &&
        rect.bottom <= viewportHeight + tolerance;
    }

    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      topbarVisible: topbar ? isVisible(topbar) : false,
      horizontalNavVisible: nav ? isVisible(nav) : false,
      bottomNavVisible: bottomNav ? isVisible(bottomNav) : false,
      clippedTopbarControls,
      undersizedShellControls,
      activeHorizontalNavItemVisible,
      activeBottomNavItemVisible,
    };
  }, TOLERANCE);
}

function assertShellNavContract(
  contract: ShellNavContract,
  surface: Surface,
  label: string,
) {
  expect(contract.topbarVisible, `${label}: topbar visible`).toBe(true);

  if (surface === "admin") {
    expect(
      contract.horizontalNavVisible,
      `${label}: legacy horizontal nav hidden`,
    ).toBe(false);
    expect(contract.bottomNavVisible, `${label}: bottom nav visible`).toBe(true);
    expect(
      contract.activeBottomNavItemVisible,
      `${label}: active bottom nav item visible`,
    ).toBe(true);
  } else {
    expect(
      contract.horizontalNavVisible,
      `${label}: clinic horizontal nav visible`,
    ).toBe(true);
    expect(contract.bottomNavVisible, `${label}: no Admin bottom nav`).toBe(false);
    expect(
      contract.activeHorizontalNavItemVisible,
      `${label}: active clinic nav item visible`,
    ).toBe(true);
  }

  expect(
    contract.htmlScrollWidth,
    `${label}: documentElement horizontal overflow`,
  ).toBeLessThanOrEqual(contract.htmlClientWidth + TOLERANCE);

  expect(
    contract.bodyScrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(contract.bodyClientWidth + TOLERANCE);

  expect(
    contract.clippedTopbarControls,
    `${label}: topbar controls must not be clipped`,
  ).toEqual([]);

  expect(
    contract.undersizedShellControls,
    `${label}: topbar/nav controls must keep mobile touch target >=36px`,
  ).toEqual([]);

}

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`dashboard mobile shell/nav contract — ${viewport.name}`, () => {
    for (const route of SHELL_ROUTES) {
      test(`${route.label} keeps shell/nav usable`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await gotoShellRoute(page, route);

        await expect(async () => {
          const contract = await readShellNavContract(page);
          assertShellNavContract(
            contract,
            route.surface,
            `${viewport.name} ${route.label}`,
          );
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}
