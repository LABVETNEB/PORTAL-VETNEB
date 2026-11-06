import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";
import { inArray } from "drizzle-orm";

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
    "GLOBAL-SEARCH-3C-DB requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci",
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_DB_URL = databaseUrl;

const { db, closeDbConnection, pgClient } = await import("../../../server/db.ts");
const { createFastifyApp } = await import("../../../server/fastify-app.ts");
const { ENV } = await import("../../../server/lib/env.ts");
const { clinics, loginRateLimits, reports } = await import("../../../drizzle/schema.ts");
const { buildGlobalSearchRateLimitKey, createDefaultGlobalSearchRateLimitStore } = await import(
  "../../../server/lib/global-search-rate-limit.ts"
);
const { consumeRateLimitAttempt, hashRateLimitKey } = await import("../../../server/lib/rate-limit-store.ts");
type RateLimitStore = import("../../../server/lib/rate-limit-store.ts").RateLimitStore;

const REPORTS_PER_CLINIC = 2_000;
const LATENCY_SAMPLES = 40;
/** Server-side p95 budget for one search, now including the budget charge. */
const P95_BUDGET_MS = 750;
const FUTURE = new Date("2099-01-01T00:00:00.000Z");

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

function summary(samples: number[]) {
  return { p50: Number(percentile(samples, 50).toFixed(1)), p95: Number(percentile(samples, 95).toFixed(1)) };
}

