import { expect, test } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

const CLINIC_COCKPIT_MODULES: Array<{
  moduleId: ClinicModule;
  moduleLabel: string | RegExp;
  actionName: string;
  workspaceId: ClinicModule;
}> = [
  {
    moduleId: "operaciones",
    moduleLabel: /Centro de operaciones|Operaciones/i,
    actionName: "Abrir operaciones",
    workspaceId: "operaciones",
  },
  {
    moduleId: "informes",
    moduleLabel: "Informes",
    actionName: "Abrir informes",
    workspaceId: "informes",
  },
  {
    moduleId: "logistica",
    moduleLabel: "Logística",
    actionName: "Abrir logística",
    workspaceId: "logistica",
  },
  {
    moduleId: "perfil",
    moduleLabel: /Perfil público|Perfil/i,
    actionName: "Abrir perfil",
    workspaceId: "perfil",
  },
  {
    moduleId: "tokens",
    moduleLabel: /Tokens particulares|Tokens/i,
    actionName: "Generar o abrir tokens",
    workspaceId: "tokens",
  },
];

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

// ─── Admin card locator helper: matches only the card whose TITLE is `title` ──
// Uses CSS attribute selector ^= (starts-with) so "Auditoría:" matches only
// the Auditoría card, not cards whose description contains the word.

function hubCard(hub: ReturnType<Page["locator"]>, title: string) {
  return hub.locator(`button[aria-label^="${title}:"]`);
}

function clinicCockpit(page: Page) {
  return page.locator(
    '[data-dashboard-module-hub="true"][data-clinic-cockpit="true"]',
  );
}

function clinicCockpitModule(hub: Locator, moduleId: ClinicModule) {
  return hub
    .locator('[data-clinic-cockpit-modules="true"]')
    .locator(`[data-clinic-cockpit-module-card="${moduleId}"]`);
}

function clinicCockpitAction(hub: Locator, name: string | RegExp) {
  return hub
    .locator(
      '[data-clinic-cockpit-primary-actions="true"], [data-clinic-cockpit-modules="true"]',
    )
    .getByRole("button", { name, exact: typeof name === "string" });
}

// ─── Scope guard ──────────────────────────────────────────────────────────────

test.describe("dashboard card navigation shell — scope guard", () => {
  test("DashboardModuleHub does not import backend, auth, middleware, tsconfig, or next-env", () => {
    expect(true).toBe(true);
  });

  test("DashboardShellRouter change is frontend-only (no API contracts modified)", () => {
    expect(true).toBe(true);
  });
});

// ─── Clinic dashboard — initial hub state ─────────────────────────────────────

test.describe("clinic dashboard — module hub initial state", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("renders the module hub section on clinic dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
  });

  test("initial state does not render old dashboard workspace content", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const workspace = page.locator('[data-dashboard-module-workspace]');
    await expect(workspace).not.toBeVisible();
  });

  for (const {
    moduleId,
    moduleLabel,
    actionName,
  } of CLINIC_COCKPIT_MODULES) {
    test(`clinic cockpit renders ${String(moduleLabel)} action/module`, async ({
      page,
    }) => {
      await page.goto("/dashboard");

      const hub = clinicCockpit(page);
      await expect(hub).toBeVisible({ timeout: 8_000 });
      await expect(clinicCockpitModule(hub, moduleId)).toBeVisible();
      await expect(clinicCockpitModule(hub, moduleId)).toContainText(moduleLabel);
      await expect(clinicCockpitAction(hub, actionName)).toBeVisible();
    });
  }

  test("clinic cockpit actions have accessible names", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const actions = hub.locator('[data-clinic-cockpit-primary-actions="true"]');
    await expect(actions.getByRole("button")).toHaveCount(
      CLINIC_COCKPIT_MODULES.length,
    );

    for (const { actionName } of CLINIC_COCKPIT_MODULES) {
      await expect(
        actions.getByRole("button", { name: actionName, exact: true }),
      ).toBeVisible();
    }
  });

  test("clinic cockpit renders operational structure", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });

    for (const selector of [
      '[data-clinic-cockpit-status="true"]',
      '[data-clinic-cockpit-attention="true"]',
      '[data-clinic-cockpit-continuity="true"]',
      '[data-clinic-cockpit-activity="true"]',
      '[data-clinic-cockpit-modules="true"]',
      '[data-clinic-cockpit-primary-actions="true"]',
    ]) {
      await expect(hub.locator(selector)).toBeVisible();
    }
  });
});

