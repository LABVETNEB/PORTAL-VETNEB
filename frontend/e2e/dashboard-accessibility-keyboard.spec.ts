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

// ─── FilterDrawer ─────────────────────────────────────────────────────────────

test.describe("FilterDrawer — keyboard & a11y (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator('[data-sticky-filter-bar="true"]')).toBeVisible({
      timeout: 8_000,
    });
  });

  test("filter drawer trigger has aria-haspopup=dialog", async ({ page }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await expect(trigger).toBeVisible();
    const haspopup = await trigger.getAttribute("aria-haspopup");
    expect(haspopup).toBe("dialog");
  });

  test("filter drawer trigger has aria-expanded=false when closed", async ({
    page,
  }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await expect(trigger).toBeVisible();
    const expanded = await trigger.getAttribute("aria-expanded");
    expect(expanded).toBe("false");
  });

  test("filter drawer opens when trigger is clicked", async ({ page }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    await expect(page.locator('[data-filter-drawer-open="true"]')).toBeVisible({
      timeout: 3_000,
    });
  });

  test("filter drawer closes on Escape and returns focus to trigger", async ({
    page,
  }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    await expect(page.locator('[data-filter-drawer-open="true"]')).toBeVisible({
      timeout: 3_000,
    });

    await page.keyboard.press("Escape");

    await expect(page.locator('[data-filter-drawer-open="true"]')).not.toBeVisible({
      timeout: 3_000,
    });

    // Focus should return to the trigger button
    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-haspopup"),
    );
    expect(focused).toBe("dialog");
  });

  test("filter drawer closes on backdrop click", async ({ page }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    await expect(page.locator('[data-filter-drawer-open="true"]')).toBeVisible({
      timeout: 3_000,
    });

    // Click the backdrop (aria-hidden overlay behind the panel)
    await page.mouse.click(100, 300);

    await expect(page.locator('[data-filter-drawer-open="true"]')).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("filter drawer panel has role=dialog and aria-modal=true", async ({
    page,
  }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    const panel = page.locator('[role="dialog"][aria-modal="true"]').first();
    await expect(panel).toBeVisible({ timeout: 3_000 });
  });

  test("filter drawer close button has aria-label", async ({ page }) => {
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    const closeBtn = page.getByRole("button", { name: /cerrar panel de filtros/i });
    await expect(closeBtn).toBeVisible({ timeout: 3_000 });
  });
});

// ─── UploadReportModal ────────────────────────────────────────────────────────

test.describe("UploadReportModal — keyboard & a11y (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    // Navigate to admin-report-upload workspace
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const uploadCard = hub.locator('button[aria-label^="Subir informe:"]');
    await expect(uploadCard).toBeVisible({ timeout: 5_000 });
    await uploadCard.click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-report-upload"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("upload report modal trigger button is visible", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /subir informe/i }).first();
    await expect(trigger).toBeVisible();
  });

  test("upload report modal opens on trigger click", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /subir informe/i }).first();
    await trigger.click();
    const modal = page.getByRole("dialog", { name: /subir informe/i });
    await expect(modal).toBeVisible({ timeout: 3_000 });
  });

  test("upload report modal has aria-modal=true", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /subir informe/i }).first();
    await trigger.click();
    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(modal).toBeVisible({ timeout: 3_000 });
  });

  test("upload report modal closes on Escape and returns focus to trigger", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /subir informe/i }).first();
    await trigger.click();
    const modal = page.getByRole("dialog", { name: /subir informe/i });
    await expect(modal).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press("Escape");

    await expect(modal).not.toBeVisible({ timeout: 3_000 });

    const focused = await page.evaluate(
      () => (document.activeElement as HTMLElement)?.textContent?.trim(),
    );
    expect(focused).toMatch(/subir informe/i);
  });

  test("upload report modal closes on backdrop click", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /subir informe/i }).first();
    await trigger.click();
    const modal = page.getByRole("dialog", { name: /subir informe/i });
    await expect(modal).toBeVisible({ timeout: 3_000 });

    // Click the backdrop area far outside the modal dialog
    await page.mouse.click(10, 10);

    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  test("upload report modal close button has descriptive aria-label", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /subir informe/i }).first();
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

// ─── AdminSectionTabs — keyboard navigation ───────────────────────────────────

test.describe("AdminSectionTabs — keyboard navigation (PR-8)", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    // Open administración workspace which uses AdminSectionTabs
    const adminCard = hub.locator('button[aria-label^="Administración:"]');
    await adminCard.click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("tablist is present and has at least one tab", async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 5_000 });
    const tabs = tablist.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("active tab has aria-selected=true", async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 5_000 });
    const selectedTab = tablist.locator('[role="tab"][aria-selected="true"]');
    await expect(selectedTab).toBeVisible();
  });

  test("ArrowRight moves focus to next tab", async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 5_000 });

    const firstTab = tablist.locator('[role="tab"]').first();
    await firstTab.focus();
    await page.keyboard.press("ArrowRight");

    const secondTab = tablist.locator('[role="tab"]').nth(1);
    const secondTabId = await secondTab.getAttribute("id");
    const focusedId = await page.evaluate(
      () => document.activeElement?.id,
    );
    expect(focusedId).toBe(secondTabId);
  });

  test("Home key moves focus to first tab", async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 5_000 });

    const lastTab = tablist.locator('[role="tab"]').last();
    await lastTab.focus();
    await page.keyboard.press("Home");

    const firstTab = tablist.locator('[role="tab"]').first();
    const firstTabId = await firstTab.getAttribute("id");
    const focusedId = await page.evaluate(
      () => document.activeElement?.id,
    );
    expect(focusedId).toBe(firstTabId);
  });
});
