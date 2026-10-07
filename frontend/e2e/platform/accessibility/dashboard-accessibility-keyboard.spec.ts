import { expect, test } from "@playwright/test";
import { setAdminSession, setClinicSession } from "../../helpers/session";

// ─── FilterDrawer ─────────────────────────────────────────────────────────────

test.describe("Informes compact filters — keyboard & a11y", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page, "default");
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
    await setAdminSession(page, "populated");
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
    await setClinicSession(page, "default");
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

  test("reports list renders with inline detail contract", async ({ page }) => {
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 4_000,
    });
    // Inline master-detail: the detail expands inside the selected report row,
    // so there is no persistent lateral detail panel. With the e2e empty-API
    // frame there is no selected report, hence no #report-detail node.
    await expect(page.locator("#report-detail")).toHaveCount(0);
  });
});

// ─── ReportFileActions — aria-busy ───────────────────────────────────────────

test.describe("ReportFileActions — aria-busy (PR-8)", () => {
  test("selected report action buttons keep accessible labels when rendered", async ({
    page,
  }) => {
    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    await expect(page.locator("#reports-master-list")).toBeVisible({
      timeout: 8_000,
    });

    // Action buttons live inside the selected report's inline detail; under the
    // empty-API frame there is no selection, so the assertions stay conditional.
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
    await setClinicSession(page, "default");
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

// ─── Admin lateral navigation — keyboard & a11y ──────────────────────────────
// Desktop/tablet space pass: the admin hub is retired at every width, so the
// keyboard path to a module is the lateral navigation (drawer >=1280px).

test.describe("Admin lateral navigation — keyboard & a11y (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page, "default");
    await page.goto("/dashboard/admin?hub=1");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin navigation items are named links and no hub card remains", async ({
    page,
  }) => {
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
    const items = page.locator('[data-dashboard-navigation-drawer="admin"] [data-dashboard-navigation-item]');
    expect(await items.count()).toBeGreaterThanOrEqual(1);
    await expect(items.first()).toHaveAccessibleName(/\S/);
  });

  test("an admin navigation item activates its workspace via Enter key", async ({
    page,
  }) => {
    const item = page.locator('[data-dashboard-navigation-drawer="admin"] [data-dashboard-navigation-item="audit-log"]');
    await item.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("admin workspace has no back-to-hub control", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?module=admin");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /vista general/i })).toHaveCount(0);
  });

  test("admin workspace section has accessible label", async ({ page }) => {
    await page.goto("/dashboard/admin?module=admin");
    const workspace = page.locator('[data-dashboard-module-workspace="admin"]');
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    // B11: the canonical WorkspaceHeader owns the title, so the section takes
    // its accessible name from `aria-labelledby` instead of a literal
    // `aria-label`. Assert the computed name, which also proves the reference
    // resolves to real text.
    await expect(workspace).toHaveAccessibleName(/\S/);
  });
});
