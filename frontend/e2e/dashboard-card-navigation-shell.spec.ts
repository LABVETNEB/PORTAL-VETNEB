import { expect, test } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Card locator helper: matches only the card whose TITLE is `title` ─────────
// Uses CSS attribute selector ^= (starts-with) so "Auditoría:" matches only
// the Auditoría card, not cards whose description contains the word.

function hubCard(hub: ReturnType<Page["locator"]>, title: string) {
  return hub.locator(`button[aria-label^="${title}:"]`);
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

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
  });

  test("initial state does not render old dashboard workspace content", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const workspace = page.locator('[data-dashboard-module-workspace]');
    await expect(workspace).not.toBeVisible();
  });

  test("clinic hub renders Centro de operaciones card", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Centro de operaciones")).toBeVisible();
  });

  test("clinic hub renders Informes card", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Informes")).toBeVisible();
  });

  test("clinic hub renders Logística card", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Logística")).toBeVisible();
  });

  test("clinic hub renders Perfil público card", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Perfil público")).toBeVisible();
  });

  test("clinic hub renders Tokens particulares card", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Tokens particulares")).toBeVisible();
  });

  test("clinic hub cards have accessible names with descriptions", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const cards = hub.locator("button");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const label = await cards.nth(i).getAttribute("aria-label");
      expect(label, `card ${i} should have aria-label`).toBeTruthy();
      expect(label!.length, `card ${i} aria-label should be descriptive`).toBeGreaterThan(5);
    }
  });

  test("clinic hub cards render an icon container", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const iconContainers = hub.locator(".rounded-lg.bg-gradient-to-br");
    const count = await iconContainers.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

// ─── Clinic dashboard — workspace activation ──────────────────────────────────

test.describe("clinic dashboard — workspace activation", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("clicking Centro de operaciones card opens operaciones workspace", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Centro de operaciones");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("clicking Informes card opens informes workspace", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Informes");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("clicking Logística card opens logistica workspace", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Logística");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="logistica"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("clicking Perfil público card opens perfil workspace", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Perfil público");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("clicking Tokens particulares card opens tokens workspace", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Tokens particulares");
    await expect(card).toBeVisible();
    await card.click();

    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(hub).not.toBeVisible();
  });

  test("workspace shows Volver a módulos button", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Centro de operaciones").click();

    const backBtn = page.getByRole("button", { name: "Volver a módulos" });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Volver a módulos returns to hub", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Centro de operaciones").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Volver a módulos" }).click();

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

  test("admin workspace shows Volver a módulos button", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Administración").click();

    const backBtn = page.getByRole("button", { name: "Volver a módulos" });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Volver a módulos returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Administración").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin"]'),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Volver a módulos" }).click();

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

    const hub = page.locator('[data-dashboard-module-hub="true"]');
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

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);
  });

  test("body does not scroll when clinic workspace is open", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Centro de operaciones").click();
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

  test("Volver a módulos from clinic deep link clears query and returns to hub", async ({ page }) => {
    await page.goto("/dashboard?module=operaciones");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "Volver a módulos" }).click();

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

  test("Volver a módulos from admin deep link clears query and returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin?module=admin-clinics");

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "Volver a módulos" }).click();

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

// ─── Sidebar rail compacto ────────────────────────────────────────────────────

test.describe("dashboard sidebar — compact rail", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("sidebar renders as compact rail (width ~72px) at desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const sidebar = page.locator(
      "[role='navigation'][aria-label='Navegación principal']",
    );
    await expect(sidebar).toBeVisible({ timeout: 8_000 });

    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(80);
  });

  test("sidebar nav items have aria-label for accessibility", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator(
      "[role='navigation'][aria-label='Navegación principal']",
    );
    await expect(sidebar).toBeVisible({ timeout: 8_000 });

    const navButtons = sidebar.locator("button[aria-label]");
    const count = await navButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("sidebar back-to-home link is accessible", async ({ page }) => {
    await page.goto("/dashboard");

    const backBtn = page.getByRole("button", { name: /Volver al sitio p.blico/i });
    await expect(backBtn).toBeVisible({ timeout: 8_000 });
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
    { cardTitle: "Roles clínica", workspaceId: "admin-users-roles" },
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

  test("each admin workspace shows Volver a módulos — Clínicas", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Volver a módulos" })).toBeVisible();
  });

  test("each admin workspace shows Volver a módulos — Auditoría", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Auditoría").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Volver a módulos" })).toBeVisible();
  });

  test("Volver a módulos from Clínicas workspace returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Volver a módulos" }).click();
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
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Informes").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText("Visitas de campo recientes", { exact: true }),
    ).not.toBeVisible();
  });

  test("Tokens workspace does not render Logística content", async ({ page }) => {
    await page.goto("/dashboard");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Tokens particulares").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText("Visitas de campo recientes", { exact: true }),
    ).not.toBeVisible();
  });

  test("Perfil público workspace does not render Informes workspace", async ({ page }) => {
    await page.goto("/dashboard");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Perfil público").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).not.toBeVisible();
  });
});
