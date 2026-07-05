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

function clinicRail(page: Page) {
  return page.locator('[data-dashboard-module-rail="true"]');
}

function clinicRailItem(page: Page, moduleId: ClinicModule) {
  return page.locator(`[data-dashboard-module-rail-item="${moduleId}"]`);
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
    // The single shared module rail is present.
    await expect(clinicRail(page)).toBeVisible();

    // The removed Home/hub must NOT come back.
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
    await expect(page.locator('[data-clinic-cockpit="true"]')).toHaveCount(0);
    await expect(page.getByText("Módulos clínicos")).toHaveCount(0);
  });

  test("shared clinic rail exposes the active module and interactive pager controls", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");

    const rail = clinicRail(page);
    await expect(rail).toBeVisible({ timeout: 8_000 });

    // Default module is operaciones and the rail marks it active.
    await expect(clinicRailItem(page, "operaciones")).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Every module is reachable from the same shared rail.
    for (const moduleId of [
      "informes",
      "logistica",
      "perfil",
      "tokens",
    ] as ClinicModule[]) {
      await expect(clinicRailItem(page, moduleId)).toBeVisible();
    }

    // Pager controls use the shared interactive styling token (PR-1 contract:
    // the shared `dashboard-*-interactive` grammar, here `dashboard-nav-interactive`,
    // replaces the removed hub-card / "Vista general" controls).
    const next = rail.locator('[data-dashboard-module-rail-next="true"]');
    await expect(next).toBeVisible();
    await expect(next).toHaveClass(/dashboard-nav-interactive/);
    await expect(
      rail.locator('[data-dashboard-module-rail-prev="true"]'),
    ).toHaveClass(/dashboard-nav-interactive/);
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
    await expect(clinicRailItem(page, "informes")).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Switching via the shared rail changes the active workspace and the URL.
    await clinicRailItem(page, "operaciones").click();
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
    await expect(clinicRail(page)).toBeVisible();
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