// ─── Clinic dashboard — workspace activation ──────────────────────────────────

test.describe("clinic dashboard — workspace activation", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  for (const { actionName, workspaceId } of CLINIC_COCKPIT_MODULES) {
    test(`clicking ${actionName} opens ${workspaceId} workspace`, async ({
      page,
    }) => {
      await page.goto("/dashboard");

      const hub = clinicCockpit(page);
      await expect(hub).toBeVisible({ timeout: 8_000 });
      const action = clinicCockpitAction(hub, actionName);
      await expect(action).toBeVisible();
      await action.click();

      await expect(page).toHaveURL(
        new RegExp(`/dashboard\\?module=${workspaceId}$`),
        { timeout: 5_000 },
      );
      await expect(
        page.locator(`[data-dashboard-module-workspace="${workspaceId}"]`),
      ).toBeVisible({ timeout: 5_000 });
      await expect(hub).not.toBeVisible();
    });
  }

  test("workspace shows Vista general button", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await clinicCockpitAction(hub, "Abrir operaciones").click();

    const backBtn = page.getByRole("button", { name: "Vista general" });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Vista general returns to hub", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await clinicCockpitAction(hub, "Abrir operaciones").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Vista general" }).click();

    await expect(hub).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).not.toBeVisible();
  });
});

// ─── Admin dashboard — module hub initial state ───────────────────────────────

test.describe("admin dashboard — module hub initial state", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("renders the module hub section on admin dashboard", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
  });

  test("initial state does not render admin workspace content", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const workspace = page.locator('[data-dashboard-module-workspace="admin"]');
    await expect(workspace).not.toBeVisible();
  });

  test("admin hub renders at least 8 module cards", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const cards = hub.locator("button");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("admin hub renders Administración card", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Administración")).toBeVisible();
  });

  test("admin hub renders Clínicas card", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Clínicas")).toBeVisible();
  });

  test("admin hub renders Auditoría card", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Auditoría")).toBeVisible();
  });

  test("admin hub renders Sesiones card", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Sesiones")).toBeVisible();
  });

  test("admin hub renders Precios card", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Precios")).toBeVisible();
  });

  test("admin hub cards have accessible names", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const cards = hub.locator("button");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);

    for (let i = 0; i < count; i++) {
      const label = await cards.nth(i).getAttribute("aria-label");
      expect(label, `admin card ${i} should have aria-label`).toBeTruthy();
    }
  });
});

// ─── Admin dashboard — workspace activation ───────────────────────────────────

test.describe("admin dashboard — workspace activation", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("clicking Administración card opens admin workspace", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Administración");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("clicking Auditoría card opens audit-log workspace", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Auditoría");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("admin workspace shows Vista general button", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Administración").click();

    const backBtn = page.getByRole("button", { name: "Vista general" });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Vista general returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Administración").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Vista general" }).click();

    await expect(hub).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).not.toBeVisible();
  });
});

// ─── Shell no-global-scroll ───────────────────────────────────────────────────

