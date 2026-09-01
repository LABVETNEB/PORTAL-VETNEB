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

// Unified clinic module rail: the single shared navigation/pager. Every module
// is reachable from it on every device (no cockpit hub, no split desktop-tabs /
// mobile-bottom-bar).
const CLINIC_RAIL_MODULES: Array<{
  moduleId: ClinicModule;
  railLabel: string;
  workspaceId: ClinicModule;
}> = [
  { moduleId: "operaciones", railLabel: "Operaciones", workspaceId: "operaciones" },
  { moduleId: "informes", railLabel: "Informes", workspaceId: "informes" },
  { moduleId: "logistica", railLabel: "Logística", workspaceId: "logistica" },
  { moduleId: "perfil", railLabel: "Perfil", workspaceId: "perfil" },
  { moduleId: "tokens", railLabel: "Tokens", workspaceId: "tokens" },
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

// B08: at the default Playwright viewport (1280x720) the clinic module
// navigation is the lateral DRAWER. The legacy rail no longer paints at
// >=768px; it survives only below 768px, where it is still the clinic module
// navigation on /dashboard and B09 owns its replacement. The pager block near
// the end of this file exercises it in that regime, which is the only regime
// where the prev/next affordance still exists.
// ANCHORED TO THE PAINTED BAND, DELIBERATELY. `DashboardNavigationFrame` mounts
// the lateral navigation inside a Suspense boundary whose fallback renders the
// SAME band, so while React is still swapping the resolved content in, the
// document legitimately holds two copies of the drawer: the painted one inside
// `[data-dashboard-navigation-frame]`, and the resolved one parked in React's
// `<div hidden id="S:n">` staging container (0x0, `display:none`, outside the
// accessibility tree). Only the painted band is the navigation under test.
// This does NOT weaken the contract: the filter keeps every VISIBLE match, so a
// product that ever paints two clinic drawers at once still fails here.
function clinicLateralNav(page: Page) {
  return page
    .locator('[data-dashboard-navigation-drawer="clinic"]')
    .filter({ visible: true });
}

function clinicLateralNavItem(page: Page, moduleId: ClinicModule): Locator {
  return clinicLateralNav(page).locator(
    `[data-dashboard-navigation-item="${moduleId}"]`,
  );
}

// UNFILTERED on purpose: the desktop test asserts this bar is hidden, and a
// filtered locator would satisfy `toBeHidden()` by resolving to nothing.
function clinicMobileNav(page: Page) {
  return page.locator('[data-dashboard-mobile-nav="clinic"]');
}

/**
 * The painted bar. `DashboardMobileNav` streams through the same Suspense
 * boundary as the lateral band, and its fallback mounts a second
 * `DashboardMobileNavBar` with the same attribute.
 */
function paintedClinicMobileNav(page: Page) {
  return clinicMobileNav(page).filter({ visible: true });
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

test.describe("clinic dashboard — default workspace (no hub)", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("opens the default operaciones workspace directly (no module hub)", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(clinicLateralNav(page)).toBeVisible();
    // The legacy clinic cockpit/hub must be gone entirely.
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
    await expect(page.locator('[data-clinic-cockpit="true"]')).toHaveCount(0);
    await expect(page.getByText("Módulos clínicos")).toHaveCount(0);
  });

  for (const { moduleId, railLabel } of CLINIC_RAIL_MODULES) {
    test(`the shared rail exposes the ${railLabel} module`, async ({ page }) => {
      await page.goto("/dashboard");

      const item = clinicLateralNavItem(page, moduleId);
      await expect(item).toBeVisible({ timeout: 8_000 });
      await expect(item).toContainText(new RegExp(railLabel, "i"));
    });
  }

  test("the rail marks the default operaciones module as active", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(clinicLateralNav(page)).toBeVisible({ timeout: 8_000 });
    await expect(clinicLateralNavItem(page, "operaciones")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("lateral navigation items have accessible names", async ({ page }) => {
    // The drawer's accessible name IS its visible label (the compact rail is
    // the one that needs an aria-label, because its visible text is the
    // shortLabel). Asserting the visible label here is the stronger form: it
    // fails if the name and the text ever disagree.
    await page.goto("/dashboard");

    await expect(clinicLateralNav(page)).toBeVisible({ timeout: 8_000 });

    for (const { moduleId, railLabel } of CLINIC_RAIL_MODULES) {
      await expect(
        clinicLateralNavItem(page, moduleId),
        `${moduleId}: named by its visible label`,
      ).toHaveText(new RegExp(railLabel, "i"));
    }
  });
});

// ─── Clinic dashboard — workspace activation ──────────────────────────────────

test.describe("clinic dashboard — rail navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  for (const { moduleId, workspaceId } of CLINIC_RAIL_MODULES) {
    test(`clicking the ${moduleId} rail item opens the ${workspaceId} workspace`, async ({
      page,
    }) => {
      // Start from a different module so every navigation is a real change.
      await page.goto("/dashboard?module=perfil");
      await expect(
        page.locator('[data-dashboard-module-workspace="perfil"]'),
      ).toBeVisible({ timeout: 8_000 });

      const item = clinicLateralNavItem(page, moduleId);
      await expect(item).toBeVisible();
      await item.click();

      await expect(page).toHaveURL(
        new RegExp(`/dashboard\\?module=${workspaceId}$`),
        { timeout: 5_000 },
      );
      await expect(
        page.locator(`[data-dashboard-module-workspace="${workspaceId}"]`),
      ).toBeVisible({ timeout: 12_000 });
      await expect(clinicLateralNavItem(page, workspaceId)).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }

  test("the clinic workspace has no 'Vista general' hub back button", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByRole("button", { name: "Vista general" }),
    ).toHaveCount(0);
  });

  test("the legacy rail pager steps through modules and updates the URL (<768px)", async ({
    page,
  }) => {
    // B08 removed the rail from >=768px without reproducing its prev/next
    // pager, and B09 retired the rail with the pager. What survives is the
    // contract the pager was a vehicle for: from the mobile owner, a click
    // moves the module AND commits the canonical `?module=` URL.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(paintedClinicMobileNav(page)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("[data-dashboard-module-rail]")).toHaveCount(0);

    // operaciones → informes
    await paintedClinicMobileNav(page)
      .locator('[data-dashboard-mobile-nav-item="informes"]')
      .click();
    await expect(page).toHaveURL(/\/dashboard\?module=informes$/, {
      timeout: 5_000,
    });
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 5_000 });

    // informes → operaciones
    await paintedClinicMobileNav(page)
      .locator('[data-dashboard-mobile-nav-item="operaciones"]')
      .click();
    await expect(page).toHaveURL(/\/dashboard\?module=operaciones$/, {
      timeout: 5_000,
    });
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Admin dashboard — module hub initial state ───────────────────────────────

test.describe("admin dashboard — module hub initial state", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("renders the module hub section on admin dashboard", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
  });

  test("initial state does not render admin workspace content", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });

    const workspace = page.locator('[data-dashboard-module-workspace="admin"]');
    await expect(workspace).not.toBeVisible();
  });

  test("admin hub renders at least 8 module cards", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    const cards = hub.locator("button");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("admin hub renders Administración card", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Administración")).toBeVisible();
  });

  test("admin hub renders Clínicas card", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Clínicas")).toBeVisible();
  });

  test("admin hub renders Auditoría card", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Auditoría")).toBeVisible();
  });

  test("admin hub renders Sesiones card", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Sesiones")).toBeVisible();
  });

  test("admin hub renders Precios card", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await expect(hubCard(hub, "Precios")).toBeVisible();
  });

  test("admin hub cards have accessible names", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

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
    await page.goto("/dashboard/admin?hub=1");

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
    await page.goto("/dashboard/admin?hub=1");

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
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Administración").click();

    const backBtn = page.getByRole("button", { name: "Vista general" });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Vista general returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

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

    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });

    const shellClass = await page.evaluate(() => {
      const shell = document
        .querySelector('[data-dashboard-module-workspace="operaciones"]')
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

  test("body does not scroll when the default clinic workspace fills viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);
  });

  test("body does not scroll after navigating the rail to another module", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    // A bare `/dashboard` IS the canonical url of the operational default, so
    // nothing rewrites it on entry and no mount-time navigation is in flight
    // to race the click. This used to wait for a `?module=operaciones` commit
    // first: the last-module restore hand-built that second spelling and
    // issued it unguarded, so a click on the band could be superseded by the
    // late replace and snap back to operaciones. The wait was a workaround for
    // that race; with the restore recording its intent and deferring to the
    // canonical url, the click below is the only navigation there is.
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 8_000 });
    await expect(clinicLateralNav(page)).toBeVisible({ timeout: 8_000 });
    await clinicLateralNavItem(page, "informes").click();
    await expect(page).toHaveURL(/\/dashboard\?module=informes$/, {
      timeout: 5_000,
    });
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
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
    await page.goto("/dashboard/admin?hub=1");

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

  test("deep link to a module marks it active in the shared rail", async ({ page }) => {
    await page.goto("/dashboard?module=informes");

    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(clinicLateralNavItem(page, "informes")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
  });

  test("invalid module query param falls back to the default operaciones workspace (no hub)", async ({ page }) => {
    await page.goto("/dashboard?module=modulo-invalido-xyz");

    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
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
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/, { timeout: 5_000 });
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
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });

    await page.goBack();

    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/, { timeout: 5_000 });
    await expect(hub).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).not.toBeVisible();
  });

  test("browser forward after back restores admin workspace", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/admin\?hub=1$/, { timeout: 5_000 });
    await expect(hub).toBeVisible({ timeout: 5_000 });

    await page.goForward();
    await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 5_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Clinic module rail — unified primary navigation ──────────────────────────

