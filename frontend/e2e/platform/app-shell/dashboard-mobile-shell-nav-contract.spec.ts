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
    label: "clinic operaciones (default)",
    surface: "clinic",
    path: "/dashboard",
    ready: '[data-dashboard-mobile-nav="clinic"]',
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
    ready: '[data-dashboard-hub-root="true"]',
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
  adminBottomNavVisible: boolean;
  clinicBottomNavVisible: boolean;
  legacyModuleRailCount: number;
  clippedTopbarControls: ShellNavMetric[];
  undersizedShellControls: ShellNavMetric[];
  undersizedNavControls: ShellNavMetric[];
  activeHorizontalNavItemVisible: boolean;
  activeAdminBottomNavItemVisible: boolean;
  activeClinicBottomNavItemVisible: boolean;
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
    const adminBottomNav = document.querySelector(
      "[data-dashboard-mobile-nav='admin']",
    );
    const clinicBottomNav = document.querySelector(
      "[data-dashboard-mobile-nav='clinic']",
    );

    const topbarControls = Array.from(
      document.querySelectorAll(
        "header[aria-label='Barra superior del dashboard'] > div:first-child a, header[aria-label='Barra superior del dashboard'] > div:first-child button",
      ),
    ).filter(isVisible);

    const shellControls = Array.from(
      document.querySelectorAll(
        "header[aria-label='Barra superior del dashboard'] a, header[aria-label='Barra superior del dashboard'] button",
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

    // B09_TOUCH_POLICY = OPTION_A. Everything the mobile navigation model owns
    // carries a >=44x44 floor; the app-bar cluster above keeps the historical
    // >=36px floor because those controls are shared with surfaces outside B09
    // (see the residual note in the B09 implementation doc).
    const undersizedNavControls = Array.from(
      document.querySelectorAll(
        "[data-dashboard-mobile-nav] a, [data-dashboard-mobile-nav] button, [data-dashboard-mobile-nav-overflow] a, [data-dashboard-mobile-nav-overflow] button, .admin-mobile-kebab-trigger",
      ),
    )
      .filter(isVisible)
      .filter((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map(metricFor);

    const activeHorizontalNavItem = document.querySelector(
      "[data-dashboard-horizontal-nav-shell='true'] [aria-current='page']",
    );
    const activeAdminBottomNavItem = document.querySelector(
      "[data-dashboard-mobile-nav='admin'] [aria-current='page']",
    );
    const activeClinicBottomNavItem = document.querySelector(
      "[data-dashboard-mobile-nav='clinic'] [aria-current='page']",
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

    let activeAdminBottomNavItemVisible = false;
    if (activeAdminBottomNavItem) {
      const rect = (activeAdminBottomNavItem as HTMLElement).getBoundingClientRect();
      activeAdminBottomNavItemVisible =
        isVisible(activeAdminBottomNavItem) &&
        rect.left >= -tolerance &&
        rect.right <= viewportWidth + tolerance &&
        rect.top >= -tolerance &&
        rect.bottom <= viewportHeight + tolerance;
    }

    let activeClinicBottomNavItemVisible = false;
    if (activeClinicBottomNavItem) {
      const rect = (activeClinicBottomNavItem as HTMLElement).getBoundingClientRect();
      activeClinicBottomNavItemVisible =
        isVisible(activeClinicBottomNavItem) &&
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
      adminBottomNavVisible: adminBottomNav ? isVisible(adminBottomNav) : false,
      clinicBottomNavVisible: clinicBottomNav ? isVisible(clinicBottomNav) : false,
      legacyModuleRailCount: document.querySelectorAll(
        "[data-dashboard-module-rail]",
      ).length,
      clippedTopbarControls,
      undersizedShellControls,
      undersizedNavControls,
      activeHorizontalNavItemVisible,
      activeAdminBottomNavItemVisible,
      activeClinicBottomNavItemVisible,
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
    expect(contract.adminBottomNavVisible, `${label}: admin bottom nav visible`).toBe(true);
    expect(contract.clinicBottomNavVisible, `${label}: clinic bottom nav absent`).toBe(false);
    expect(
      contract.activeAdminBottomNavItemVisible,
      `${label}: active admin bottom nav item visible`,
    ).toBe(true);
  } else {
    // B09: ONE mobile navigation model. `/dashboard` used to be the exception —
    // the clinic bottom nav returned null there and the module rail took over —
    // so the same surface had a different navigation owner than every other
    // clinic route. The bar now covers it too and the rail is retired.
    expect(
      contract.horizontalNavVisible,
      `${label}: clinic horizontal nav hidden on mobile`,
    ).toBe(false);
    expect(contract.adminBottomNavVisible, `${label}: admin bottom nav absent`).toBe(false);
    expect(
      contract.clinicBottomNavVisible,
      `${label}: shared clinic mobile navigation visible`,
    ).toBe(true);
    expect(
      contract.activeClinicBottomNavItemVisible,
      `${label}: active clinic mobile navigation item visible`,
    ).toBe(true);
  }

  // Exactly one owner below 768px, on both roles: the retired rail must not
  // come back next to the bar.
  expect(
    contract.legacyModuleRailCount,
    `${label}: the retired module rail must not exist`,
  ).toBe(0);

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
    `${label}: app-bar controls must keep mobile touch target >=36px`,
  ).toEqual([]);

  // B09_TOUCH_POLICY = OPTION_A: the floor B09 owes its own surfaces.
  expect(
    contract.undersizedNavControls,
    `${label}: navigation and overflow controls must keep touch target >=44x44`,
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
