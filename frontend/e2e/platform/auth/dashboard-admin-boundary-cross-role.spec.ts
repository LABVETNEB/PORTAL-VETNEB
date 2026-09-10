import { expect, test, type Page } from "@playwright/test";

// E2E-GLOBAL-03 — frontera de auth SIMULADA (proxy de navegación), NO
// autoritativa.
//
// LIMPIEZA E2E P0-1/R-01/B-3, caso 3: a clinic session must never cross into
// the admin surface. This exercises the real, UNMODIFIED navigation gate
// (frontend/src/proxy.ts, not touched by this phase): /dashboard/admin
// requires ADMIN_SESSION_COOKIE_NAME specifically, and a cookie carrying only
// the clinic boundary does not satisfy it. Before this phase, no spec ever
// sent a clinic session at /dashboard/admin — dashboard-auth-redirect.spec.ts
// only checks the UNAUTHENTICATED case, not cross-role.
//
// This does NOT exercise the Fastify backend (server/**) or Postgres — the
// authoritative auth boundary stays open until E2E-GLOBAL-03B.

const POPULATED_CLINIC_SESSION = "e2e_populated_clinic_session";

async function setOnlyClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: POPULATED_CLINIC_SESSION,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

test.describe("E2E-GLOBAL-03 — cross-role boundary: clinic session cannot reach /dashboard/admin", () => {
  test("a clinic-only session is redirected to /login when it requests /dashboard/admin", async ({
    page,
  }) => {
    await setOnlyClinicSession(page);

    await page.goto("/dashboard/admin", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/login" &&
        url.searchParams.get("next") === "/dashboard/admin"
      );
    });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toHaveCount(0);

    // The same clinic session must still work on ITS OWN surface — otherwise
    // this would only prove a broken/absent cookie, not a real cross-role
    // rejection.
    await page.goto("/dashboard");
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");
  });
});