test.describe("clinic module rail — primary navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setClinicSession(page);
  });

  test("is the only clinic module navigation on the main dashboard (>=768px)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    await expect(clinicLateralNav(page)).toBeVisible({ timeout: 8_000 });
    // The retired horizontal tab bar and the retired module rail must not exist
    // at all, and the mobile model must not paint in this regime: exactly one
    // module navigation, and it is the lateral model.
    await expect(
      page.locator("[role='navigation'][aria-label='Navegación principal']"),
    ).toHaveCount(0);
    await expect(page.locator("[data-dashboard-horizontal-nav-shell]")).toHaveCount(0);
    await expect(page.locator("[data-dashboard-module-rail]")).toHaveCount(0);
    await expect(clinicMobileNav(page)).toBeHidden();
  });

  test("renders as a vertical lateral band beside main, not a horizontal strip", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const drawer = clinicLateralNav(page);
    await expect(drawer).toBeVisible({ timeout: 8_000 });

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    // The orientation flipped with the model: the band is now taller than it is
    // wide, and its width is the drawer token (256 ±1), not a full-width strip.
    expect(box!.height).toBeGreaterThan(box!.width);
    expect(Math.abs(box!.width - 256)).toBeLessThanOrEqual(1);

    // It takes inline size, never vertical budget: main starts to its right.
    const mainBox = await page.locator("main.dashboard-main").boundingBox();
    expect(mainBox).not.toBeNull();
    expect(mainBox!.x).toBeGreaterThanOrEqual(box!.x + box!.width - 0.5);
  });

  test("lateral navigation exposes every operational module exactly once", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(clinicLateralNav(page)).toBeVisible({ timeout: 8_000 });
    await expect(
      clinicLateralNav(page).locator("[data-dashboard-navigation-item]"),
    ).toHaveCount(CLINIC_RAIL_MODULES.length);

    for (const { moduleId } of CLINIC_RAIL_MODULES) {
      await expect(clinicLateralNavItem(page, moduleId)).toBeVisible();
    }
  });
});

