import { expect, test, type Page } from "@playwright/test";

// E2E-GLOBAL-03 — frontera de auth SIMULADA (fixture), NO autoritativa.
//
// LIMPIEZA E2E P0-1/R-01, caso (c) — sesión expirada durante la navegación
// -> redirect: before this phase every non-populated cookie fell through to
// the SAME 404 ("E2E populated session required"), so
// admin-populated-api-server.mjs had no explicit value -> role -> expiración
// model and could never tell "expired session" apart from "no data for this
// session" — it never emitted 401 for expiry specifically. The fixture now
// carries a deterministic BOUNDARY_SESSIONS table (fixed expiresAt, no real
// clock): this spec proves it rejects a recognized-but-expired clinic
// session with 401 on every path getDashboardStats() loads, and that the
// app's real redirectToLoginOnUnauthorized
// (frontend/src/lib/dashboard-server-auth.ts) turns that 401 into an actual
// /login redirect — the end-to-end "expiration -> login" behaviour LIMPIEZA
// E2E wants protected.
//
// This does NOT exercise the Fastify backend (server/**) or Postgres — the
// authoritative auth boundary stays open until E2E-GLOBAL-03B.

const API_BASE_URL = "http://127.0.0.1:3107";
const BOUNDARY_EXPIRED_CLINIC_SESSION = "e2e_boundary_expired_clinic_session";

// The three paths getDashboardStats() awaits concurrently via Promise.all.
const PROTECTED_CLINIC_PATHS = [
  "/api/reports",
  "/api/logistics/field-visits",
  "/api/logistics/route-plans",
] as const;

async function setExpiredClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: BOUNDARY_EXPIRED_CLINIC_SESSION,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

test.describe("E2E-GLOBAL-03 — simulated auth boundary: expired session -> 401", () => {
  for (const path of PROTECTED_CLINIC_PATHS) {
    test(`fixture rejects the expired clinic session on ${path} with 401`, async ({
      request,
    }) => {
      const response = await request.get(`${API_BASE_URL}${path}`, {
        headers: {
          Cookie: `app_session_id=${BOUNDARY_EXPIRED_CLINIC_SESSION}`,
        },
      });

      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/unauthorized/i);
      expect(body.error).toMatch(/expired/i);
    });
  }

  test("the clinic dashboard redirects to /login when its session expires mid-navigation", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await setExpiredClinicSession(page);
    await page.goto("/dashboard");

    await expect(page).toHaveURL((url) => url.pathname === "/login", {
      timeout: 10_000,
    });
    expect(pageErrors).toEqual([]);
  });
});
