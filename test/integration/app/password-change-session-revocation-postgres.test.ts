import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

// Both URLs must already name the isolated local database: this spec never
// rewrites the environment, it refuses to run anywhere else (R3 stays manual).
for (const name of ["DATABASE_URL", "SUPABASE_DB_URL"] as const) {
  const value = process.env[name]?.trim();
  const target = value ? new URL(value) : undefined;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/portal_vetneb_ci"
  ) {
    throw new Error(
      `SEC-01-DB requiere ${name} apuntando a la DB aislada portal_vetneb_ci`,
    );
  }
}

const {
  db,
  closeDbConnection,
  changeAdminPasswordAndRevokeOtherSessions,
  changeClinicUserPasswordAndRevokeOtherSessions,
} = await import("../../../server/db.ts");
const { activeSessions, adminSessions, adminUsers, clinics, clinicUsers } =
  await import("../../../drizzle/schema.ts");
const { updateAdminClinicUserCredentials } = await import(
  "../../../server/features/clinics/infrastructure/admin-clinics-repository.ts"
);

// SEC-01 against real PostgreSQL: a password change commits the new hash and
// the session revocation together, touches only the target identity, and a
// failed write leaves both the credential and every session as they were.
// Synthetic data only, removed at the end.

const suffix = `${process.pid}-${Date.now()}`;
const FUTURE = new Date(Date.now() + 48 * 3_600_000);
const ORIGINAL_HASH = "x".repeat(60);
const TOO_LONG_HASH = "y".repeat(300);

const tokenHash = () => randomBytes(32).toString("hex");

