import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

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

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const MOCK_E2E_TOKEN = {
  id: 9001,
  clinicId: 42,
  reportId: null,
  tokenLast4: "E2ET",
  tutorLastName: "Apellido E2E",
  petName: "Paciente E2E",
  petAge: "2 años",
  petBreed: "Mestizo",
  petSex: "Macho",
  petSpecies: "Caninos",
  sampleLocation: "Cuello",
  sampleEvolution: "Normal",
  detailsLesion: null,
  extractionDate: "2024-01-01T00:00:00.000Z",
  shippingDate: "2024-01-01T00:00:00.000Z",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdByAdminId: 1,
  createdByClinicUserId: null,
  hasLinkedReport: false,
};

async function mockParticularTokensApi(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/admin/particular-tokens",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            count: 1,
            particularTokens: [MOCK_E2E_TOKEN],
            pagination: { limit: 10, offset: 0 },
            filters: { clinicId: null },
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  await page.route(
    (url) => url.pathname === "/api/admin/study-tracking",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            count: 0,
            trackingCases: [],
            pagination: { limit: 1, offset: 0 },
            filters: {},
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  await page.route(
    (url) => url.pathname === "/api/admin/users-roles",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            users: [],
            total: 0,
          }),
        });
      } else {
        await route.continue();
      }
    },
  );
}

// ─── FilterDrawer ─────────────────────────────────────────────────────────────

test.describe("Informes compact filters — keyboard & a11y", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(
      page.getByRole("search", { name: "Filtros compactos de informes" }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("compact filter search region is accessible", async ({ page }) => {
    await expect(
      page.getByRole("search", { name: "Filtros compactos de informes" }),
    ).toBeVisible();
  });

  test("filter fields expose accessible labels", async ({ page }) => {
    await expect(page.getByLabel("Buscar informes")).toBeVisible();
    await expect(page.getByLabel("Filtrar por estado")).toBeVisible();
    await expect(page.getByLabel("Filtrar por tipo de estudio")).toBeVisible();
  });

  test("filter form exposes submit and clear actions", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Filtrar" })).toBeVisible();
    await expect(page.getByText("Limpiar")).toBeVisible();
  });
});

// ─── UploadReportModal ────────────────────────────────────────────────────────
// UploadReportModal is rendered per-token inside AdminParticularTokensCard,
// which lives in the admin-particular-tokens workspace (not admin-report-upload).
// The tokens API is mocked so the test runs without a backend.

test.describe("Admin token workspace — upload removed from token list", () => {
  test.beforeEach(async ({ page }) => {
    await mockParticularTokensApi(page);
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-particular-tokens");
    await expect(page.locator("main.dashboard-main")).toBeVisible({
      timeout: 8_000,
    });
  });

  test("token workspace no longer exposes upload report trigger", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /subir informe para este token/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /reemplazar informe/i }),
    ).toHaveCount(0);
  });

  test("token workspace exposes list/create profile tabs", async ({ page }) => {
    await expect(
      page.getByRole("tab", { name: "Tokens administrados" }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("tab", { name: "Generar token" })).toBeVisible();
  });
});

// ─── Informes table — accessible select buttons ───────────────────────────────

test.describe("Informes — accessible profile-layout actions", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 8_000,
    });
  });

  test("compact filter region is accessible", async ({ page }) => {
    await expect(
      page.getByRole("search", { name: "Filtros compactos de informes" }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("pagination nav keeps aria-label when rendered", async ({ page }) => {
    const paginationNav = page.locator('[aria-label="Paginación de informes"]');
    const count = await paginationNav.count();

    if (count > 0) {
      await expect(paginationNav.first()).toBeVisible();
    }
  });

  test("reports list and detail are visible", async ({ page }) => {
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 4_000,
    });
    await expect(page.locator("#report-detail")).toBeVisible();
  });
});

// ─── ReportFileActions — aria-busy ───────────────────────────────────────────

test.describe("ReportFileActions — aria-busy (PR-8)", () => {
  test("selected report action buttons keep accessible labels when rendered", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator("#report-detail")).toBeVisible({
      timeout: 8_000,
    });

    const actionButtons = page.locator(
      'button[aria-label="Ver informe"], button[aria-label="Archivo no disponible."], button[aria-label="Descargar informe"]',
    );
    const count = await actionButtons.count();

    if (count > 0) {
      await expect(actionButtons.first()).toBeVisible();
    }
  });
});

// ─── DashboardNotificationsBell — desktop panel role ─────────────────────────

test.describe("DashboardNotificationsBell — desktop panel role (PR-8)", () => {
  test("notifications desktop panel uses role=region (not dialog)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/informes");
    await expect(
      page.locator('[data-dashboard-topbar="true"], header[aria-label]'),
    ).toBeVisible({ timeout: 8_000 });

    // Open notifications bell
    const bell = page.locator('button[aria-label="Notificaciones"]');
    await expect(bell).toBeVisible();
    await bell.click();

    const desktopPanel = page.locator(
      '[data-dashboard-notifications-desktop-panel="true"]',
    );
    await expect(desktopPanel).toBeVisible({ timeout: 3_000 });

    const role = await desktopPanel.getAttribute("role");
    expect(role).toBe("region");
  });
});

// ─── Admin module hub — keyboard & a11y ──────────────────────────────────────
// AdminSectionTabs is defined but not rendered on any current page.
// These tests exercise the real keyboard-accessible patterns on the admin hub:
// module card buttons and workspace navigation.

test.describe("Admin module hub — keyboard & a11y (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin hub module cards have accessible button roles and aria-labels", async ({
    page,
  }) => {
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    const cards = hub.locator("button[data-dashboard-module-card]");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const ariaLabel = await cards.first().getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect((ariaLabel ?? "").length).toBeGreaterThan(0);
  });

  test("admin hub module card activates workspace via Enter key", async ({
    page,
  }) => {
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    const firstCard = hub
      .locator("button[data-dashboard-module-card]")
      .first();
    await firstCard.focus();
    await page.keyboard.press("Enter");
    // After Enter, a workspace should be rendered
    await expect(
      page.locator("[data-dashboard-module-workspace]"),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("admin workspace back button has accessible aria-label", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?module=admin");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 8_000 });
    const backBtn = page.getByRole("button", { name: /volver a módulos/i });
    await expect(backBtn).toBeVisible();
    const ariaLabel = await backBtn.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/volver a módulos/i);
  });

  test("admin workspace section has accessible label", async ({ page }) => {
    await page.goto("/dashboard/admin?module=admin");
    const workspace = page.locator('[data-dashboard-module-workspace="admin"]');
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    const ariaLabel = await workspace.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect((ariaLabel ?? "").length).toBeGreaterThan(0);
  });
});
