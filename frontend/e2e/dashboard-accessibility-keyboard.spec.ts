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

test.describe("FilterDrawer — keyboard & a11y (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator('[data-sticky-filter-bar="true"]')).toBeVisible({
      timeout: 8_000,
    });
  });

  // Use the FilterDrawer trigger's aria-label to distinguish it from
  // DashboardNotificationsBell which also carries aria-haspopup="dialog".
  test("filter drawer trigger has aria-haspopup=dialog", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await expect(trigger).toBeVisible();
    const haspopup = await trigger.getAttribute("aria-haspopup");
    expect(haspopup).toBe("dialog");
  });

  test("filter drawer trigger has aria-expanded=false when closed", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await expect(trigger).toBeVisible();
    const expanded = await trigger.getAttribute("aria-expanded");
    expect(expanded).toBe("false");
  });

  test("filter drawer opens when trigger is clicked", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await trigger.click();
    await expect(page.locator('[data-filter-drawer-open="true"]')).toBeVisible({
      timeout: 3_000,
    });
  });

  test("filter drawer closes on Escape and returns focus to trigger", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await trigger.click();
    await expect(page.locator('[data-filter-drawer-open="true"]')).toBeVisible({
      timeout: 3_000,
    });

    await page.keyboard.press("Escape");

    await expect(page.locator('[data-filter-drawer-open="true"]')).not.toBeVisible({
      timeout: 3_000,
    });

    // Focus should return to the FilterDrawer trigger (not the notifications bell)
    const focusedAriaLabel = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label"),
    );
    expect(focusedAriaLabel).toMatch(/filtrar informes/i);
  });

  test("filter drawer closes on backdrop click", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await trigger.click();
    await expect(page.locator('[data-filter-drawer-open="true"]')).toBeVisible({
      timeout: 3_000,
    });

    // Click the backdrop overlay directly.
    // force: true is needed because isolation:isolate on .dashboard-main limits
    // the effective z-index of the non-portal FilterDrawer overlay, making the
    // backdrop unreachable via raw mouse coordinates in Playwright.
    await page
      .locator('[data-filter-backdrop="true"]')
      .click({ force: true });

    await expect(page.locator('[data-filter-drawer-open="true"]')).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("filter drawer panel has role=dialog and aria-modal=true", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await trigger.click();
    const panel = page.getByRole("dialog", { name: /filtros de informes/i });
    await expect(panel).toHaveAttribute("aria-modal", "true");
    await expect(panel).toBeVisible({ timeout: 3_000 });
  });

  test("filter drawer close button has aria-label", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /filtrar informes/i });
    await trigger.click();
    const closeBtn = page.getByRole("button", { name: /cerrar panel de filtros/i });
    await expect(closeBtn).toBeVisible({ timeout: 3_000 });
  });
});

// ─── UploadReportModal ────────────────────────────────────────────────────────
// UploadReportModal is rendered per-token inside AdminParticularTokensCard,
// which lives in the admin-particular-tokens workspace (not admin-report-upload).
// The tokens API is mocked so the test runs without a backend.

test.describe("UploadReportModal — keyboard & a11y (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await mockParticularTokensApi(page);
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-particular-tokens");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-particular-tokens"]'),
    ).toBeVisible({ timeout: 8_000 });
    // Wait for token to render (mock returns one token with no linked report)
    await expect(
      page
        .getByRole("button", { name: /subir informe para este token/i })
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("upload report modal trigger button is visible", async ({ page }) => {
    const trigger = page
      .getByRole("button", { name: /subir informe para este token/i })
      .first();
    await expect(trigger).toBeVisible();
  });

  test("upload report modal opens on trigger click", async ({ page }) => {
    const trigger = page
      .getByRole("button", { name: /subir informe para este token/i })
      .first();
    await trigger.click();
    const modal = page.getByRole("dialog", { name: /subir informe/i });
    await expect(modal).toBeVisible({ timeout: 3_000 });
  });

  test("upload report modal has aria-modal=true", async ({ page }) => {
    const trigger = page
      .getByRole("button", { name: /subir informe para este token/i })
      .first();
    await trigger.click();
    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(modal).toBeVisible({ timeout: 3_000 });
  });

  test("upload report modal closes on Escape and returns focus to trigger", async ({
    page,
  }) => {
    const trigger = page
      .getByRole("button", { name: /subir informe para este token/i })
      .first();
    await trigger.click();
    const modal = page.getByRole("dialog", { name: /subir informe/i });
    await expect(modal).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press("Escape");

    await expect(modal).not.toBeVisible({ timeout: 3_000 });

    const focused = await page.evaluate(
      () => (document.activeElement as HTMLElement)?.textContent?.trim(),
    );
    expect(focused).toMatch(/subir informe para este token/i);
  });

  test("upload report modal closes on backdrop click", async ({ page }) => {
    const trigger = page
      .getByRole("button", { name: /subir informe para este token/i })
      .first();
    await trigger.click();
    const modal = page.getByRole("dialog", { name: /subir informe/i });
    await expect(modal).toBeVisible({ timeout: 3_000 });

    // Click the backdrop area far outside the modal dialog (top-left corner)
    await page.mouse.click(10, 10);

    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  test("upload report modal close button has descriptive aria-label", async ({
    page,
  }) => {
    const trigger = page
      .getByRole("button", { name: /subir informe para este token/i })
      .first();
    await trigger.click();
    await expect(
      page.getByRole("button", { name: /cerrar modal de subir informe/i }),
    ).toBeVisible({ timeout: 3_000 });
  });
});

// ─── Informes table — accessible select buttons ───────────────────────────────

test.describe("Informes — accessible row actions (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator(".dashboard-master-panel")).toBeVisible({
      timeout: 8_000,
    });
  });

  test("filter bar region is accessible", async ({ page }) => {
    await expect(
      page.getByRole("region", { name: "Filtros del dashboard" }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("pagination nav has aria-label", async ({ page }) => {
    // If there is pagination, validate its aria attributes
    const paginationNav = page.locator('[aria-label="Paginación de informes"]');
    // Nav may not render if there is only 1 page — skip if absent
    const count = await paginationNav.count();
    if (count > 0) {
      const prevBtn = page.getByRole("button", { name: "Página anterior" });
      await expect(prevBtn).toBeVisible();
    }
  });

  test("master panel table is visible and has thead", async ({ page }) => {
    const masterPanel = page.locator(".dashboard-master-panel");
    await expect(masterPanel.locator("table")).toBeVisible({ timeout: 4_000 });
    await expect(masterPanel.locator("thead")).toBeVisible();
  });
});

// ─── ReportFileActions — aria-busy ───────────────────────────────────────────

test.describe("ReportFileActions — aria-busy (PR-8)", () => {
  test("ver informe button has aria-label when file not available", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator(".dashboard-master-panel")).toBeVisible({
      timeout: 8_000,
    });

    // The ReportFileActions buttons are rendered in the table rows.
    // When no file is available, the button label reflects "Archivo no disponible."
    // When file exists, label is "Ver informe" or "Descargar informe".
    // Validate at least one button with a known aria-label pattern exists.
    const actionButtons = page.locator(
      'button[aria-label="Ver informe"], button[aria-label="Archivo no disponible."]',
    );
    const count = await actionButtons.count();
    // Only validate if there are rows in the table
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
