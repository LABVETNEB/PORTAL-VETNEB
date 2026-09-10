import { expect, test } from "@playwright/test";

// E2E-GLOBAL-03 — frontera de auth SIMULADA (fixture), NO autoritativa.
//
// LIMPIEZA E2E P0-1/R-01: 401 for absent, unrecognized AND expired session
// (the full value -> role -> expiración model), and 403 for a valid,
// non-expired session with insufficient role. `/api/e2e/session-boundary` is
// a dedicated, additive probe added for this phase: it mirrors no production
// endpoint, so it cannot change behaviour for any of the 23 existing catalog
// entries that declare fixture: "admin-populated-api-server" — none of them
// ever requests this path or sends the BOUNDARY_* cookie values below. The
// expired-session case is the fixture-level, non-navigational counterpart of
// dashboard-session-boundary-unauthorized.spec.ts's end-to-end
// expiration -> login redirect: both read the SAME BOUNDARY_SESSIONS table
// (fixed expiresAt, no real clock) in admin-populated-api-server.mjs.
//
// PR #1710 review (P2): resolveBoundaryIdentity() used to resolve a cookie
// VALUE against BOUNDARY_SESSIONS regardless of which cookie NAME carried
// it, so app_session_id=e2e_boundary_admin_session resolved as role "admin".
// The cookie name now binds an expected role (admin_session_id -> "admin",
// app_session_id -> "clinic"); the cross-cookie-binding block below pins that
// fix down.
//
// This does NOT exercise the Fastify backend (server/**) or Postgres — the
// authoritative auth boundary stays open until E2E-GLOBAL-03B.

const BOUNDARY_URL = "http://127.0.0.1:3107/api/e2e/session-boundary";
const BOUNDARY_ADMIN_SESSION = "e2e_boundary_admin_session";
const BOUNDARY_CLINIC_SESSION = "e2e_boundary_clinic_session";
const BOUNDARY_EXPIRED_CLINIC_SESSION = "e2e_boundary_expired_clinic_session";

test.describe("E2E-GLOBAL-03 — simulated auth boundary: 401 absent/unrecognized/expired, 403 insufficient role", () => {
  test("no session cookie is rejected with 401", async ({ request }) => {
    const response = await request.get(BOUNDARY_URL);

    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  test("an unrecognized session cookie is rejected with 401", async ({
    request,
  }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: { Cookie: "app_session_id=e2e_test_clinic_session" },
    });

    expect(response.status()).toBe(401);
  });

  test("a recognized but expired clinic session is rejected with 401", async ({
    request,
  }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: {
        Cookie: `app_session_id=${BOUNDARY_EXPIRED_CLINIC_SESSION}`,
      },
    });

    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
    expect(body.error).toMatch(/expired/i);
  });

  test("a valid clinic session is rejected with 403 on the admin-only boundary", async ({
    request,
  }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: { Cookie: `app_session_id=${BOUNDARY_CLINIC_SESSION}` },
    });

    expect(response.status()).toBe(403);
    const body = (await response.json()) as { error: string; role: string };
    expect(body.error).toMatch(/forbidden/i);
    expect(body.role).toBe("clinic");
  });

  test("a valid admin session is accepted", async ({ request }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: { Cookie: `admin_session_id=${BOUNDARY_ADMIN_SESSION}` },
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { ok: boolean; role: string };
    expect(body).toEqual({ ok: true, role: "admin" });
  });
});

test.describe("E2E-GLOBAL-03 — cookie-name binding: a session value only authenticates under its own role's cookie", () => {
  test("an admin session value sent as app_session_id is rejected with 401, not accepted as admin", async ({
    request,
  }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: { Cookie: `app_session_id=${BOUNDARY_ADMIN_SESSION}` },
    });

    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  test("a clinic session value sent as admin_session_id is rejected with 401, not accepted as admin", async ({
    request,
  }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: { Cookie: `admin_session_id=${BOUNDARY_CLINIC_SESSION}` },
    });

    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  test("an expired clinic session value sent as admin_session_id is rejected on the cookie-binding mismatch, before expiry is ever evaluated", async ({
    request,
  }) => {
    const response = await request.get(BOUNDARY_URL, {
      headers: {
        Cookie: `admin_session_id=${BOUNDARY_EXPIRED_CLINIC_SESSION}`,
      },
    });

    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error: string };
    // The role-binding mismatch is checked first, so this must be the
    // generic "unrecognized" message, never the "expired" one — proving the
    // binding check runs before isBoundarySessionExpired() is ever reached.
    expect(body.error).toMatch(/unauthorized/i);
    expect(body.error).not.toMatch(/expired/i);
  });
});