test("GLOBAL-SEARCH-3C-DB: presupuesto atómico y compartido entre instancias sobre PostgreSQL real", async (t) => {
  const suffix = `${process.pid}-${Date.now()}`;
  // Synthetic actor ids, unique per run: the budget rows never collide with another run.
  const userBase = 1_000_000_000 + (Date.now() % 100_000_000);
  const clinicIds: number[] = [];
  const keys: string[] = [];
  const clock = { offset: 0 };

  t.after(async () => {
    try {
      if (keys.length > 0) {
        await db.delete(loginRateLimits).where(inArray(loginRateLimits.keyHash, keys.map(hashRateLimitKey)));
      }
      if (clinicIds.length > 0) {
        await db.delete(clinics).where(inArray(clinics.id, clinicIds));
      }
    } finally {
      await closeDbConnection();
    }
  });

  for (const label of ["A", "B"]) {
    const [clinic] = await pgClient<{ id: number }[]>`
      insert into clinics (clinic_id, name)
      values (${`gs3c-${label}-${suffix}`}, ${`GS3C Clinica ${label} ${suffix}`})
      returning id
    `;
    assert.ok(clinic);
    clinicIds.push(clinic.id);
  }
  const [clinicA, clinicB] = clinicIds as [number, number];
  const base = Date.UTC(2026, 0, 1);
  for (const [clinicId, label] of [[clinicA, "A"], [clinicB, "B"]] as const) {
    await db.insert(reports).values(
      Array.from({ length: REPORTS_PER_CLINIC }, (_, index) => ({
        clinicId,
        patientName: `Paciente ${label}-${index} ${suffix}`,
        fileName: `gs3c-${label}-${index}.pdf`,
        studyType: index % 2 === 0 ? "citologia" : "histopatologia",
        storagePath: `synthetic/gs3c/${suffix}/${label}/${index}.pdf`,
        createdAt: new Date(base + index * 60_000),
        uploadDate: new Date(base + index * 60_000),
      })),
    );
  }
  await pgClient`analyze reports`;

  const clinicOf = (userId: number) => (userId - userBase >= 500 ? clinicB : clinicA);
  const track = (actor: Parameters<typeof buildGlobalSearchRateLimitKey>[0]) => {
    keys.push(buildGlobalSearchRateLimitKey(actor, "burst"), buildGlobalSearchRateLimitKey(actor, "sustained"));
  };

  /** One backend instance: real search SQL and, unless overridden, the real persistent budget. */
  const instance = (searchRateLimitStore?: RateLimitStore) =>
    createFastifyApp({
      clinicGlobalSearchRoutes: {
        deleteActiveSession: async () => {},
        getActiveSessionByToken: async (hash) => {
          const id = Number(hash.replace("hash:c", ""));
          return Number.isInteger(id) && id > 0 ? { clinicUserId: id, expiresAt: FUTURE, lastAccess: new Date() } : null;
        },
        getClinicUserById: async (id) => ({ id, clinicId: clinicOf(id), username: `u${id}`, role: "clinic_staff" }),
        updateSessionLastAccess: async () => {},
        hashSessionToken: (token) => `hash:${token}`,
        ...(searchRateLimitStore ? { searchRateLimitStore } : {}),
        now: () => Date.now() + clock.offset,
      },
      adminGlobalSearchRoutes: {
        deleteAdminSession: async () => {},
        getAdminSessionByToken: async (hash) => {
          const id = Number(hash.replace("hash:a", ""));
          return Number.isInteger(id) && id > 0 ? { id, adminUserId: id, expiresAt: FUTURE, lastAccess: new Date() } : null;
        },
        getAdminUserById: async (id) => ({ id, username: `admin${id}` }),
        updateAdminSessionLastAccess: async () => {},
        hashSessionToken: (token) => `hash:${token}`,
        ...(searchRateLimitStore ? { searchRateLimitStore } : {}),
        now: () => Date.now() + clock.offset,
      },
    });

  const first = await instance();
  const second = await instance();
  const unlimited = await instance({
    get: () => undefined,
    set: () => {},
    consume: (_key, input) => ({ count: 0, resetAt: input.now + input.windowMs }),
  });
  t.after(async () => {
    await first.close();
    await second.close();
    await unlimited.close();
  });

  const clinicCookie = (userId: number) => `${ENV.cookieName}=c${userId}`;
  const adminCookie = (userId: number) => `${ENV.adminCookieName}=a${userId}`;
  const query = `paciente a- ${suffix}`;
  const todo = `/api/search?q=${encodeURIComponent(query)}`;

  // 1. Two instances, 60 concurrent «Todo» requests (3 units each) of ONE user.
  const user = userBase + 1;
  track({ surface: "clinic", clinicId: clinicA, userId: user });
  const burst = await Promise.all(
    Array.from({ length: 60 }, (_, index) =>
      (index % 2 === 0 ? first : second).inject({ method: "GET", url: todo, headers: { cookie: clinicCookie(user) } }),
    ),
  );
  const statuses = burst.map((response) => response.statusCode);
  const tally: Record<number, number> = {};
  for (const status of statuses) tally[status] = (tally[status] ?? 0) + 1;
  assert.deepEqual(tally, { 200: 20, 429: 40 }, "exactly the 60-unit burst passes");
  for (const response of burst.filter((entry) => entry.statusCode === 429)) {
    assert.ok(Number(response.headers["retry-after"]) >= 1);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.includes(suffix), false);
  }

  // 2. Persisted rows: one per window, only the hash, every charge counted once.
  const rows = await pgClient<{ key_hash: string; count: number; surface: string | null }[]>`
    select key_hash, count, surface from login_rate_limits
    where key_hash in ${pgClient(keys.slice(0, 2).map(hashRateLimitKey))}
  `;
  assert.deepEqual(rows.map((row) => row.count).sort(), [180, 180]);
  assert.ok(rows.every((row) => row.surface === null));
  const [{ clear }] = await pgClient<{ clear: number }[]>`
    select count(*)::int as clear from login_rate_limits where key_hash like 'global-search:%'
  `;
  assert.equal(clear, 0, "no clear-text key is ever stored");

  // 3. Other actors keep their own budget; the exhausted one is rejected on both instances.
  const colleague = userBase + 2;
  const otherTenant = userBase + 600;
  const admin = userBase + 3;
  track({ surface: "clinic", clinicId: clinicA, userId: colleague });
  track({ surface: "clinic", clinicId: clinicB, userId: otherTenant });
  track({ surface: "admin", userId: admin });
  for (const [app, url, cookie] of [
    [second, todo, clinicCookie(colleague)],
    [first, todo, clinicCookie(otherTenant)],
    [second, `/api/admin/search?q=${encodeURIComponent(query)}`, adminCookie(admin)],
  ] as const) {
    assert.equal((await app.inject({ method: "GET", url, headers: { cookie } })).statusCode, 200);
  }
  for (const app of [first, second]) {
    assert.equal((await app.inject({ method: "GET", url: todo, headers: { cookie: clinicCookie(user) } })).statusCode, 429);
  }

  // 4. The burst window resets in the database for every instance.
  clock.offset += 11_000;
  const restored = await second.inject({ method: "GET", url: todo, headers: { cookie: clinicCookie(user) } });
  assert.equal(restored.statusCode, 200);
  assert.equal(restored.headers["ratelimit-remaining"], "57");
  clock.offset = 0;

  // 5. Latency with and without the budget, interleaved, one fresh actor per sample.
  const withBudget: number[] = [];
  const withoutBudget: number[] = [];
  const adminWithBudget: number[] = [];
  const adminWithoutBudget: number[] = [];
  const timed = async (samples: number[], app: typeof first, url: string, cookie: string) => {
    const started = performance.now();
    const response = await app.inject({ method: "GET", url, headers: { cookie } });
    samples.push(performance.now() - started);
    assert.equal(response.statusCode, 200, response.body);
  };
  for (let index = 0; index < LATENCY_SAMPLES; index += 1) {
    const clinicUser = userBase + 100 + index;
    const adminUser = userBase + 300 + index;
    track({ surface: "clinic", clinicId: clinicA, userId: clinicUser });
    track({ surface: "admin", userId: adminUser });
    const url = `/api/search?q=${encodeURIComponent(`paciente a-${index * 7} ${suffix}`)}`;
    const adminUrl = `/api/admin/search?q=${encodeURIComponent(`paciente a-${index * 7} ${suffix}`)}`;
    await timed(withBudget, first, url, clinicCookie(clinicUser));
    await timed(withoutBudget, unlimited, url, clinicCookie(clinicUser));
    await timed(adminWithBudget, second, adminUrl, adminCookie(adminUser));
    await timed(adminWithoutBudget, unlimited, adminUrl, adminCookie(adminUser));
  }

  const store = await createDefaultGlobalSearchRateLimitStore();
  const charges: number[] = [];
  for (let index = 0; index < LATENCY_SAMPLES; index += 1) {
    const key = buildGlobalSearchRateLimitKey({ surface: "admin", userId: userBase + 900 + index }, "burst");
    keys.push(key);
    const started = performance.now();
    await consumeRateLimitAttempt(store, key, { windowMs: 10_000, now: Date.now(), units: 5 });
    charges.push(performance.now() - started);
  }

  const measured = {
    clinicTodo: { withBudget: summary(withBudget), withoutBudget: summary(withoutBudget) },
    adminTodo: { withBudget: summary(adminWithBudget), withoutBudget: summary(adminWithoutBudget) },
    budgetCharge: summary(charges),
  };
  t.diagnostic(`GLOBAL-SEARCH-3C latency (ms, ${REPORTS_PER_CLINIC * 2} reports): ${JSON.stringify(measured)}`);
  assert.ok(measured.clinicTodo.withBudget.p95 < P95_BUDGET_MS);
  assert.ok(measured.adminTodo.withBudget.p95 < P95_BUDGET_MS);
});
