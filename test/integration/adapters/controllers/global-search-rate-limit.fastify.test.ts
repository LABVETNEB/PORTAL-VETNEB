import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { createFastifyApp } = await import("../../../../server/fastify-app.ts");
const { createMemoryRateLimitStore } = await import("../../../../server/lib/rate-limit-store.ts");
type RateLimitStore = import("../../../../server/lib/rate-limit-store.ts").RateLimitStore;
type ClinicRepository = import("../../../../server/features/global-search/index.ts").ClinicGlobalSearchRepository;
type AdminRepository = import("../../../../server/features/global-search/index.ts").AdminGlobalSearchRepository;

const CLINIC_A = 11;
const CLINIC_B = 22;
const FUTURE = new Date("2099-01-01T00:00:00.000Z");

/** Two sessions of one clinic user, a colleague, another tenant, two admins. */
const CLINIC_SESSIONS: Record<string, { clinicUserId: number; clinicId: number }> = {
  "hash:a1": { clinicUserId: 101, clinicId: CLINIC_A },
  "hash:a1-second-tab": { clinicUserId: 101, clinicId: CLINIC_A },
  "hash:a2": { clinicUserId: 102, clinicId: CLINIC_A },
  "hash:b1": { clinicUserId: 202, clinicId: CLINIC_B },
};
const ADMIN_SESSIONS: Record<string, number> = { "hash:admin-1": 1, "hash:admin-2": 2 };

const clinicCookie = (token: string) => `${ENV.cookieName}=${token}`;
const adminCookie = (token: string) => `${ENV.adminCookieName}=${token}`;

type Harness = Awaited<ReturnType<typeof createHarness>>;

async function createHarness(options: { store?: RateLimitStore; clock?: { value: number } } = {}) {
  const clock = options.clock ?? { value: Date.UTC(2026, 10, 6, 12, 0, 0) };
  const store = options.store ?? createMemoryRateLimitStore();
  const searchCalls: string[] = [];
  const consumed: string[] = [];
  const countingStore: RateLimitStore = {
    ...store,
    consume: async (key, input) => {
      consumed.push(key);
      return store.consume!(key, input);
    },
  };
  const none = async (kind: string) => {
    searchCalls.push(kind);
    return [];
  };
  const clinicRepository: ClinicRepository = {
    report: () => none("report"),
    particular_token: () => none("particular_token"),
    tracking_case: () => none("tracking_case"),
  };
  const adminRepository: AdminRepository = {
    clinic: () => none("clinic"),
    report: () => none("report"),
    particular_token: () => none("particular_token"),
    tracking_case: () => none("tracking_case"),
    clinic_user: () => none("clinic_user"),
  };

  const app = await createFastifyApp({
    clinicGlobalSearchRoutes: {
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async (tokenHash) => {
        const session = CLINIC_SESSIONS[tokenHash];
        return session ? { clinicUserId: session.clinicUserId, expiresAt: FUTURE, lastAccess: new Date() } : null;
      },
      getClinicUserById: async (clinicUserId) => {
        const session = Object.values(CLINIC_SESSIONS).find((entry) => entry.clinicUserId === clinicUserId);
        return session
          ? { id: clinicUserId, clinicId: session.clinicId, username: `user-${clinicUserId}`, role: "clinic_staff" }
          : null;
      },
      updateSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
      searchRepository: clinicRepository,
      searchRateLimitStore: countingStore,
      now: () => clock.value,
    },
    adminGlobalSearchRoutes: {
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async (tokenHash) => {
        const adminUserId = ADMIN_SESSIONS[tokenHash];
        return adminUserId ? { id: adminUserId, adminUserId, expiresAt: FUTURE, lastAccess: new Date(clock.value) } : null;
      },
      getAdminUserById: async (adminUserId) => ({ id: adminUserId, username: `admin-${adminUserId}` }),
      updateAdminSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
      searchRepository: adminRepository,
      searchRateLimitStore: countingStore,
      now: () => clock.value,
    },
  });

  return { app, clock, searchCalls, consumed };
}

async function get(harness: Harness, url: string, cookie?: string, origin?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  return harness.app.inject({ method: "GET", url, headers });
}

/** Spends `count` requests of the given URL and asserts they all pass. */
async function spend(harness: Harness, url: string, cookie: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    const response = await get(harness, url, cookie);
    assert.equal(response.statusCode, 200, `request ${index + 1}: ${response.body}`);
  }
}