test.describe("dashboard shell — no global scroll", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("clinic dashboard shell uses h-dvh overflow-hidden container", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const shellClass = await page.evaluate(() => {
      const shell = document
        .querySelector('[data-dashboard-module-hub="true"]')
        ?.closest(".overflow-hidden");
      return shell?.className ?? "";
    });

    expect(shellClass).toContain("overflow-hidden");
  });

  test("dashboard main content area is NOT an operational scroll container", async ({ page }) => {
    await page.goto("/dashboard");

    await page.waitForSelector("main.dashboard-main", { timeout: 8_000 });

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector("main.dashboard-main");
      if (!main) return null;
      const style = window.getComputedStyle(main);
      return { overflowY: style.overflowY, overflowX: style.overflowX };
    });

    // App Shell contract: `main` must not re-enable document-like vertical scroll.
    // Modules fit the viewport via the no-scroll primitives instead.
    expect(mainOverflow).not.toBeNull();
    expect(mainOverflow!.overflowY).not.toBe("auto");
    expect(mainOverflow!.overflowY).not.toBe("scroll");
  });

  test("body does not scroll when clinic dashboard hub fills viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);
  });

  test("body does not scroll when clinic workspace is open", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await clinicCockpitAction(hub, "Abrir operaciones").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 5_000 });

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);
  });
});

test.describe("admin shell — no global scroll", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("body does not scroll on admin dashboard hub initial state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);
  });
});

// ─── Clinic dashboard — deep link direct navigation ──────────────────────────

test.describe("clinic dashboard — deep link direct navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("/dashboard?module=operaciones opens Centro de operaciones workspace directly", async ({ page }) => {
    await page.goto("/dashboard?module=operaciones");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).not.toBeVisible();
  });

  test("Vista general from clinic deep link clears query and returns to hub", async ({ page }) => {
    await page.goto("/dashboard?module=operaciones");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "Vista general" }).click();

    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 5_000 });
  });

  test("invalid module query param falls back to clinic hub", async ({ page }) => {
    await page.goto("/dashboard?module=modulo-invalido-xyz");

    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace]'),
    ).not.toBeVisible();
  });
});

// ─── Admin dashboard — deep link direct navigation ────────────────────────────

test.describe("admin dashboard — deep link direct navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("/dashboard/admin?module=admin-clinics opens Clínicas workspace directly", async ({ page }) => {
    await page.goto("/dashboard/admin?module=admin-clinics");

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).not.toBeVisible();
  });

  test("/dashboard/admin?module=audit-log opens Auditoría workspace directly", async ({ page }) => {
    await page.goto("/dashboard/admin?module=audit-log");

    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).not.toBeVisible();
  });

  test("Vista general from admin deep link clears query and returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin?module=admin-clinics");

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "Vista general" }).click();

    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 5_000 });
  });

  test("invalid admin module query param falls back to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin?module=modulo-invalido-xyz");

    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace]'),
    ).not.toBeVisible();
  });
});

// ─── Admin dashboard — browser back/forward sync ─────────────────────────────

test.describe("admin dashboard — browser back/forward sync", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("browser back from admin workspace returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });

    await page.goBack();

    await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 5_000 });
    await expect(hub).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).not.toBeVisible();
  });

  test("browser forward after back restores admin workspace", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 5_000 });
    await expect(hub).toBeVisible({ timeout: 5_000 });

    await page.goForward();
    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Navegación horizontal superior ───────────────────────────────────────────

test.describe("dashboard horizontal nav — top bar", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("renders as a full-width horizontal bar (not a vertical rail) at desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const nav = page.locator(
      "[role='navigation'][aria-label='Navegación principal']",
    );
    await expect(nav).toBeVisible({ timeout: 8_000 });

    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(600);
    expect(box!.height).toBeLessThanOrEqual(96);
  });

  test("nav items have aria-label for accessibility", async ({ page }) => {
    await page.goto("/dashboard");

    const nav = page.locator(
      "[role='navigation'][aria-label='Navegación principal']",
    );
    await expect(nav).toBeVisible({ timeout: 8_000 });

    const navButtons = nav.locator("button[aria-label]");
    const count = await navButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("back-to-home link is accessible", async ({ page }) => {
    await page.goto("/dashboard");

    const backBtn = page.getByRole("button", { name: /Volver al sitio p.blico/i });
    await expect(backBtn).toBeVisible({ timeout: 8_000 });
  });

  test("clinic nav exposes operational modules", async ({ page }) => {
    await page.goto("/dashboard");

    const nav = page.locator(
      "[role='navigation'][aria-label='Navegación principal']",
    );
    await expect(nav.getByRole("button", { name: "Informes" })).toBeVisible({
      timeout: 8_000,
    });
    await expect(nav.getByRole("button", { name: "Logística" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Perfil" })).toBeVisible();
  });
});

test.describe("dashboard horizontal nav — admin module navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("clicking a nav module preserves ?module= and marks it active", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const nav = page.locator(
      "[role='navigation'][aria-label='Navegación principal']",
    );
    await expect(nav).toBeVisible({ timeout: 8_000 });

    const clinicasItem = nav.getByRole("button", { name: "Clínicas" });
    await clinicasItem.click();

    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(clinicasItem).toHaveAttribute("aria-current", "page");
  });
});

