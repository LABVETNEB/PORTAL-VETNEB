import assert from "node:assert/strict";
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
      `GLOBAL-SEARCH-STATES-DB requiere ${name} apuntando a la DB aislada portal_vetneb_ci`,
    );
  }
}

const { db, closeDbConnection } = await import("../../../server/db.ts");
const { activeSessions, adminSessions, adminUsers, clinics, clinicUsers, globalSearchStates } = await import(
  "../../../drizzle/schema.ts"
);
const infrastructure = await import("../../../server/features/global-search/infrastructure/index.ts");
const { GLOBAL_SEARCH_STATE_MAX_PER_SESSION } = await import("../../../server/features/global-search/domain/index.ts");

// GLOBAL-SEARCH-DRIVE-A4 · migration 0031 against real PostgreSQL. Matrix of
// docs/implementation/global-search-a4-postgres-certification-matrix.md (C1-C10).
// Synthetic data only, removed at the end. The migration is applied by
// `pnpm db:migrate` BEFORE this spec; the spec only observes it.

const HOUR = 3_600_000;
const suffix = `${process.pid}-${Date.now()}`;

async function exists(name: string): Promise<boolean> {
  const rows = (await db.execute(sql`select to_regclass(${name}) as found`)) as unknown as Array<{ found: string | null }>;
  return rows[0]?.found !== null && rows[0]?.found !== undefined;
}

function expectRejected(promise: Promise<unknown>, code: string) {
  return assert.rejects(promise, (error: unknown) => {
    const cause = (error as { cause?: { code?: string } }).cause;
    return (error as { code?: string }).code === code || cause?.code === code;
  });
}

