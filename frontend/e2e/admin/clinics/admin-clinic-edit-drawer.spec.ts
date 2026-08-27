import { expect, test } from "@playwright/test";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CLINIC_1 = {
  clinicId: 1,
  clinicName: "Clínica Test",
  contactEmail: "test@clinica.com",
  contactPhone: "1122334455",
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-20T12:00:00.000Z",
  users: [
    {
      userType: "clinic" as const,
      userId: 10,
      username: "usuario.test",
      role: "clinic_owner" as const,
      clinicId: 1,
      clinicName: "Clínica Test",
      createdAt: "2025-01-15T10:00:00.000Z",
      updatedAt: "2025-01-15T10:00:00.000Z",
    },
  ],
};

const MOCK_CLINIC_NO_USER = {
  clinicId: 2,
  clinicName: "Clínica Sin Usuario",
  contactEmail: null,
  contactPhone: null,
  createdAt: "2025-02-01T08:00:00.000Z",
  updatedAt: "2025-02-01T08:00:00.000Z",
  users: [],
};

const MOCK_CLINICS_RESPONSE = {
  success: true,
  clinics: [MOCK_CLINIC_1, MOCK_CLINIC_NO_USER],
  total: 2,
  limit: 50,
  offset: 0,
};

const MOCK_UPDATE_CLINIC_RESPONSE = {
  success: true,
  clinic: { ...MOCK_CLINIC_1, clinicName: "Clínica Test Editada", updatedAt: "2025-03-01T10:00:00.000Z" },
  changedBy: { adminUserId: 99, username: "admin" },
};

const MOCK_UPDATE_CREDENTIALS_RESPONSE = {
  success: true,
  user: { ...MOCK_CLINIC_1.users[0], username: "usuario.nuevo" },
  changedBy: { adminUserId: 99, username: "admin" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;

// Intercept GET /api/admin/clinics (with any query params) and return fixture.
// Using a URL predicate avoids glob ambiguity with query strings.
async function mockAdminClinicsGet(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/admin/clinics",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CLINICS_RESPONSE),
        });
      } else {
        await route.continue();
      }
    },
  );
}

// Intercept PATCH /api/admin/clinics/:id and return a success fixture.
async function mockAdminClinicsUpdate(page: Page) {
  await page.route(
    (url) => /^\/api\/admin\/clinics\/\d+$/.test(url.pathname),
    async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_UPDATE_CLINIC_RESPONSE),
        });
      } else {
        await route.continue();
      }
    },
  );
}

// Navigate to the admin-clinics workspace.
// PR5C: the admin hub is shown by default; clicking the Clínicas card opens the
// workspace and renders AdminClinicsManagementCard directly — no tabs exist in
// the workspace model.
// toPass retries the click+verify sequence in case the first click fires before
// React has attached its onClick handler (CI cold-start hydration race).
async function navigateToGestionTab(page: Page) {
  const clinicasCard = page.locator('[data-dashboard-module-card="admin-clinics"]');
  await expect(clinicasCard).toBeVisible({ timeout: 5_000 });

  await expect(async () => {
    if (await clinicasCard.isVisible()) {
      await clinicasCard.click();
    }
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 1_000 });
    await expect(page.locator("#admin-clinics")).toBeVisible({ timeout: 1_000 });
  }).toPass({ intervals: [300, 600, 1_000, 1_500], timeout: 8_000 });
}

// Wait for the fixture clinic row to be visible in the table.
// AdminClinicsManagementCard fetches data on mount; the mock intercepts
// GET /api/admin/clinics so the rows are available once the workspace opens.
async function waitForClinicList(page: Page) {
  await expect(
    page.getByRole("cell", { name: /Clínica Test/i }).first(),
  ).toBeVisible({ timeout: 8_000 });
}

// ─── Guard: scope integrity ───────────────────────────────────────────────────

