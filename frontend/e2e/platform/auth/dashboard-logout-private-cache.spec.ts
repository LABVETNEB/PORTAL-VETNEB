import { expect, test, type Page } from "@playwright/test";

// Regression guard for the security blocker: after logout, Back + reload must
// never re-render a private dashboard. What this spec exercises:
//   1. "Cerrar sesión" requests the role logout endpoint instead of merely
//      navigating to /login. The endpoint is route-stubbed here, so server-side
//      session invalidation is NOT verified; the test clears cookies itself.
//   2. Rendered private dashboard documents are not publicly cacheable. The
//      next.config no-store declaration for /dashboard is pinned in
//      test/unit/infrastructure/frontend-next-config-private-cache-headers.test.ts.

const POPULATED_ADMIN_SESSION = "e2e_populated_admin_session";
const POPULATED_CLINIC_SESSION = "e2e_populated_clinic_session";

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: POPULATED_ADMIN_SESSION,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: POPULATED_CLINIC_SESSION,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function desktopLogoutButton(page: Page) {
  return page
    .locator('[data-dashboard-desktop-actions="true"]')
    .getByRole("button", { name: "Cerrar sesión", exact: true });
}

// ─── Logout requests the (stubbed) endpoint and leaves the private surface ────

test.describe("dashboard logout — calls the stubbed logout endpoint and leaves the private surface", () => {
  test("admin logout calls the admin logout endpoint and leaves the private surface", async ({
    page,
  }) => {
    await setAdminSession(page);

    let adminLogoutCalled = false;
    await page.route("**/api/admin/auth/logout", async (route) => {
      adminLogoutCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/dashboard/admin?hub=1");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 15_000 });

    await desktopLogoutButton(page).click();

    await page.waitForURL(/\/login(\?|$)/, { timeout: 10_000 });
    expect(adminLogoutCalled, "admin logout endpoint must be called").toBe(true);

    // Simulate the server having cleared the httpOnly session cookie via the
    // logout Set-Cookie header, then reproduce Back + reload to /dashboard/admin.
    await page.context().clearCookies();
    await page.goto("/dashboard/admin");

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toHaveCount(0);
  });

  test("clinic logout calls the clinic logout endpoint and leaves the private surface", async ({
    page,
  }) => {
    await setClinicSession(page);

    let clinicLogoutCalled = false;
    await page.route("**/api/auth/logout", async (route) => {
      clinicLogoutCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/dashboard");
    // The clinic dashboard has no hub layer anymore: readiness is the clinic
    // stage with its active workspace mounted.
    await expect(
      page.locator('[data-clinic-dashboard-stage="true"]'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("[data-dashboard-module-workspace]"),
    ).toBeVisible({ timeout: 15_000 });

    await desktopLogoutButton(page).click();

    await page.waitForURL(/\/login(\?|$)/, { timeout: 10_000 });
    expect(clinicLogoutCalled, "clinic logout endpoint must be called").toBe(
      true,
    );

    await page.context().clearCookies();
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(
      page.locator('[data-clinic-dashboard-stage="true"]'),
    ).toHaveCount(0);
  });
});

// ─── Private surfaces are not cacheable ───────────────────────────────────────

test.describe("dashboard cache headers — private surfaces", () => {
  // The rendered dashboard document must never be publicly or shared-cacheable.
  // Next emits the full `private, no-cache, no-store, …` value for these dynamic
  // routes in production; the dev server emits `no-cache, must-revalidate`. Both
  // contain `no-cache` and neither is `public`, which is the invariant asserted
  // here so the check is deterministic across dev and prod.
  test("authenticated admin dashboard response is not publicly cacheable", async ({
    page,
  }) => {
    await setAdminSession(page);

    const response = await page.goto("/dashboard/admin");
    expect(response, "navigation response").not.toBeNull();

    const cacheControl = response!.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).not.toContain("public");
  });

  test("authenticated clinic dashboard response is not publicly cacheable", async ({
    page,
  }) => {
    await setClinicSession(page);

    const response = await page.goto("/dashboard");
    expect(response, "navigation response").not.toBeNull();

    const cacheControl = response!.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).not.toContain("public");
  });

  test("unauthenticated dashboard request redirects to login without exposing the surface", async ({
    page,
  }) => {
    // The proxy keeps the minimal redirect contract enforced by the backend
    // source-contract tests (`return NextResponse.redirect(loginUrl);`). The
    // private document itself is no-store (next.config + Next dynamic rendering);
    // the cookieless redirect carries no private payload, so this asserts the
    // behavioural guarantee instead of a header on the empty redirect.
    await page.goto("/dashboard/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toHaveCount(0);
  });
});
