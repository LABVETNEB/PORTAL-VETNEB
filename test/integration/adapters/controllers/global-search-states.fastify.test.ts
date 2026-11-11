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
const {
  GLOBAL_SEARCH_STATE_MAX_PER_SESSION,
  GLOBAL_SEARCH_STATE_TTL_MS,
  resolveGlobalSearchStateExpiry,
} = await import("../../../../server/features/global-search/index.ts");
type RateLimitStore = import("../../../../server/lib/rate-limit-store.ts").RateLimitStore;
type StateRepository = import("../../../../server/features/global-search/index.ts").GlobalSearchStateRepository;

const unlimited = (): RateLimitStore => ({
  get: () => undefined,
  set: () => {},
  consume: (_key, input) => ({ count: 0, resetAt: input.now + input.windowMs }),
});

const CLINIC_A_COOKIE = `${ENV.cookieName}=session-clinic-a`;
const CLINIC_B_COOKIE = `${ENV.cookieName}=session-clinic-b`;
const ADMIN_COOKIE = `${ENV.adminCookieName}=session-admin`;
const SECRET_NAME = "Rosalinda Fernandez";

type Stored = {
  surface: "clinic" | "admin";
  session: string;
  queryText: string;
  kinds: string | null;
  createdAt: number;
  expiresAt: number;
};

/** Contract stand-in of the SQL repository: rows owned by a session, cascade on revoke. */
function memoryRepository() {
  const rows = new Map<string, Stored>();
  const sessions = new Set(["hash:session-clinic-a", "hash:session-clinic-b", "hash:session-admin"]);
  let sequence = 0;
  const repository: StateRepository = {
    async save(owner, record, nowMs) {
      if (!sessions.has(owner.sessionTokenHash)) return null;
      const expires = resolveGlobalSearchStateExpiry(nowMs, null);
      if (!expires) return null;
      const mine = [...rows.entries()].filter(([, row]) => row.session === owner.sessionTokenHash);
      for (const [id, row] of mine) if (row.expiresAt <= nowMs) rows.delete(id);
      const live = [...rows.entries()].filter(([, row]) => row.session === owner.sessionTokenHash);
      const same = live.find(([, row]) => row.queryText === record.queryText && row.kinds === record.kinds);
      if (same) return { id: same[0] };
      const overflow = live.length - (GLOBAL_SEARCH_STATE_MAX_PER_SESSION - 1);
      live
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .slice(0, Math.max(overflow, 0))
        .forEach(([id]) => rows.delete(id));
      sequence += 1;
      const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
      rows.set(id, {
        surface: owner.surface,
        session: owner.sessionTokenHash,
        queryText: record.queryText,
        kinds: record.kinds,
        createdAt: nowMs + sequence,
        expiresAt: expires.getTime(),
      });
      return { id };
    },
    async find(owner, id, nowMs) {
      const row = rows.get(id);
      if (!row || row.surface !== owner.surface || row.session !== owner.sessionTokenHash || row.expiresAt <= nowMs) {
        return null;
      }
      return { queryText: row.queryText, kinds: row.kinds };
    },
  };
  const revoke = (hash: string) => {
    sessions.delete(hash);
    for (const [id, row] of rows) if (row.session === hash) rows.delete(id);
  };
  return { repository, rows, revoke, sessions };
}

