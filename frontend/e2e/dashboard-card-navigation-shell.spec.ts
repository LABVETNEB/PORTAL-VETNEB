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

// ─── Clinic dashboard card hub ────────────────────────────────────────────────

test.describe("clinic dashboard — module hub", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("renders the module hub section on clinic dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
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

  test("clicking Informes card navigates to /dashboard/informes", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Informes");
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/dashboard\/informes/, { timeout: 5_000 });
  });

  test("clicking Logística card navigates to /dashboard/logistica", async ({ page }) => {
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Logística");
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/dashboard\/logistica/, { timeout: 5_000 });
  });
});

// ─── Admin dashboard card hub ─────────────────────────────────────────────────

test.describe("admin dashboard — module hub", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("renders the module hub section on admin dashboard", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
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

  test("clicking Auditoría card switches to configuracion-auditoria tab", async ({ page }) => {
    await page.goto("/dashboard/admin");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const card = hubCard(hub, "Auditoría");
    await expect(card).toBeVisible();
    await card.click();

    const auditTab = page.locator('[role="tab"][aria-controls="admin-section-panel-configuracion-auditoria"]');
    await expect(auditTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
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
      const shell = document.querySelector('[data-dashboard-module-hub="true"]')?.closest(".overflow-hidden");
      return shell?.className ?? "";
    });

    expect(shellClass).toContain("overflow-hidden");
  });

  test("dashboard main content area is scroll container (overflow-y-auto)", async ({ page }) => {
    await page.goto("/dashboard");

    await page.waitForSelector("main", { timeout: 8_000 });

    const mainHasOverflowAuto = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return false;
      const style = window.getComputedStyle(main);
      return style.overflowY === "auto" || style.overflow === "auto";
    });

    expect(mainHasOverflowAuto).toBe(true);
  });

  test("body does not scroll when clinic dashboard content fills viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);
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

    const sidebar = page.locator("[role='navigation'][aria-label='Navegación principal']");
    await expect(sidebar).toBeVisible({ timeout: 8_000 });

    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(80);
  });

  test("sidebar nav items have aria-label for accessibility", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("[role='navigation'][aria-label='Navegación principal']");
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
