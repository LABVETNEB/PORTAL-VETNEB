import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

// B08: at the default viewport the clinic module navigation is the lateral
// drawer. The legacy rail keeps its own test below, in the <768px regime where
// it is still the clinic module navigation (B09 owns its replacement).
function clinicLateralNav(page: Page) {
  return page.locator('[data-dashboard-navigation-drawer="clinic"]');
}

function clinicLateralNavItem(page: Page, moduleId: ClinicModule) {
  return clinicLateralNav(page).locator(
    `[data-dashboard-navigation-item="${moduleId}"]`,
  );
}

function clinicMobileNav(page: Page) {
  return page.locator('[data-dashboard-mobile-nav="clinic"]');
}

test.describe("dashboard interaction foundation — smoke (PR-1)", () => {
  // ── Clinic: no Home/hub — /dashboard opens the default operational workspace ──

  test("clinic /dashboard loads the default operaciones workspace (no hub)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");

    // Operational stage + default module render directly.
    await expect(
      page.locator('[data-dashboard-module-stage="true"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-clinic-dashboard-stage="true"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible();
    // The lateral navigation is present, and the retired horizontal nav is not.
    await expect(clinicLateralNav(page)).toBeVisible();
    await expect(
      page.locator("[data-dashboard-horizontal-nav-shell]"),
    ).toHaveCount(0);

    // The removed Home/hub must NOT come back.
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
    await expect(page.locator('[data-clinic-cockpit="true"]')).toHaveCount(0);
    await expect(page.getByText("Módulos clínicos")).toHaveCount(0);
  });

  test("clinic lateral navigation exposes the active module and every other one", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");

    await expect(clinicLateralNav(page)).toBeVisible({ timeout: 8_000 });

    // Default module is operaciones and the lateral nav marks it active.
    await expect(clinicLateralNavItem(page, "operaciones")).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Every module is reachable from the same band, and only one is current.
    for (const moduleId of [
      "informes",
      "logistica",
      "perfil",
      "tokens",
    ] as ClinicModule[]) {
      await expect(clinicLateralNavItem(page, moduleId)).toBeVisible();
    }
    await expect(
      clinicLateralNav(page).locator("[aria-current='page']"),
    ).toHaveCount(1);
  });

  test("the mobile model owns clinic module navigation below 768px", async ({
    page,
  }) => {
    // B08 removed the legacy rail from >=768px; B09 retired it and moved the
    // <768px regime to `DashboardMobileNav`. The pager this test used to assert
    // (`dashboard-nav-interactive` on rail prev/next) is NOT reproduced: it was
    // a second grammar over the same ordered modules, and neither the B07
    // primitives nor the two bottom navs it replaced ever carried it. What the
    // regime actually owes is asserted instead — one navigation owner, every
    // destination reachable, exactly one marked current.
    await setClinicSession(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    const nav = clinicMobileNav(page);
    await expect(nav).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("[data-dashboard-module-rail]")).toHaveCount(0);
    await expect(clinicLateralNav(page)).toBeHidden();

    for (const moduleId of [
      "operaciones",
      "informes",
      "logistica",
      "perfil",
      "tokens",
    ] as ClinicModule[]) {
      await expect(
        nav.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`),
      ).toBeVisible();
    }
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
  });

  test("clinic /dashboard?module=operaciones renders workspace", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("clinic module navigation: deep link + rail switch update the workspace", async ({
    page,
  }) => {
    await setClinicSession(page);

    // Deep link renders the informes workspace directly.
    await page.goto("/dashboard?module=informes");
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 12_000 });
    await expect(clinicLateralNavItem(page, "informes")).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Switching via the shared rail changes the active workspace and the URL.
    await clinicLateralNavItem(page, "operaciones").click();
    await expect(page).toHaveURL(/\/dashboard\?module=operaciones$/, {
      timeout: 5_000,
    });
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toHaveCount(0);
  });

  test("reduced-motion: default workspace + rail visible (no hub) with prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setClinicSession(page);
    await page.goto("/dashboard");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(clinicLateralNav(page)).toBeVisible();
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
  });

  // ── Admin: still hub-based (unchanged product) ───────────────────────────────

  test("admin /dashboard/admin loads module hub", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin /dashboard/admin?module=admin-clinics renders workspace", async ({
    page,
  }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin workspace Volver button keeps dashboard-btn-interactive (PR-1 contract)", async ({
    page,
  }) => {
    // The admin hub still uses the "Vista general" back control, so the original
    // PR-1 `dashboard-btn-interactive` contract is asserted there (the clinic
    // workspace no longer has it — the rail owns navigation).
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-clinics"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });

    const volverBtn = workspace.locator('button[aria-label="Vista general"]');
    await expect(volverBtn).toBeVisible();
    await expect(volverBtn).toHaveClass(/dashboard-btn-interactive/);
  });
});