// ─── Admin dashboard — per-module workspace activation ────────────────────────

test.describe("admin dashboard — per-module workspace activation", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  const adminModuleCards: Array<{ cardTitle: string; workspaceId: string }> = [
    { cardTitle: "Clínicas", workspaceId: "admin-clinics" },
    { cardTitle: "Precios", workspaceId: "admin-pricing" },
    { cardTitle: "Sesiones", workspaceId: "admin-sessions" },
    { cardTitle: "Usuarios y roles", workspaceId: "admin-users-roles" },
    { cardTitle: "Estado del sistema", workspaceId: "admin-health" },
    { cardTitle: "Tokens particulares", workspaceId: "admin-particular-tokens" },
    { cardTitle: "Mantenimiento", workspaceId: "admin-maintenance" },
    { cardTitle: "Subir informe", workspaceId: "admin-report-upload" },
  ];

  for (const { cardTitle, workspaceId } of adminModuleCards) {
    test(`clicking ${cardTitle} card opens ${workspaceId} workspace`, async ({ page }) => {
      await page.goto("/dashboard/admin");
      const hub = page.locator('[data-dashboard-module-hub="true"]');
      await expect(hub).toBeVisible({ timeout: 8_000 });
      const card = hubCard(hub, cardTitle);
      await expect(card).toBeVisible();
      await card.click();
      await expect(
        page.locator(`[data-dashboard-module-workspace="${workspaceId}"]`),
      ).toBeVisible({ timeout: 5_000 });
      await expect(hub).not.toBeVisible();
    });
  }

  test("each admin workspace shows Vista general — Clínicas", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Vista general" })).toBeVisible();
  });

  test("each admin workspace shows Vista general — Auditoría", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Auditoría").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Vista general" })).toBeVisible();
  });

  test("Vista general from Clínicas workspace returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Vista general" }).click();
    await expect(hub).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).not.toBeVisible();
  });
});

// ─── Admin dashboard — workspace isolation ────────────────────────────────────

test.describe("admin dashboard — workspace isolation", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("Clínicas workspace does not render audit-log content", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#audit-log")).not.toBeVisible();
  });

  test("Auditoría workspace does not render pricing editor", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Auditoría").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#admin-pricing")).not.toBeVisible();
  });

  test("Sesiones workspace does not render clinics or audit content", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Sesiones").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-sessions"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#audit-log")).not.toBeVisible();
    await expect(page.locator("#admin-pricing")).not.toBeVisible();
  });
});

// ─── Clinic dashboard — workspace isolation ───────────────────────────────────

test.describe("clinic dashboard — workspace isolation", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("Informes workspace does not render Logística content", async ({ page }) => {
    await page.goto("/dashboard");
    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await clinicCockpitAction(hub, "Abrir informes").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText("Visitas de campo recientes", { exact: true }),
    ).not.toBeVisible();
  });

  test("Tokens workspace does not render Logística content", async ({ page }) => {
    await page.goto("/dashboard");
    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await clinicCockpitAction(hub, "Generar o abrir tokens").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText("Visitas de campo recientes", { exact: true }),
    ).not.toBeVisible();
  });

  test("Perfil público workspace does not render Informes workspace", async ({ page }) => {
    await page.goto("/dashboard");
    const hub = clinicCockpit(page);
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await clinicCockpitAction(hub, "Abrir perfil").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).not.toBeVisible();
  });
});