async function createApp(options: { now?: () => number; store?: RateLimitStore } = {}) {
  const memory = memoryRepository();
  const future = new Date("2099-01-01T00:00:00.000Z");
  const clinics: Record<string, { clinicUserId: number; clinicId: number }> = {
    "hash:session-clinic-a": { clinicUserId: 101, clinicId: 11 },
    "hash:session-clinic-b": { clinicUserId: 202, clinicId: 22 },
  };
  const app = await createFastifyApp({
    globalSearchStatesRoutes: {
      stateRepository: memory.repository,
      searchRateLimitStore: options.store ?? unlimited(),
      now: options.now,
      hashSessionToken: (token) => `hash:${token}`,
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async (hash) => {
        const session = clinics[hash];
        return session && memory.sessions.has(hash)
          ? { clinicUserId: session.clinicUserId, expiresAt: future, lastAccess: new Date() }
          : null;
      },
      getClinicUserById: async (id) => {
        const entry = Object.values(clinics).find((item) => item.clinicUserId === id);
        return entry ? { id, clinicId: entry.clinicId, username: `user-${id}`, role: "clinic_staff" } : null;
      },
      updateSessionLastAccess: async () => {},
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async (hash) =>
        hash === "hash:session-admin" && memory.sessions.has(hash)
          ? { id: 1, adminUserId: 1, expiresAt: future, lastAccess: new Date() }
          : null,
      getAdminUserById: async (id) => (id === 1 ? { id: 1, username: "admin" } : null),
      updateAdminSessionLastAccess: async () => {},
    },
  });
  return { app, memory };
}

type App = Awaited<ReturnType<typeof createApp>>["app"];

async function save(app: App, cookie: string | undefined, payload: unknown, prefix = "/api/search/states", headers: Record<string, string> = {}) {
  const response = await app.inject({
    method: "POST",
    url: prefix,
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...(cookie ? { cookie } : {}), ...headers },
    payload: JSON.stringify(payload),
  });
  return { response, body: response.json() as { success: boolean; id?: string; error?: string; requestId?: string } };
}

async function load(app: App, cookie: string | undefined, id: string, prefix = "/api/search/states") {
  const response = await app.inject({ method: "GET", url: `${prefix}/${id}`, headers: cookie ? { cookie } : {} });
  return { response, body: response.json() as { success: boolean; q?: string; kinds?: string | null; error?: string; requestId?: string } };
}

