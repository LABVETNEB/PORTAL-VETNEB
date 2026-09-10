import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const databaseUrl =
  process.env.SUPABASE_DB_URL?.trim() ?? process.env.DATABASE_URL?.trim();
const databaseTarget = databaseUrl ? new URL(databaseUrl) : undefined;

if (
  !databaseTarget ||
  !["localhost", "127.0.0.1"].includes(databaseTarget.hostname) ||
  databaseTarget.pathname !== "/portal_vetneb_ci"
) {
  throw new Error(
    "E2E-GLOBAL-03B requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci",
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_DB_URL = databaseUrl;

const { db, closeDbConnection, pgClient } = await import("../../../server/db.ts");
const { createFastifyApp } = await import("../../../server/fastify-app.ts");
const { hashPassword } = await import("../../../server/lib/auth-security.ts");
const {
  activeSessions,
  adminSessions,
  adminUsers,
  auditLog,
  clinicUsers,
  clinics,
} = await import("../../../drizzle/schema.ts");

function getCookiePair(response: { headers: Record<string, unknown> }) {
  const setCookie = response.headers["set-cookie"];
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  assert.equal(typeof value, "string", "el login debe emitir Set-Cookie");

  const cookie = value.split(";", 1)[0];
  assert.ok(cookie, "Set-Cookie debe comenzar con name=value");
  return cookie;
}

test("E2E-GLOBAL-03B: Fastify y PostgreSQL aplican la frontera autoritativa admin/clínica", async (t) => {
  const suffix = `${process.pid}-${Date.now()}`;
  const clinicUsername = `e2e03b-clinic-${suffix}`;
  const adminUsername = `e2e03b-admin-${suffix}`;
  const clinicExternalId = `e2e03b-${suffix}`;
  const password = "E2E03B-Synthetic-Password";
  const passwordHash = await hashPassword(password);
  const app = await createFastifyApp();
  let clinicUserId: number | undefined;
  let adminUserId: number | undefined;
  let clinicId: number | undefined;

  t.after(async () => {
    try {
      await app.close();
    } finally {
      try {

        if (clinicUserId) {
      await db
        .delete(auditLog)
        .where(eq(auditLog.actorClinicUserId, clinicUserId));
      await db
        .delete(auditLog)
        .where(eq(auditLog.targetClinicUserId, clinicUserId));
    }

        if (adminUserId) {
      await db
        .delete(auditLog)
        .where(eq(auditLog.actorAdminUserId, adminUserId));
      await db
        .delete(auditLog)
        .where(eq(auditLog.targetAdminUserId, adminUserId));
    }

        if (clinicUserId) {
      await db.delete(activeSessions).where(eq(activeSessions.clinicUserId, clinicUserId));
      await db.delete(clinicUsers).where(eq(clinicUsers.id, clinicUserId));
    }

        if (adminUserId) {
      await db.delete(adminSessions).where(eq(adminSessions.adminUserId, adminUserId));
      await db.delete(adminUsers).where(eq(adminUsers.id, adminUserId));
    }

        if (clinicId) {
      await db.delete(clinics).where(eq(clinics.id, clinicId));
    }

      } finally {
        await closeDbConnection();
      }
    }
  });

  // `clinic_id` remains NOT NULL in the migrated database but is absent from
  // drizzle/schema.ts. Seed that legacy runtime requirement explicitly while
  // keeping the application schema untouched.
  const [clinic] = await pgClient<{ id: number }[]>`
    insert into clinics (clinic_id, name)
    values (${clinicExternalId}, ${`E2E-GLOBAL-03B clinic ${suffix}`})
    returning id
  `;
  assert.ok(clinic, "debe crear la clínica sintética de test");
  clinicId = clinic.id;

  const [clinicUser] = await db
    .insert(clinicUsers)
    .values({
      clinicId,
      username: clinicUsername,
      passwordHash,
      role: "clinic_owner",
    })
    .returning({ id: clinicUsers.id });
  assert.ok(clinicUser, "debe crear el usuario de clínica sintético");
  clinicUserId = clinicUser.id;

  const [adminUser] = await db
    .insert(adminUsers)
    .values({
      username: adminUsername,
      passwordHash,
    })
    .returning({ id: adminUsers.id });
  assert.ok(adminUser, "debe crear el usuario admin sintético");
  adminUserId = adminUser.id;

  const unauthenticated = await app.inject({
    method: "GET",
    url: "/api/reports",
  });
  assert.equal(unauthenticated.statusCode, 401);

  const clinicLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "http://localhost:3000" },
    payload: { identifier: clinicUsername, password },
  });
  assert.equal(clinicLogin.statusCode, 200);
  const clinicCookie = getCookiePair(clinicLogin);

  const clinicOwnSurface = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: clinicCookie },
  });
  assert.equal(clinicOwnSurface.statusCode, 200);

  const clinicAgainstAdmin = await app.inject({
    method: "GET",
    url: "/api/admin/auth/me",
    headers: { cookie: clinicCookie },
  });
  assert.equal(clinicAgainstAdmin.statusCode, 401);

  const adminLogin = await app.inject({
    method: "POST",
    url: "/api/admin/auth/login",
    headers: { origin: "http://localhost:3000" },
    payload: { username: adminUsername, password },
  });
  assert.equal(adminLogin.statusCode, 200);
  const adminCookie = getCookiePair(adminLogin);

  const adminOwnSurface = await app.inject({
    method: "GET",
    url: "/api/admin/auth/me",
    headers: { cookie: adminCookie },
  });
  assert.equal(adminOwnSurface.statusCode, 200);
});
