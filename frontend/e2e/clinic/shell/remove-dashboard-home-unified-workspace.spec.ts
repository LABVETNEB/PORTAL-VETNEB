import { expect, test } from "@playwright/test";

// Behavioural contract for "remove dashboard home + unified module workspace":
// the clinic dashboard has NO home/hub of modules; `/dashboard` opens the
// operational default; every module shares ONE navigation/pager (the rail); and
// the shell stays free of external/horizontal scroll on the mandated viewports.

type Page = import("@playwright/test").Page;

type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

const CLINIC_MODULES: ClinicModule[] = [
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
];

const MANDATORY_VIEWPORTS = [
  { name: "android-360x740", width: 360, height: 740 },
  { name: "iphone-390x844", width: 390, height: 844 },
  { name: "laptop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

// B08: at the default viewport the clinic module navigation is the lateral
// drawer. The legacy rail is asserted separately, in the <768px regime that is
// still its own (B09 owns the replacement).
// Painted band only: the B08 frame streams through a Suspense boundary whose
// fallback mounts a second `LateralNavigation` with the same attribute. Two
// visible drawers would still fail on strictness.
function lateralNav(page: Page) {
  return page
    .locator('[data-dashboard-navigation-drawer="clinic"]')
    .filter({ visible: true });
}

function lateralNavItem(page: Page, moduleId: ClinicModule) {
  return lateralNav(page).locator(
    `[data-dashboard-navigation-item="${moduleId}"]`,
  );
}

// UNFILTERED on purpose: the desktop test asserts this bar is hidden, and a
// filtered locator would satisfy `toBeHidden()` by resolving to nothing.
function mobileNav(page: Page) {
  return page.locator('[data-dashboard-mobile-nav="clinic"]');
}

/** The painted bar, for the <768px contracts that act on it. */
function paintedMobileNav(page: Page) {
  return mobileNav(page).filter({ visible: true });
}

test.beforeEach(async ({ page }) => {
  await setClinicSession(page);
});

// 1 + 5 + default: no home/hub/tile grid, no "Módulos clínicos".
test("/dashboard renders no home/hub/tile grid and opens the default operaciones module", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(
    page.locator('[data-dashboard-module-workspace="operaciones"]'),
  ).toBeVisible({ timeout: 12_000 });

  await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
  await expect(page.locator('[data-clinic-cockpit="true"]')).toHaveCount(0);
  await expect(page.locator('[data-clinic-cockpit-modules="true"]')).toHaveCount(0);
  await expect(page.getByText("Módulos clínicos")).toHaveCount(0);
});

// 2: default operative module + the rail marks it active.
test("/dashboard resolves to operaciones with the rail marking it active", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(lateralNav(page)).toBeVisible({ timeout: 12_000 });
  await expect(lateralNavItem(page, "operaciones")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

// 3: deep links to each module work and mark the module active.
for (const moduleId of CLINIC_MODULES) {
  test(`deep link /dashboard?module=${moduleId} opens the ${moduleId} workspace`, async ({
    page,
  }) => {
    await page.goto(`/dashboard?module=${moduleId}`);
    await expect(
      page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
    ).toBeVisible({ timeout: 12_000 });
    await expect(lateralNavItem(page, moduleId)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
  });
}

// 4: the same navigation appears identically for every module. Two regimes,
// because B08 split them: the lateral band owns >=768px and does NOT reproduce
// the prev/next pager; the legacy rail keeps that pager below 768px.
test("the lateral navigation (all 5 modules) appears on every module", async ({
  page,
}) => {
  for (const moduleId of CLINIC_MODULES) {
    await page.goto(`/dashboard?module=${moduleId}`);
    const nav = lateralNav(page);
    await expect(nav).toBeVisible({ timeout: 12_000 });
    await expect(nav).toHaveAttribute(
      "aria-label",
      "Navegación lateral de clínica",
    );
    for (const other of CLINIC_MODULES) {
      await expect(lateralNavItem(page, other)).toHaveCount(1);
    }
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
    await expect(mobileNav(page)).toBeHidden();
    await expect(page.locator("[data-dashboard-module-rail]")).toHaveCount(0);
  }
});

test("the mobile model (all 5 modules + Inicio) appears on every module <768px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });

  for (const moduleId of CLINIC_MODULES) {
    await page.goto(`/dashboard?module=${moduleId}`);
    const nav = paintedMobileNav(page);
    await expect(nav).toBeVisible({ timeout: 12_000 });
    await expect(nav).toHaveAttribute(
      "aria-label",
      "Navegación móvil de clínica",
    );
    // Every module is reachable from the single owner, on every module page.
    for (const other of CLINIC_MODULES) {
      await expect(
        nav.locator(`[data-dashboard-mobile-nav-item="${other}"]`),
      ).toHaveCount(1);
    }
    // B09_CLINIC_HOME_ITEM = PRESERVE: Inicio stays, so six primary slots.
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="home"]'),
    ).toHaveCount(1);
    await expect(nav.locator("[data-dashboard-mobile-nav-item]")).toHaveCount(6);
    // The prev/next pager the retired rail carried is NOT reproduced: it was a
    // second grammar over the same ordered modules, not a destination.
    await expect(page.locator('[data-dashboard-pager="module"]')).toHaveCount(0);
  }
});

// 6: no external vertical or horizontal scroll on the mandated viewports.
for (const viewport of MANDATORY_VIEWPORTS) {
  test(`no external/horizontal scroll on /dashboard at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 12_000 });

    await expect(async () => {
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
          vertical: Math.max(
            doc.scrollHeight - doc.clientHeight,
            body.scrollHeight - body.clientHeight,
          ),
          horizontal: Math.max(
            doc.scrollWidth - doc.clientWidth,
            body.scrollWidth - body.clientWidth,
          ),
        };
      });
      expect(overflow.vertical, `${viewport.name}: external vertical scroll`).toBeLessThanOrEqual(2);
      expect(overflow.horizontal, `${viewport.name}: horizontal scroll`).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 10_000 });
  });
}