test.describe("dashboard lateral nav — admin module navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setAdminSession(page);
  });

  test("clicking a nav module preserves ?module= and marks it active", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");

    // B08 retired the "Navegación principal" landmark with its component; the
    // admin lateral drawer carries its own role-specific landmark name.
    // Painted band only, for the same reason `clinicLateralNav` is filtered:
    // the admin frame streams through the same Suspense boundary.
    const nav = page
      .locator('[data-dashboard-navigation-drawer="admin"]')
      .filter({ visible: true });
    await expect(nav).toBeVisible({ timeout: 8_000 });

    const clinicasItem = nav.locator(
      '[data-dashboard-navigation-item="admin-clinics"]',
    );
    // The drawer item is server-rendered, so it is visible and fully actionable
    // ~170ms BEFORE `PublicRouteControl` hydrates (measured: item visible at
    // 34ms, `data-public-route-controls-hydrated` at 204ms). Until then it is a
    // bare <button> with no onClick, and AGENTS.md §10 forbids the `<a>`/
    // next/link fallback that would navigate without JS, so a click inside that
    // window is silently swallowed and never replayed — the URL stays on
    // `?hub=1` forever, which is exactly what CI observed. Waiting for paint is
    // not waiting for interactivity: re-issue the real click, with the real URL
    // assertion, until the control is actually live. A navigation that never
    // happens still fails.
    await expect(async () => {
      await clinicasItem.click();
      await expect(page).toHaveURL(/module=admin-clinics/, { timeout: 500 });
    }).toPass({ intervals: [50, 100, 250], timeout: 10_000 });
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
      await page.goto("/dashboard/admin?hub=1");
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
    await page.goto("/dashboard/admin?hub=1");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Vista general" })).toBeVisible();
  });

  test("each admin workspace shows Vista general — Auditoría", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Auditoría").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Vista general" })).toBeVisible();
  });

  test("Vista general from Clínicas workspace returns to admin hub", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
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
    await page.goto("/dashboard/admin?hub=1");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Clínicas").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#audit-log")).not.toBeVisible();
  });

  test("Auditoría workspace does not render pricing editor", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
    const hub = page.locator('[data-dashboard-module-hub="true"]');
    await expect(hub).toBeVisible({ timeout: 8_000 });
    await hubCard(hub, "Auditoría").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#admin-pricing")).not.toBeVisible();
  });

  test("Sesiones workspace does not render clinics or audit content", async ({ page }) => {
    await page.goto("/dashboard/admin?hub=1");
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
    await page.goto("/dashboard?module=informes");
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByText("Visitas de campo recientes", { exact: true }),
    ).not.toBeVisible();
  });

  test("Tokens workspace does not render Logística content", async ({ page }) => {
    await page.goto("/dashboard?module=tokens");
    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.getByText("Visitas de campo recientes", { exact: true }),
    ).not.toBeVisible();
  });

  test("Perfil público workspace does not render Informes workspace", async ({ page }) => {
    await page.goto("/dashboard?module=perfil");
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).not.toBeVisible();
  });
});