test("SEC-01-DB: cambio de contraseña y revocación de sesiones atómicos y acotados a la identidad", async (t) => {
  const clinicIds: number[] = [];
  const adminIds: number[] = [];
  t.after(async () => {
    try {
      if (clinicIds.length > 0) await db.delete(clinics).where(inArray(clinics.id, clinicIds));
      if (adminIds.length > 0) await db.delete(adminUsers).where(inArray(adminUsers.id, adminIds));
    } finally {
      await closeDbConnection();
    }
  });

  async function createClinic(label: string) {
    // drizzle/schema.ts omits clinics.clinic_id (NOT NULL UNIQUE since 0000): insert with raw SQL.
    const inserted = (await db.execute(
      sql`insert into clinics (clinic_id, name) values (${`sec01-${label}-${suffix}`}, ${`sec01-${label}-${suffix}`}) returning id`,
    )) as unknown as Array<{ id: number }>;
    clinicIds.push(inserted[0].id);
    return inserted[0].id;
  }

  async function createClinicUser(clinicId: number, label: string) {
    const [user] = await db
      .insert(clinicUsers)
      .values({ clinicId, username: `sec01-${label}-${suffix}`, passwordHash: ORIGINAL_HASH })
      .returning({ id: clinicUsers.id });
    return user.id;
  }

  async function createClinicSession(clinicUserId: number) {
    const hash = tokenHash();
    await db.insert(activeSessions).values({ clinicUserId, tokenHash: hash, expiresAt: FUTURE });
    return hash;
  }

  async function createAdmin(label: string) {
    const [admin] = await db
      .insert(adminUsers)
      .values({ username: `sec01-${label}-${suffix}`, passwordHash: ORIGINAL_HASH })
      .returning({ id: adminUsers.id });
    adminIds.push(admin.id);
    return admin.id;
  }

  async function createAdminSession(adminUserId: number) {
    const hash = tokenHash();
    await db.insert(adminSessions).values({ adminUserId, tokenHash: hash, expiresAt: FUTURE });
    return hash;
  }

  async function clinicSessionHashes(clinicUserId: number) {
    const rows = await db
      .select({ tokenHash: activeSessions.tokenHash })
      .from(activeSessions)
      .where(eq(activeSessions.clinicUserId, clinicUserId));
    return rows.map((row) => row.tokenHash).sort();
  }

  async function adminSessionHashes(adminUserId: number) {
    const rows = await db
      .select({ tokenHash: adminSessions.tokenHash })
      .from(adminSessions)
      .where(eq(adminSessions.adminUserId, adminUserId));
    return rows.map((row) => row.tokenHash).sort();
  }

  async function clinicUserHash(clinicUserId: number) {
    const [row] = await db
      .select({ passwordHash: clinicUsers.passwordHash })
      .from(clinicUsers)
      .where(eq(clinicUsers.id, clinicUserId));
    return row?.passwordHash;
  }

  async function adminHash(adminUserId: number) {
    const [row] = await db
      .select({ passwordHash: adminUsers.passwordHash })
      .from(adminUsers)
      .where(eq(adminUsers.id, adminUserId));
    return row?.passwordHash;
  }

  const clinicA = await createClinic("a");
  const clinicB = await createClinic("b");
  const target = await createClinicUser(clinicA, "target");
  const peer = await createClinicUser(clinicA, "peer");
  const foreign = await createClinicUser(clinicB, "foreign");
  const admin = await createAdmin("admin");
  const otherAdmin = await createAdmin("admin-other");

  await t.test("clínica: conserva la sesión iniciadora y revoca sólo las demás del mismo usuario", async () => {
    const current = await createClinicSession(target);
    await createClinicSession(target);
    await createClinicSession(target);
    const peerSession = await createClinicSession(peer);
    const foreignSession = await createClinicSession(foreign);
    const adminSession = await createAdminSession(admin);

    const result = await changeClinicUserPasswordAndRevokeOtherSessions({
      clinicUserId: target,
      passwordHash: "z".repeat(60),
      keepSessionTokenHash: current,
    });

    assert.deepEqual(result, { revokedSessionCount: 2 });
    assert.equal(await clinicUserHash(target), "z".repeat(60));
    assert.deepEqual(await clinicSessionHashes(target), [current]);
    assert.deepEqual(await clinicSessionHashes(peer), [peerSession]);
    assert.deepEqual(await clinicSessionHashes(foreign), [foreignSession]);
    assert.ok((await adminSessionHashes(admin)).includes(adminSession));
    assert.equal(await clinicUserHash(peer), ORIGINAL_HASH);
  });

  await t.test("clínica: usuario inexistente devuelve null sin tocar sesiones", async () => {
    const before = await clinicSessionHashes(target);
    const result = await changeClinicUserPasswordAndRevokeOtherSessions({
      clinicUserId: 2_147_483_000,
      passwordHash: "z".repeat(60),
      keepSessionTokenHash: tokenHash(),
    });

    assert.equal(result, null);
    assert.deepEqual(await clinicSessionHashes(target), before);
  });

  await t.test("clínica: si la escritura falla no se revoca nada ni cambia la credencial", async () => {
    const current = await createClinicSession(target);
    await createClinicSession(target);
    const before = await clinicSessionHashes(target);
    const hashBefore = await clinicUserHash(target);

    await assert.rejects(
      changeClinicUserPasswordAndRevokeOtherSessions({
        clinicUserId: target,
        passwordHash: TOO_LONG_HASH,
        keepSessionTokenHash: current,
      }),
    );

    assert.deepEqual(await clinicSessionHashes(target), before);
    assert.equal(await clinicUserHash(target), hashBefore);
  });

  await t.test("admin: conserva la sesión iniciadora, revoca sus otras sesiones y no toca a otro admin", async () => {
    const current = await createAdminSession(admin);
    await createAdminSession(admin);
    const otherAdminSession = await createAdminSession(otherAdmin);
    const clinicSessionsBefore = await clinicSessionHashes(target);

    const result = await changeAdminPasswordAndRevokeOtherSessions({
      adminUserId: admin,
      passwordHash: "w".repeat(60),
      keepSessionTokenHash: current,
    });

    assert.ok(result && result.revokedSessionCount >= 1);
    assert.equal(await adminHash(admin), "w".repeat(60));
    assert.deepEqual(await adminSessionHashes(admin), [current]);
    assert.deepEqual(await adminSessionHashes(otherAdmin), [otherAdminSession]);
    assert.equal(await adminHash(otherAdmin), ORIGINAL_HASH);
    assert.deepEqual(await clinicSessionHashes(target), clinicSessionsBefore);
  });

  await t.test("admin: si la escritura falla no se revoca nada ni cambia la credencial", async () => {
    const current = await createAdminSession(admin);
    await createAdminSession(admin);
    const before = await adminSessionHashes(admin);
    const hashBefore = await adminHash(admin);

    await assert.rejects(
      changeAdminPasswordAndRevokeOtherSessions({
        adminUserId: admin,
        passwordHash: TOO_LONG_HASH,
        keepSessionTokenHash: current,
      }),
    );

    assert.deepEqual(await adminSessionHashes(admin), before);
    assert.equal(await adminHash(admin), hashBefore);
  });

  await t.test("admin → clínica: nueva contraseña revoca todas las sesiones del objetivo y ninguna ajena", async () => {
    await createClinicSession(target);
    const peerBefore = await clinicSessionHashes(peer);
    const foreignBefore = await clinicSessionHashes(foreign);
    const adminBefore = await adminSessionHashes(admin);
    const targetBefore = await clinicSessionHashes(target);
    assert.ok(targetBefore.length >= 1);

    const result = await updateAdminClinicUserCredentials({
      clinicUserId: target,
      passwordHash: "v".repeat(60),
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.credentialUpdated, true);
    assert.equal(result.ok && result.revokedSessionCount, targetBefore.length);
    assert.equal(await clinicUserHash(target), "v".repeat(60));
    assert.deepEqual(await clinicSessionHashes(target), []);
    assert.deepEqual(await clinicSessionHashes(peer), peerBefore);
    assert.deepEqual(await clinicSessionHashes(foreign), foreignBefore);
    assert.deepEqual(await adminSessionHashes(admin), adminBefore);
  });

  await t.test("admin → clínica: cambiar sólo el usuario no revoca sesiones", async () => {
    const session = await createClinicSession(target);

    const result = await updateAdminClinicUserCredentials({
      clinicUserId: target,
      username: `sec01-target-renamed-${suffix}`,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.credentialUpdated, false);
    assert.equal(result.ok && result.revokedSessionCount, 0);
    assert.deepEqual(await clinicSessionHashes(target), [session]);
  });

  await t.test("admin → clínica: si la escritura falla no se revoca nada ni cambia la credencial", async () => {
    await createClinicSession(target);
    const before = await clinicSessionHashes(target);
    const hashBefore = await clinicUserHash(target);

    await assert.rejects(
      updateAdminClinicUserCredentials({
        clinicUserId: target,
        passwordHash: TOO_LONG_HASH,
      }),
    );

    assert.deepEqual(await clinicSessionHashes(target), before);
    assert.equal(await clinicUserHash(target), hashBefore);
  });
});