test("GLOBAL-SEARCH-STATES-DB: tabla, índices, restricciones, cascada, caducidad, tope bajo concurrencia, aislamiento, plan y rollback", async (t) => {
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

  const future = new Date(Date.now() + 48 * HOUR);
  async function clinicSession(label: string, expiresAt: Date | null = future) {
    // drizzle/schema.ts omits clinics.clinic_id (NOT NULL UNIQUE since 0000): insert with raw SQL.
    const inserted = (await db.execute(
      sql`insert into clinics (clinic_id, name) values (${`gss-${label}-${suffix}`}, ${`gss-${label}-${suffix}`}) returning id`,
    )) as unknown as Array<{ id: number }>;
    const clinic = inserted[0];
    clinicIds.push(clinic.id);
    const [user] = await db
      .insert(clinicUsers)
      .values({ clinicId: clinic.id, username: `gss-${label}-${suffix}`, passwordHash: "x".repeat(60) })
      .returning({ id: clinicUsers.id });
    const tokenHash = `${label}${suffix}`.replace(/[^a-z0-9]/gi, "").padEnd(64, "0").slice(0, 64);
    await db.insert(activeSessions).values({ clinicUserId: user.id, tokenHash, expiresAt });
    return { surface: "clinic" as const, sessionTokenHash: tokenHash };
  }
  async function adminSession(label: string) {
    const [admin] = await db
      .insert(adminUsers)
      .values({ username: `gss-${label}-${suffix}`, passwordHash: "x".repeat(60) })
      .returning({ id: adminUsers.id });
    adminIds.push(admin.id);
    const tokenHash = `${label}${suffix}`.replace(/[^a-z0-9]/gi, "").padEnd(64, "0").slice(0, 64);
    await db.insert(adminSessions).values({ adminUserId: admin.id, tokenHash, expiresAt: future, lastAccess: new Date() });
    return { surface: "admin" as const, sessionTokenHash: tokenHash };
  }
  const repository = infrastructure.createGlobalSearchStateRepository();
  const countOf = async (column: "clinic_session_token_hash" | "admin_session_token_hash", hash: string) => {
    const rows = (await db.execute(
      sql`select count(*)::int as n from global_search_states where ${sql.raw(column)} = ${hash}`,
    )) as unknown as Array<{ n: number }>;
    return rows[0].n;
  };

  await t.test("C1/C2: la migración está aplicada con sus índices y restricciones", async () => {
    assert.equal(await exists("global_search_states"), true);
    const indexes = (await db.execute(
      sql`select indexname from pg_indexes where tablename = 'global_search_states' order by indexname`,
    )) as unknown as Array<{ indexname: string }>;
    const names = indexes.map((row) => row.indexname);
    for (const expected of [
      "global_search_states_admin_session_idx",
      "global_search_states_clinic_session_idx",
      "global_search_states_expires_at_idx",
      "global_search_states_pkey",
    ]) {
      assert.ok(names.includes(expected), expected);
    }
    const constraints = (await db.execute(sql`
      select conname, contype, confdeltype
      from pg_constraint where conrelid = 'global_search_states'::regclass order by conname
    `)) as unknown as Array<{ conname: string; contype: string; confdeltype: string }>;
    const foreignKeys = constraints.filter((row) => row.contype === "f");
    assert.equal(foreignKeys.map((row) => row.confdeltype).join(""), "cc", "both foreign keys cascade on delete");
    assert.ok(constraints.some((row) => row.conname === "global_search_states_surface_owner_check" && row.contype === "c"));
  });

  await t.test("C3: claves foráneas y CHECK de dueño único (Clínica y Admin)", async () => {
    const clinic = await clinicSession("fk-clinic");
    const admin = await adminSession("fk-admin");
    const base = { queryText: "luna", createdAt: new Date(), expiresAt: future };
    await expectRejected(
      db.insert(globalSearchStates).values({ ...base, id: crypto.randomUUID(), surface: "clinic", clinicSessionTokenHash: "f".repeat(64) }),
      "23503",
    );
    await expectRejected(
      db.insert(globalSearchStates).values({ ...base, id: crypto.randomUUID(), surface: "admin", adminSessionTokenHash: "f".repeat(64) }),
      "23503",
    );
    await expectRejected(
      db.insert(globalSearchStates).values({
        ...base,
        id: crypto.randomUUID(),
        surface: "clinic",
        clinicSessionTokenHash: clinic.sessionTokenHash,
        adminSessionTokenHash: admin.sessionTokenHash,
      }),
      "23514",
    );
    await expectRejected(db.insert(globalSearchStates).values({ ...base, id: crypto.randomUUID(), surface: "clinic" }), "23514");
    await expectRejected(
      db.insert(globalSearchStates).values({
        ...base,
        id: crypto.randomUUID(),
        surface: "admin",
        clinicSessionTokenHash: clinic.sessionTokenHash,
      }),
      "23514",
    );
  });

  await t.test("C4: caducidad lógica antes de la física, y el barrido borra sólo lo vencido", async () => {
    const owner = await clinicSession("ttl");
    const other = await clinicSession("ttl-other");
    const expiring = await repository.save(owner, { queryText: "uno", kinds: null }, Date.now());
    const staying = await repository.save(other, { queryText: "dos", kinds: null }, Date.now());
    assert.ok(expiring && staying);
    const past = new Date(Date.now() - HOUR).toISOString();
    await db.execute(sql`update global_search_states set expires_at = ${past}::timestamp where id = ${expiring.id}::uuid`);

    assert.equal(await repository.find(owner, expiring.id, Date.now()), null, "invisible although the row still exists");
    assert.equal(await countOf("clinic_session_token_hash", owner.sessionTokenHash), 1, "not physically deleted yet");

    const removed = await infrastructure.deleteExpiredGlobalSearchStates(db, Date.now());
    assert.ok(removed >= 1);
    assert.equal(await countOf("clinic_session_token_hash", owner.sessionTokenHash), 0);
    assert.deepEqual(await repository.find(other, staying.id, Date.now()), { queryText: "dos", kinds: null }, "another session is untouched");

    // The TTL is the minimum of 24 h and the session: a session ending in 1 h caps the state.
    const short = await clinicSession("ttl-short", new Date(Date.now() + HOUR));
    const capped = await repository.save(short, { queryText: "corto", kinds: null }, Date.now());
    assert.ok(capped);
    assert.equal(await repository.find(short, capped.id, Date.now() + 2 * HOUR), null);
    const ended = await clinicSession("ttl-over", new Date(Date.now() - 1000));
    assert.equal(await repository.save(ended, { queryText: "tarde", kinds: null }, Date.now()), null, "an expired session saves nothing");
  });

  await t.test("C5: eliminar la sesión borra sus estados por cascada (Clínica y Admin)", async () => {
    const clinic = await clinicSession("cascade-clinic");
    const admin = await adminSession("cascade-admin");
    const keep = await clinicSession("cascade-keep");
    await repository.save(clinic, { queryText: "uno", kinds: null }, Date.now());
    await repository.save(admin, { queryText: "uno", kinds: "clinic,report" }, Date.now());
    const kept = await repository.save(keep, { queryText: "uno", kinds: null }, Date.now());
    await db.delete(activeSessions).where(eq(activeSessions.tokenHash, clinic.sessionTokenHash));
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, admin.sessionTokenHash));
    assert.equal(await countOf("clinic_session_token_hash", clinic.sessionTokenHash), 0);
    assert.equal(await countOf("admin_session_token_hash", admin.sessionTokenHash), 0);
    assert.ok(kept && (await repository.find(keep, kept.id, Date.now())), "other sessions keep their states");
  });

  await t.test("C6: 40 guardados simultáneos de una sesión dejan exactamente 20 y ninguno falla", async () => {
    const owner = await clinicSession("cap");
    const outcomes = await Promise.all(
      Array.from({ length: 40 }, (_, index) => repository.save(owner, { queryText: `serie ${index}x`, kinds: null }, Date.now())),
    );
    assert.ok(outcomes.every((outcome) => outcome !== null));
    assert.equal(await countOf("clinic_session_token_hash", owner.sessionTokenHash), GLOBAL_SEARCH_STATE_MAX_PER_SESSION);

    const same = await Promise.all(Array.from({ length: 10 }, () => repository.save(owner, { queryText: "repetida", kinds: null }, Date.now())));
    assert.equal(new Set(same.map((outcome) => outcome?.id)).size, 1, "the same search converges on one id");
    assert.ok((await countOf("clinic_session_token_hash", owner.sessionTokenHash)) <= GLOBAL_SEARCH_STATE_MAX_PER_SESSION);
  });

  await t.test("C7/C8: aislamiento Clínica A/B y Admin, y recuperación por otra instancia del repositorio", async () => {
    const a = await clinicSession("iso-a");
    const b = await clinicSession("iso-b");
    const admin = await adminSession("iso-admin");
    const saved = await repository.save(a, { queryText: "Rosalinda", kinds: "report" }, Date.now());
    assert.ok(saved);
    const fresh = infrastructure.createGlobalSearchStateRepository();
    assert.deepEqual(await fresh.find(a, saved.id, Date.now()), { queryText: "Rosalinda", kinds: "report" });
    assert.equal(await fresh.find(b, saved.id, Date.now()), null, "another clinic session");
    assert.equal(await fresh.find({ surface: "admin", sessionTokenHash: a.sessionTokenHash }, saved.id, Date.now()), null, "the other surface with the same hash");
    assert.equal(await fresh.find(admin, saved.id, Date.now()), null, "an admin session");
  });

  await t.test("C9: las lecturas y el barrido usan sus índices", async () => {
    const plan = async (statement: ReturnType<typeof sql>) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`set local enable_seqscan = off`);
        const rows = (await tx.execute(statement)) as unknown as Array<Record<string, string>>;
        return rows.map((row) => Object.values(row)[0]).join("\n");
      });
    const byId = await plan(sql`explain select query_text, kinds from global_search_states where id = ${crypto.randomUUID()}::uuid and surface = 'clinic'`);
    assert.match(byId, /global_search_states_pkey/);
    const sweep = await plan(sql`explain select id from global_search_states where expires_at <= now() order by expires_at limit 50`);
    assert.match(sweep, /global_search_states_expires_at_idx/);
    const mine = await plan(sql`explain select id from global_search_states where clinic_session_token_hash = ${"a".repeat(64)} order by created_at desc`);
    assert.match(mine, /global_search_states_clinic_session_idx/);
  });

  await t.test("C10: ensayo de rollback dentro de una transacción que se revierte", async () => {
    class Revert extends Error {}
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.execute(sql`drop table if exists global_search_states`);
        const rows = (await tx.execute(sql`select to_regclass('global_search_states') as found`)) as unknown as Array<{ found: string | null }>;
        assert.equal(rows[0].found, null, "the rollback statement removes the table");
        throw new Revert();
      }),
      Revert,
    );
    assert.equal(await exists("global_search_states"), true, "the rehearsal left the table in place");
  });
});