/** Occurrences of each value: compares whole distributions, not a frozen length. */
function tally(values: readonly (string | number)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[String(value)] = (counts[String(value)] ?? 0) + 1;
  return counts;
}

function assertRejectedSafely(response: Awaited<ReturnType<typeof get>>, leaks: readonly string[] = []) {
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["set-cookie"], undefined, "429 never sets cookies");
  const retryAfter = Number(response.headers["retry-after"]);
  assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1, `Retry-After: ${response.headers["retry-after"]}`);
  assert.equal(response.headers["ratelimit-remaining"], "0");
  const body = response.json<{ success: boolean; error: string }>();
  assert.equal(body.success, false);
  // `requestId` is the app-wide correlation id of every error response.
  assert.deepEqual(Object.keys(body).sort(), ["error", "requestId", "success"]);
  for (const leak of leaks) assert.equal(response.body.includes(leak), false, `429 body leaks ${leak}`);
}

test("GLOBAL-SEARCH-3C clínica: la primera búsqueda pasa con headers de cuota y sin alterar la respuesta", async () => {
  const harness = await createHarness();
  try {
    const response = await get(harness, "/api/search?q=rex", clinicCookie("a1"));

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["ratelimit-policy"], "60;w=10, 600;w=600");
    assert.equal(response.headers["ratelimit-limit"], "60");
    assert.equal(response.headers["ratelimit-remaining"], "57", "Todo over 3 kinds costs 3 units");
    assert.equal(response.headers["ratelimit-reset"], "10");
    assert.equal(response.headers["retry-after"], undefined);
    const body = response.json<Record<string, unknown>>();
    assert.deepEqual(Object.keys(body).sort(), ["groups", "hits", "limit", "offset", "query", "success"]);
    assert.deepEqual(harness.searchCalls.sort(), ["particular_token", "report", "tracking_case"]);
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C clínica: ráfaga legítima, exceso 429 sin SQL y restablecimiento", async () => {
  const harness = await createHarness();
  try {
    // 20 suggestion requests over every kind = 60 units: typing a long query passes.
    await spend(harness, "/api/search?q=rex", clinicCookie("a1"), 20);
    const calls = harness.searchCalls.length;

    harness.clock.value += 4_000;
    const rejected = await get(harness, "/api/search?q=rex", clinicCookie("a1"));
    assertRejectedSafely(rejected, ["rex"]);
    assert.equal(rejected.headers["retry-after"], "6", "until the burst window resets");
    assert.equal(harness.searchCalls.length, calls, "no search SQL after a rejection");

    harness.clock.value += 6_000;
    const restored = await get(harness, "/api/search?q=rex", clinicCookie("a1"));
    assert.equal(restored.statusCode, 200);
    assert.equal(restored.headers["ratelimit-remaining"], "57");
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C clínica: la ventana sostenida corta la automatización continua", async () => {
  const harness = await createHarness();
  try {
    // Ten full bursts, each in its own 10 s window: 600 units in 100 s.
    for (let round = 0; round < 10; round += 1) {
      await spend(harness, "/api/search?q=rex", clinicCookie("a1"), 20);
      harness.clock.value += 10_000;
    }

    const rejected = await get(harness, "/api/search?q=rex&kinds=report", clinicCookie("a1"));
    assertRejectedSafely(rejected);
    assert.equal(rejected.headers["retry-after"], "500", "until the 10 min window resets");
    assert.equal(rejected.headers["ratelimit-limit"], "600");

    harness.clock.value += 500_000;
    assert.equal((await get(harness, "/api/search?q=rex", clinicCookie("a1"))).statusCode, 200);
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C clínica: cambiar consulta, filtros, categoría, clínica o cursor no evade el límite", async () => {
  const harness = await createHarness();
  try {
    await spend(harness, "/api/search?q=rex", clinicCookie("a1"), 20);
    const calls = harness.searchCalls.length;

    for (const url of [
      "/api/search?q=otro%20paciente",
      "/api/search?q=rex&kinds=report",
      "/api/search?q=rex&kinds=report&status=READY&from=2026-01-01",
      `/api/search?q=rex&clinicId=${CLINIC_B}`,
      `/api/search?q=rex&clinicId=${CLINIC_A}`,
      "/api/search?q=rex&kinds=report&limit=25&cursor=forged-cursor-value",
      "/api/search?q=r",
    ]) {
      assertRejectedSafely(await get(harness, url, clinicCookie("a1")), ["otro", "forged-cursor-value", "rex"]);
    }
    assertRejectedSafely(await get(harness, "/api/search?q=rex", clinicCookie("a1-second-tab")));
    assert.equal(harness.searchCalls.length, calls);
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C: los presupuestos se separan por usuario, clínica y superficie", async () => {
  const harness = await createHarness();
  try {
    await spend(harness, "/api/search?q=rex", clinicCookie("a1"), 20);
    assert.equal((await get(harness, "/api/search?q=rex", clinicCookie("a1"))).statusCode, 429);

    for (const [url, cookie] of [
      ["/api/search?q=rex", clinicCookie("a2")],
      ["/api/search?q=rex", clinicCookie("b1")],
      ["/api/admin/search?q=rex", adminCookie("admin-1")],
    ] as const) {
      const response = await get(harness, url, cookie);
      assert.equal(response.statusCode, 200, `${cookie}: a colleague, another tenant and admin keep their budget`);
    }

    assert.ok(harness.consumed.every((key) => !key.includes("rex")));
    assert.deepEqual(
      [...new Set(harness.consumed)].sort(),
      [
        "global-search:v1:admin:user:1:burst",
        "global-search:v1:admin:user:1:sustained",
        "global-search:v1:clinic:11:user:101:burst",
        "global-search:v1:clinic:11:user:101:sustained",
        "global-search:v1:clinic:11:user:102:burst",
        "global-search:v1:clinic:11:user:102:sustained",
        "global-search:v1:clinic:22:user:202:burst",
        "global-search:v1:clinic:22:user:202:sustained",
      ],
    );
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C admin: «Todo» cuesta 5 unidades y el exceso responde 429", async () => {
  const harness = await createHarness();
  try {
    const first = await get(harness, "/api/admin/search?q=rex", adminCookie("admin-1"));
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers["ratelimit-policy"], "100;w=10, 1000;w=600");
    assert.equal(first.headers["ratelimit-remaining"], "95");

    await spend(harness, "/api/admin/search?q=rex", adminCookie("admin-1"), 19);
    const calls = harness.searchCalls.length;
    assertRejectedSafely(await get(harness, "/api/admin/search?q=rex&clinicId=22", adminCookie("admin-1")), ["rex"]);
    assertRejectedSafely(await get(harness, "/api/admin/search?q=rex&clinicId=abc", adminCookie("admin-1")));
    assert.equal(harness.searchCalls.length, calls);

    assert.equal((await get(harness, "/api/admin/search?q=rex", adminCookie("admin-2"))).statusCode, 200);
    // Single-kind cursor windows cost one unit each: a category walk is not starved.
    assert.equal(
      (await get(harness, "/api/admin/search?q=rex&kinds=report&limit=25", adminCookie("admin-2"))).headers[
        "ratelimit-remaining"
      ],
      "94",
    );
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C: 401 sin sesión no consume; 403 y 400 consumen y conservan su status", async () => {
  const harness = await createHarness();
  try {
    assert.equal((await get(harness, "/api/search?q=rex")).statusCode, 401);
    assert.equal((await get(harness, "/api/search?q=rex", clinicCookie("unknown"))).statusCode, 401);
    assert.equal((await get(harness, "/api/admin/search?q=rex")).statusCode, 401);
    assert.equal((await get(harness, "/api/admin/search?q=rex", clinicCookie("a1"))).statusCode, 401);
    assert.deepEqual(harness.consumed, [], "an unauthenticated request never reaches the budget");

    const foreign = await get(harness, `/api/search?q=rex&clinicId=${CLINIC_B}`, clinicCookie("a1"));
    assert.equal(foreign.statusCode, 403);
    assert.equal(foreign.headers["ratelimit-remaining"], "57", "it pays the cost it asked for");

    const invalidCursor = await get(harness, "/api/search?q=rex&kinds=report&cursor=not-a-cursor", clinicCookie("a1"));
    assert.equal(invalidCursor.statusCode, 400);
    assert.equal(invalidCursor.json<{ error: string }>().error, "Cursor de búsqueda inválido");
    assert.equal(invalidCursor.body.includes("not-a-cursor"), false);
    assert.equal(invalidCursor.headers["ratelimit-remaining"], "56");

    assert.equal((await get(harness, "/api/admin/search?q=rex&clinicId=abc", adminCookie("admin-1"))).statusCode, 400);
    assert.deepEqual(harness.searchCalls, []);
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C: las solicitudes concurrentes del mismo usuario no superan el presupuesto", async () => {
  const harness = await createHarness();
  try {
    const responses = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        get(harness, "/api/search?q=rex", clinicCookie(index % 2 === 0 ? "a1" : "a1-second-tab")),
      ),
    );
    const statuses = responses.map((response) => response.statusCode);

    assert.deepEqual(tally(statuses), { 200: 20, 429: 20 });
    assert.deepEqual(tally(harness.searchCalls), { report: 20, particular_token: 20, tracking_case: 20 });
  } finally {
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C: dos instancias que comparten el store comparten el presupuesto", async () => {
  const shared = createMemoryRateLimitStore();
  const clock = { value: Date.UTC(2026, 10, 6, 12, 0, 0) };
  const first = await createHarness({ store: shared, clock });
  const second = await createHarness({ store: shared, clock });
  try {
    await spend(first, "/api/search?q=rex", clinicCookie("a1"), 10);
    await spend(second, "/api/search?q=rex", clinicCookie("a1"), 10);
    assert.equal((await get(first, "/api/search?q=rex", clinicCookie("a1"))).statusCode, 429);
    assert.equal((await get(second, "/api/search?q=rex", clinicCookie("a1"))).statusCode, 429);
  } finally {
    await first.app.close();
    await second.app.close();
  }
});

test("GLOBAL-SEARCH-3C: si el store falla la búsqueda responde 503 sin SQL ni datos sensibles", async () => {
  const failing: RateLimitStore = {
    get: () => undefined,
    set: () => {},
    consume: async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    },
  };
  const harness = await createHarness({ store: failing });
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  try {
    for (const [url, cookie] of [
      ["/api/search?q=secreto&kinds=report&cursor=opaque-cursor", clinicCookie("a1")],
      ["/api/admin/search?q=secreto", adminCookie("admin-1")],
    ] as const) {
      const response = await get(harness, url, cookie);
      assert.equal(response.statusCode, 503);
      assert.equal(response.headers["retry-after"], "5");
      assert.equal(response.headers["cache-control"], "no-store");
      assert.equal(response.headers["set-cookie"], undefined);
      assert.equal(/secreto|opaque-cursor|ECONNREFUSED/.test(response.body), false);
    }
    assert.deepEqual(harness.searchCalls, [], "the protection never fails open");

    const events = logged.filter((line) => line.includes("GLOBAL_SEARCH_RATE_LIMIT_STORE_ERROR"));
    assert.deepEqual(
      events.map((line) => (line.includes('"surface":"admin"') ? "admin" : "clinic")).sort(),
      ["admin", "clinic"],
    );
    for (const line of events) {
      for (const leak of ["secreto", "opaque-cursor", "global-search:v1", clinicCookie("a1"), adminCookie("admin-1")]) {
        assert.equal(line.includes(leak), false, `${leak} in ${line}`);
      }
    }
  } finally {
    console.error = originalError;
    await harness.app.close();
  }
});

test("GLOBAL-SEARCH-3C: CORS expone Retry-After y los headers de cuota", async () => {
  const harness = await createHarness();
  try {
    const origin = ENV.corsOrigins[0];
    assert.ok(origin, "development always allows the local origins");
    for (const url of ["/api/search?q=rex", "/api/admin/search?q=rex"]) {
      const cookie = url.startsWith("/api/admin") ? adminCookie("admin-1") : clinicCookie("a1");
      const response = await get(harness, url, cookie, origin);
      assert.equal(response.headers["access-control-allow-origin"], origin);
      const exposed = String(response.headers["access-control-expose-headers"] ?? "");
      for (const header of ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"]) {
        assert.ok(exposed.includes(header), `${url} exposes ${header}`);
      }
    }
    const foreign = await get(harness, "/api/search?q=rex", clinicCookie("a1"), "https://evil.example");
    assert.equal(foreign.headers["access-control-expose-headers"], undefined);
  } finally {
    await harness.app.close();
  }
});