test("A4 saves a search and reads it back with the opaque id, privately", async () => {
  const { app } = await createApp();
  const created = await save(app, CLINIC_A_COOKIE, { q: `${SECRET_NAME} type:informe`, kinds: "report" });
  assert.equal(created.response.statusCode, 201);
  assert.match(created.body.id ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(created.response.headers["cache-control"], "no-store");
  assert.ok(!created.response.body.includes(SECRET_NAME), "the id response carries no text");

  const read = await load(app, CLINIC_A_COOKIE, created.body.id!);
  assert.equal(read.response.statusCode, 200);
  assert.equal(read.response.headers["cache-control"], "no-store");
  assert.deepEqual({ q: read.body.q, kinds: read.body.kinds }, { q: `${SECRET_NAME} type:informe`, kinds: "report" });
  await app.close();
});

test("A4 requires the authenticated surface for save and read", async () => {
  const { app } = await createApp();
  assert.equal((await save(app, undefined, { q: "luna" })).response.statusCode, 401);
  assert.equal((await load(app, undefined, "00000000-0000-4000-8000-000000000001")).response.statusCode, 401);
  assert.equal((await save(app, undefined, { q: "luna" }, "/api/admin/search/states")).response.statusCode, 401);
  assert.equal((await save(app, ADMIN_COOKIE, { q: "luna" })).response.statusCode, 401, "admin cookie is not a clinic session");
  assert.equal((await save(app, CLINIC_A_COOKIE, { q: "luna" }, "/api/admin/search/states")).response.statusCode, 401);
  await app.close();
});

test("A4 foreign, malformed, missing and cross-surface ids answer the same 404", async () => {
  const { app } = await createApp();
  const mine = await save(app, CLINIC_A_COOKIE, { q: SECRET_NAME });
  const adminState = await save(app, ADMIN_COOKIE, { q: "luna" }, "/api/admin/search/states");

  const foreign = await load(app, CLINIC_B_COOKIE, mine.body.id!);
  const missing = await load(app, CLINIC_B_COOKIE, "00000000-0000-4000-8000-0000000000ff");
  const malformed = await load(app, CLINIC_B_COOKIE, "not-an-id");
  const crossSurface = await load(app, CLINIC_A_COOKIE, adminState.body.id!);
  const adminReadsClinic = await load(app, ADMIN_COOKIE, mine.body.id!, "/api/admin/search/states");

  for (const attempt of [foreign, missing, malformed, crossSurface, adminReadsClinic]) {
    assert.equal(attempt.response.statusCode, 404);
    assert.deepEqual({ ...attempt.body, requestId: undefined }, { success: false, error: "Búsqueda guardada no disponible", requestId: undefined });
    assert.ok(!attempt.response.body.includes(SECRET_NAME));
  }
  assert.equal((await load(app, CLINIC_A_COOKIE, mine.body.id!)).response.statusCode, 200, "the owner still reads it");
  await app.close();
});

test("A4 a revoked session cannot read or save, and its states are gone", async () => {
  const { app, memory } = await createApp();
  const created = await save(app, CLINIC_A_COOKIE, { q: "luna" });
  memory.revoke("hash:session-clinic-a");
  assert.equal((await load(app, CLINIC_A_COOKIE, created.body.id!)).response.statusCode, 401);
  assert.equal((await save(app, CLINIC_A_COOKIE, { q: "luna" })).response.statusCode, 401);
  assert.ok([...memory.rows.values()].every((row) => row.session !== "hash:session-clinic-a"), "cascade removed the rows");
  await app.close();
});

test("A4 a state expires after 24 hours even though its row still exists", async () => {
  let clock = Date.parse("2026-11-11T12:00:00.000Z");
  const { app, memory } = await createApp({ now: () => clock });
  const created = await save(app, CLINIC_A_COOKIE, { q: "luna" });
  clock += GLOBAL_SEARCH_STATE_TTL_MS - 1000;
  assert.equal((await load(app, CLINIC_A_COOKIE, created.body.id!)).response.statusCode, 200);
  clock += 2000;
  assert.ok(memory.rows.has(created.body.id!), "not physically deleted yet");
  const expired = await load(app, CLINIC_A_COOKIE, created.body.id!);
  assert.equal(expired.response.statusCode, 404);
  assert.deepEqual({ ...expired.body, requestId: undefined }, { success: false, error: "Búsqueda guardada no disponible", requestId: undefined });
  await app.close();
});

test("A4 expiry is the minimum of 24 hours and the session lifetime", () => {
  const now = Date.parse("2026-11-11T12:00:00.000Z");
  assert.equal(resolveGlobalSearchStateExpiry(now, null)?.getTime(), now + GLOBAL_SEARCH_STATE_TTL_MS);
  assert.equal(resolveGlobalSearchStateExpiry(now, new Date(now + 3_600_000))?.getTime(), now + 3_600_000);
  assert.equal(resolveGlobalSearchStateExpiry(now, new Date(now + 3 * GLOBAL_SEARCH_STATE_TTL_MS))?.getTime(), now + GLOBAL_SEARCH_STATE_TTL_MS);
  assert.equal(resolveGlobalSearchStateExpiry(now, new Date(now)), null);
  assert.equal(resolveGlobalSearchStateExpiry(now, new Date(now - 1)), null);
});

test("A4 keeps at most 20 states per session and reuses identical searches", async () => {
  const { app, memory } = await createApp();
  const first = await save(app, CLINIC_A_COOKIE, { q: "serie uno" });
  const again = await save(app, CLINIC_A_COOKIE, { q: "serie  uno" });
  assert.equal(again.body.id, first.body.id, "same canonical text is reused");

  const ids: string[] = [];
  for (let index = 0; index < 24; index += 1) {
    ids.push((await save(app, CLINIC_A_COOKIE, { q: `serie ${index}x` })).body.id!);
  }
  const mine = [...memory.rows.values()].filter((row) => row.session === "hash:session-clinic-a");
  assert.ok(mine.length === GLOBAL_SEARCH_STATE_MAX_PER_SESSION, "capped at 20");
  assert.equal((await load(app, CLINIC_A_COOKIE, first.body.id!)).response.statusCode, 404, "oldest evicted");
  assert.equal((await load(app, CLINIC_A_COOKIE, ids[ids.length - 1])).response.statusCode, 200);

  const other = await save(app, CLINIC_B_COOKIE, { q: "serie 0x" });
  assert.notEqual(other.body.id, ids[0], "another session never shares a state");
  await app.close();
});

test("A4 concurrent saves of the same search converge on the 20 cap contract", async () => {
  const { app, memory } = await createApp();
  await Promise.all(Array.from({ length: 30 }, (_, index) => save(app, CLINIC_A_COOKIE, { q: `rex ${index}y` })));
  const mine = [...memory.rows.values()].filter((row) => row.session === "hash:session-clinic-a");
  assert.ok(mine.length <= GLOBAL_SEARCH_STATE_MAX_PER_SESSION);
  await app.close();
});

test("A4 validates the body: canonical text and surface kinds only", async () => {
  const { app, memory } = await createApp();
  for (const payload of [
    {},
    { q: "" },
    { q: "   " },
    { q: 42 },
    { q: "x".repeat(201) },
    { q: "luna foo:bar" },
    { q: "luna", kinds: "clinic" },
    { q: "luna", kinds: "report,report" },
    { q: "luna", kinds: 7 },
    { q: "luna\u0000" },
  ]) {
    const result = await save(app, CLINIC_A_COOKIE, payload);
    assert.equal(result.response.statusCode, 400, JSON.stringify(payload).slice(0, 40));
    assert.deepEqual({ ...result.body, requestId: undefined }, { success: false, error: "Búsqueda guardada inválida", requestId: undefined });
  }
  assert.equal((await save(app, ADMIN_COOKIE, { q: "luna", kinds: "clinic,report" }, "/api/admin/search/states")).response.statusCode, 201);

  await save(app, CLINIC_A_COOKIE, { q: "luna", cursor: "abc", hits: [{ title: SECRET_NAME }], kinds: "report" });
  const stored = [...memory.rows.values()].find((row) => row.queryText === "luna");
  assert.deepEqual(Object.keys(stored ?? {}).sort(), ["createdAt", "expiresAt", "kinds", "queryText", "session", "surface"]);
  await app.close();
});

test("A4 rejects a save from an untrusted origin (CSRF) and honours the budget", async () => {
  const { app } = await createApp();
  const foreign = await save(app, CLINIC_A_COOKIE, { q: "luna" }, "/api/search/states", { origin: "https://evil.example" });
  assert.equal(foreign.response.statusCode, 403);
  await app.close();

  const exhausted: RateLimitStore = {
    get: () => undefined,
    set: () => {},
    consume: (_key, input) => ({ count: 10_000, resetAt: input.now + input.windowMs }),
  };
  const limited = await createApp({ store: exhausted });
  const blocked = await save(limited.app, CLINIC_A_COOKIE, { q: "luna" });
  assert.equal(blocked.response.statusCode, 429);
  await limited.app.close();
});

test("A4 never writes the saved text to the logs", async () => {
  const { app } = await createApp();
  const captured: string[] = [];
  const originals = { log: console.log, info: console.info, error: console.error, warn: console.warn };
  const record = (...args: unknown[]) => captured.push(args.map(String).join(" "));
  console.log = record;
  console.info = record;
  console.error = record;
  console.warn = record;
  try {
    const created = await save(app, CLINIC_A_COOKIE, { q: SECRET_NAME });
    await load(app, CLINIC_A_COOKIE, created.body.id!);
    await load(app, CLINIC_B_COOKIE, created.body.id!);
  } finally {
    Object.assign(console, originals);
  }
  assert.ok(captured.every((line) => !line.includes("Rosalinda")), "no log line carries the saved text");
  await app.close();
});