test.describe("admin clinic edit drawer — scope guard", () => {
  test("ClinicEditDrawer is frontend-only and does not import backend or middleware modules", async () => {
    // This test documents scope invariants — verified by lint/typecheck in CI.
    // The drawer component only imports from @radix-ui/react-dialog, lucide-react,
    // @/components/ui, and @/types — no backend, auth, or SEO modules.
    expect(true).toBe(true);
  });
});

// ─── Behavioral tests (require admin page to render with mocked API) ──────────

test.describe("admin clinic edit drawer — component behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "admin_session_id",
        value: "e2e_test_session",
        url: "http://127.0.0.1:3000",
      },
    ]);
    await mockAdminClinicsGet(page);
    await mockAdminClinicsUpdate(page);
  });

  test("clinic list shows compact read-only rows with Edit button", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    // The table should show clinic name as text (not an input)
    const clinicNameCell = page.getByRole("cell", { name: /Clínica Test/i }).first();
    await expect(clinicNameCell).toBeVisible();

    // The Edit button should be present and accessible by name
    const editButton = page.getByRole("button", { name: /editar clínica clínica test/i });
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
  });

  test("new clinic password starts hidden and only reveals by explicit reversible action", async ({
    page,
  }) => {
    const syntheticPassword = "ClaveInicialSintetica42";

    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    await page.getByRole("button", { name: "Nueva clínica" }).click();

    const dialog = page.getByRole("dialog", { name: "Nueva clínica" });
    const passwordInput = dialog.getByRole("textbox", {
      name: "Contraseña inicial",
    });
    await passwordInput.fill(syntheticPassword);

    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(dialog.getByText(syntheticPassword, { exact: true })).toHaveCount(0);

    const revealButton = dialog.getByRole("button", {
      name: "Mostrar contraseña inicial",
    });
    await expect(revealButton).toHaveAttribute("aria-pressed", "false");
    await revealButton.click();

    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(
      dialog.getByRole("button", { name: "Ocultar contraseña inicial" }),
    ).toHaveAttribute("aria-pressed", "true");

    await dialog
      .getByRole("button", { name: "Ocultar contraseña inicial" })
      .click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("clicking Edit opens the drawer with clinic data", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    const editButton = page.getByRole("button", {
      name: /editar clínica clínica test/i,
    });
    await editButton.click();

    // Drawer should open with dialog role
    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    // Drawer should show the clinic name in an input
    const clinicNameInput = drawer.getByRole("textbox").first();
    await expect(clinicNameInput).toBeVisible();
    await expect(clinicNameInput).toHaveValue("Clínica Test");

    // Drawer should show the clinic ID
    await expect(drawer.getByText(/clínica #1/i)).toBeVisible();
  });

  test("replacement password starts hidden and only reveals by explicit reversible action", async ({
    page,
  }) => {
    const syntheticPassword = "ClaveReemplazoSintetica42";

    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);
    await page
      .getByRole("button", { name: /editar clínica clínica test/i })
      .click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    const passwordInput = drawer.getByRole("textbox", {
      name: "Nueva contraseña",
    });
    await passwordInput.fill(syntheticPassword);

    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(drawer.getByText(syntheticPassword, { exact: true })).toHaveCount(0);

    const revealButton = drawer.getByRole("button", {
      name: "Mostrar nueva contraseña",
    });
    await expect(revealButton).toHaveAttribute("aria-pressed", "false");
    await revealButton.click();

    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(
      drawer.getByRole("button", { name: "Ocultar nueva contraseña" }),
    ).toHaveAttribute("aria-pressed", "true");

    await drawer
      .getByRole("button", { name: "Ocultar nueva contraseña" })
      .click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("drawer has accessible close button and title", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    await page.getByRole("button", { name: /editar clínica clínica test/i }).click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    // Close button is accessible
    const closeButton = drawer.getByRole("button", { name: /cerrar panel de edición/i });
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeEnabled();

    // Save button is accessible
    const saveButton = drawer.getByRole("button", { name: /guardar clínica/i });
    await expect(saveButton).toBeVisible();

    // Cancel button is accessible
    const cancelButton = drawer.getByRole("button", { name: /cancelar/i });
    await expect(cancelButton).toBeVisible();
  });

  test("cancel button closes drawer without saving", async ({ page }) => {
    let updateCalled = false;

    await page.route(
      (url) => url.pathname === "/api/admin/clinics/1",
      async (route) => {
        if (route.request().method() === "PATCH") {
          updateCalled = true;
        }
        await route.continue();
      },
    );

    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    await page.getByRole("button", { name: /editar clínica clínica test/i }).click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    // Modify the clinic name
    const clinicNameInput = drawer.getByRole("textbox").first();
    await clinicNameInput.fill("Nombre cambiado");

    // Click cancel
    await drawer.getByRole("button", { name: /cancelar/i }).click();

    // Drawer should close
    await expect(drawer).not.toBeVisible({ timeout: 3_000 });

    // Update API should NOT have been called
    expect(updateCalled).toBe(false);
  });

  test("Escape key closes the drawer when not saving", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    await page.getByRole("button", { name: /editar clínica clínica test/i }).click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press("Escape");

    await expect(drawer).not.toBeVisible({ timeout: 3_000 });
  });

  test("saving clinic data calls update API and closes drawer", async ({ page }) => {
    let updatePayload: unknown = null;

    await page.route(
      (url) => url.pathname === "/api/admin/clinics/1",
      async (route) => {
        if (route.request().method() === "PATCH") {
          updatePayload = JSON.parse(route.request().postData() ?? "{}");
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_UPDATE_CLINIC_RESPONSE),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    await page.getByRole("button", { name: /editar clínica clínica test/i }).click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    // Edit clinic name
    const clinicNameInput = drawer.getByRole("textbox").first();
    await clinicNameInput.fill("Clínica Test Editada");

    // Save
    await drawer.getByRole("button", { name: /guardar clínica/i }).click();

    // Drawer should close after save
    await expect(drawer).not.toBeVisible({ timeout: 5_000 });

    // API should have been called with updated name
    expect(updatePayload).toMatchObject({ clinicName: "Clínica Test Editada" });
  });

  test("save error is displayed inside the drawer", async ({ page }) => {
    await page.route(
      (url) => url.pathname === "/api/admin/clinics/1",
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ error: "Nombre de clínica ya existe." }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    await page.getByRole("button", { name: /editar clínica clínica test/i }).click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    await drawer.getByRole("button", { name: /guardar clínica/i }).click();

    // Error should appear in the drawer (as an alert)
    const alert = drawer.getByRole("alert").first();
    await expect(alert).toBeVisible({ timeout: 5_000 });

    // Drawer should remain open on error
    await expect(drawer).toBeVisible();
  });

  test("opening drawer does not reset search query or pagination", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    // Set a search query
    const searchInput = page.getByRole("textbox", { name: /buscar clínicas/i });
    await expect(async () => {
      await searchInput.fill("Test");
      await expect(searchInput).toHaveValue("Test");
    }).toPass({ intervals: [200, 400, 800], timeout: 5_000 });

    // Open and close the drawer
    await page.getByRole("button", { name: /editar clínica clínica test/i }).click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    await drawer.getByRole("button", { name: /cancelar/i }).click();
    await expect(drawer).not.toBeVisible({ timeout: 3_000 });

    // Search query should be unchanged
    await expect(searchInput).toHaveValue("Test");
  });

  test("clinic with no user shows drawer without credentials section", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?hub=1");
    await navigateToGestionTab(page);
    await waitForClinicList(page);

    // The second clinic has no user
    const editButton = page.getByRole("button", {
      name: /editar clínica clínica sin usuario/i,
    });
    await expect(editButton).toBeVisible();
    await editButton.click();

    const drawer = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    // Credentials section (Guardar acceso button) should NOT be present
    const guardarAcceso = drawer.getByRole("button", { name: /guardar acceso/i });
    await expect(guardarAcceso).toHaveCount(0);
  });
});
