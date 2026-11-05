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
type ClinicRepository = import("../../../../server/features/global-search/index.ts").ClinicGlobalSearchRepository;
type AdminRepository = import("../../../../server/features/global-search/index.ts").AdminGlobalSearchRepository;
type Criteria = import("../../../../server/features/global-search/index.ts").GlobalSearchCriteria;
type Hit = import("../../../../server/features/global-search/index.ts").GlobalSearchHit;
type Kind = import("../../../../server/features/global-search/index.ts").GlobalSearchKind;

const CLINIC_A = 11;
const CLINIC_B = 22;
const CLINIC_A_COOKIE = `${ENV.cookieName}=session-clinic-a`;
const CLINIC_B_COOKIE = `${ENV.cookieName}=session-clinic-b`;
const ADMIN_COOKIE = `${ENV.adminCookieName}=session-admin`;

type Row = {
  kind: Kind;
  id: number;
  clinicId: number;
  title: string;
  date: string;
};

function synthetic(): Row[] {
  const rows: Row[] = [];

  for (let index = 1; index <= 60; index += 1) {
    rows.push({
      kind: "report",
      id: index,
      clinicId: CLINIC_A,
      title: index === 1 ? "Ñandú Pérez" : `Paciente A-${index}`,
      date: new Date(Date.UTC(2026, 0, index)).toISOString(),
    });
  }

  rows.push(
    { kind: "report", id: 900, clinicId: CLINIC_B, title: "Ñandú Pérez", date: "2026-05-01T00:00:00.000Z" },
    { kind: "report", id: 901, clinicId: CLINIC_B, title: "Exclusivo Clinica B", date: "2026-05-02T00:00:00.000Z" },
    { kind: "particular_token", id: 300, clinicId: CLINIC_A, title: "Rex", date: "2026-02-01T00:00:00.000Z" },
    { kind: "particular_token", id: 301, clinicId: CLINIC_B, title: "Rex", date: "2026-02-02T00:00:00.000Z" },
    { kind: "tracking_case", id: 70, clinicId: CLINIC_A, title: "Rex", date: "2026-02-03T00:00:00.000Z" },
    { kind: "clinic", id: CLINIC_A, clinicId: CLINIC_A, title: "Clinica Norte", date: "2026-01-01T00:00:00.000Z" },
    { kind: "clinic", id: CLINIC_B, clinicId: CLINIC_B, title: "Clinica Sur", date: "2026-01-01T00:00:00.000Z" },
    { kind: "clinic_user", id: 5, clinicId: CLINIC_B, title: "rex.recepcion", date: "2026-01-01T00:00:00.000Z" },
  );

  return rows;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * In-memory stand-in with the SAME contract as the SQL repository: tenant
 * predicate, accent/case folding, rank, recency order and limit+1 window.
 */
function search(rows: Row[], kind: Kind, criteria: Criteria, clinicId: number | null, calls: string[]): Hit[] {
  calls.push(`${kind}:${clinicId ?? "*"}`);
  const needle = fold(criteria.needle.text);

  return rows
    .filter((row) => row.kind === kind)
    .filter((row) => clinicId === null || row.clinicId === clinicId)
    .filter((row) => criteria.needle.numericId === row.id || fold(row.title).includes(needle))
    .map<Hit>((row) => ({
      kind: row.kind,
      id: row.id,
      title: row.title,
      subtitle: null,
      status: null,
      date: row.date,
      facts: [],
      clinic: null,
      target: {
        reportId: row.kind === "report" ? row.id : null,
        particularTokenId: row.kind === "particular_token" ? row.id : null,
        studyTrackingCaseId: row.kind === "tracking_case" ? row.id : null,
        clinicId: row.clinicId,
        clinicUserId: row.kind === "clinic_user" ? row.id : null,
      },
      rank:
        criteria.needle.numericId === row.id
          ? 0
          : fold(row.title) === needle
            ? 1
            : fold(row.title).startsWith(needle)
              ? 2
              : 3,
    }))
    .sort((a, b) => a.rank - b.rank || Date.parse(b.date ?? "") - Date.parse(a.date ?? "") || b.id - a.id)
    .slice(criteria.offset, criteria.offset + criteria.limit + 1);
}

function clinicRepository(rows: Row[], calls: string[]): ClinicRepository {
  return {
    report: async (clinicId, criteria) => search(rows, "report", criteria, clinicId, calls),
    particular_token: async (clinicId, criteria) => search(rows, "particular_token", criteria, clinicId, calls),
    tracking_case: async (clinicId, criteria) => search(rows, "tracking_case", criteria, clinicId, calls),
  };
}

function adminRepository(rows: Row[], calls: string[]): AdminRepository {
  return {
    clinic: async (criteria, clinicId) => search(rows, "clinic", criteria, clinicId, calls),
    report: async (criteria, clinicId) => search(rows, "report", criteria, clinicId, calls),
    particular_token: async (criteria, clinicId) => search(rows, "particular_token", criteria, clinicId, calls),
    tracking_case: async (criteria, clinicId) => search(rows, "tracking_case", criteria, clinicId, calls),
    clinic_user: async (criteria, clinicId) => search(rows, "clinic_user", criteria, clinicId, calls),
  };
}

const CLINIC_SESSIONS: Record<string, { clinicUserId: number; clinicId: number }> = {
  "hash:session-clinic-a": { clinicUserId: 101, clinicId: CLINIC_A },
  "hash:session-clinic-b": { clinicUserId: 202, clinicId: CLINIC_B },
};

async function createApp(overrides: { clinicRepository?: ClinicRepository; adminRepository?: AdminRepository } = {}) {
  const rows = synthetic();
  const calls: string[] = [];
  const future = new Date("2099-01-01T00:00:00.000Z");

  const app = await createFastifyApp({
    clinicGlobalSearchRoutes: {
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async (tokenHash) => {
        const session = CLINIC_SESSIONS[tokenHash];
        return session ? { clinicUserId: session.clinicUserId, expiresAt: future, lastAccess: new Date() } : null;
      },
      getClinicUserById: async (clinicUserId) => {
        const session = Object.values(CLINIC_SESSIONS).find((entry) => entry.clinicUserId === clinicUserId);
        return session
          ? { id: clinicUserId, clinicId: session.clinicId, username: `user-${clinicUserId}`, role: "clinic_staff" }
          : null;
      },
      updateSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
      searchRepository: overrides.clinicRepository ?? clinicRepository(rows, calls),
    },
    adminGlobalSearchRoutes: {
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async (tokenHash) =>
        tokenHash === "hash:session-admin" ? { id: 1, adminUserId: 1, expiresAt: future, lastAccess: new Date() } : null,
      getAdminUserById: async (adminUserId) => (adminUserId === 1 ? { id: 1, username: "admin" } : null),
      updateAdminSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
      searchRepository: overrides.adminRepository ?? adminRepository(rows, calls),
    },
  });

  return { app, calls };
}

type Body = {
  success: boolean;
  error?: string;
  hits?: Hit[];
  groups?: Array<{ kind: string; returned: number; hasMore: boolean }>;
};

async function get(app: Awaited<ReturnType<typeof createApp>>["app"], url: string, cookie?: string) {
  const response = await app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });
  return { response, body: response.json<Body>() };
}

test("global search clínica: sin sesión responde 401 sin consultar", async () => {
  const { app, calls } = await createApp();
  try {
    const { response } = await get(app, "/api/search?q=rex");
    assert.equal(response.statusCode, 401);
    assert.deepEqual(calls, []);
  } finally {
    await app.close();
  }
});

test("global search clínica: encuentra su informe fuera de la primera página del listado", async () => {
  const { app, calls } = await createApp();
  try {
    // id 1 is the OLDEST of 60 reports: outside the 50-row first page of /api/reports.
    const { response, body } = await get(app, "/api/search?q=%C3%91and%C3%BA%20P%C3%A9rez", CLINIC_A_COOKIE);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(body.hits?.map((hit) => `${hit.kind}:${hit.id}`), ["report:1"]);
    assert.equal(body.hits?.[0]?.target.reportId, 1);
    assert.ok(calls.every((call) => call.endsWith(`:${CLINIC_A}`)), calls.join(","));
  } finally {
    await app.close();
  }
});

test("global search clínica: tildes y mayúsculas no afectan la coincidencia", async () => {
  const { app } = await createApp();
  try {
    for (const q of ["nandu perez", "NANDU", "ñandú"]) {
      const { body } = await get(app, `/api/search?q=${encodeURIComponent(q)}`, CLINIC_A_COOKIE);
      assert.ok(body.hits?.some((hit) => hit.kind === "report" && hit.id === 1), q);
    }
  } finally {
    await app.close();
  }
});

test("global search clínica: nunca devuelve registros de otra clínica", async () => {
  const { app, calls } = await createApp();
  try {
    const own = await get(app, "/api/search?q=Rex", CLINIC_A_COOKIE);
    assert.deepEqual(
      own.body.hits?.map((hit) => `${hit.kind}:${hit.id}`).sort(),
      ["particular_token:300", "tracking_case:70"],
    );

    const foreign = await get(app, "/api/search?q=Exclusivo", CLINIC_A_COOKIE);
    assert.equal(foreign.response.statusCode, 200);
    assert.deepEqual(foreign.body.hits, []);
    assert.ok(foreign.body.groups?.every((group) => group.returned === 0 && !group.hasMore));

    const other = await get(app, "/api/search?q=Exclusivo", CLINIC_B_COOKIE);
    assert.deepEqual(other.body.hits?.map((hit) => hit.id), [901]);
    assert.ok(calls.some((call) => call.endsWith(`:${CLINIC_B}`)));
  } finally {
    await app.close();
  }
});

test("global search clínica: un clinicId ajeno es 403 antes de consultar", async () => {
  const { app, calls } = await createApp();
  try {
    const { response, body } = await get(app, `/api/search?q=Exclusivo&clinicId=${CLINIC_B}`, CLINIC_A_COOKIE);
    assert.equal(response.statusCode, 403);
    assert.equal(body.hits, undefined);
    assert.deepEqual(calls, []);

    const ownScope = await get(app, `/api/search?q=Rex&clinicId=${CLINIC_A}`, CLINIC_A_COOKIE);
    assert.equal(ownScope.response.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("global search clínica: no expone entidades administrativas", async () => {
  const { app } = await createApp();
  try {
    const { response } = await get(app, "/api/search?q=rex&kinds=clinic_user", CLINIC_A_COOKIE);
    assert.equal(response.statusCode, 400);

    const all = await get(app, "/api/search?q=rex", CLINIC_A_COOKIE);
    assert.deepEqual(all.body.groups?.map((group) => group.kind), ["report", "particular_token", "tracking_case"]);
  } finally {
    await app.close();
  }
});

test("global search clínica: pagina del lado del servidor con hasMore", async () => {
  const { app } = await createApp();
  try {
    const first = await get(app, "/api/search?q=paciente&kinds=report&limit=25", CLINIC_A_COOKIE);
    const second = await get(app, "/api/search?q=paciente&kinds=report&limit=25&offset=25", CLINIC_A_COOKIE);
    const third = await get(app, "/api/search?q=paciente&kinds=report&limit=25&offset=50", CLINIC_A_COOKIE);

    // "Paciente A-2".."Paciente A-60", newest first.
    const expected = Array.from({ length: 59 }, (_, index) => 60 - index);
    const ids = [first, second, third].map((page) => page.body.hits?.map((hit) => hit.id));

    assert.deepEqual(ids, [expected.slice(0, 25), expected.slice(25, 50), expected.slice(50)]);
    assert.deepEqual(
      [first, second, third].map((page) => page.body.groups?.[0]?.hasMore),
      [true, true, false],
    );
  } finally {
    await app.close();
  }
});

test("global search clínica: consultas inválidas son 400 y no consultan", async () => {
  const { app, calls } = await createApp();
  try {
    for (const url of [
      "/api/search",
      "/api/search?q=a",
      "/api/search?q=rex&limit=0",
      "/api/search?q=rex&offset=5",
      "/api/search?q=rex&status=borrado",
    ]) {
      const { response } = await get(app, url, CLINIC_A_COOKIE);
      assert.equal(response.statusCode, 400, url);
    }
    assert.deepEqual(calls, []);
  } finally {
    await app.close();
  }
});

test("global search clínica: un fallo del repositorio es 500 genérico sin filtrar detalles", async () => {
  const failing: ClinicRepository = {
    report: async () => {
      throw new Error('relation "reports" password=secret');
    },
    particular_token: async () => [],
    tracking_case: async () => [],
  };
  const { app } = await createApp({ clinicRepository: failing });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const { response } = await get(app, "/api/search?q=rex", CLINIC_A_COOKIE);
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.includes("password"), false);
    assert.equal(response.body.includes("relation"), false);
  } finally {
    console.error = originalConsoleError;
    await app.close();
  }
});

test("global search admin: la sesión de clínica no autentica la superficie admin", async () => {
  const { app, calls } = await createApp();
  try {
    assert.equal((await get(app, "/api/admin/search?q=rex")).response.statusCode, 401);
    assert.equal((await get(app, "/api/admin/search?q=rex", CLINIC_A_COOKIE)).response.statusCode, 401);
    assert.deepEqual(calls, []);
  } finally {
    await app.close();
  }
});

test("global search admin: busca varias entidades de todas las clínicas desde un campo", async () => {
  const { app } = await createApp();
  try {
    const { response, body } = await get(app, "/api/admin/search?q=rex", ADMIN_COOKIE);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(
      body.hits?.map((hit) => `${hit.kind}:${hit.id}`).sort(),
      ["clinic_user:5", "particular_token:300", "particular_token:301", "tracking_case:70"],
    );
    assert.deepEqual(
      body.groups?.map((group) => group.kind),
      ["clinic", "report", "particular_token", "tracking_case", "clinic_user"],
    );
  } finally {
    await app.close();
  }
});

test("global search admin: clinicId acota sin ampliar y se valida", async () => {
  const { app, calls } = await createApp();
  try {
    const { body } = await get(app, `/api/admin/search?q=rex&clinicId=${CLINIC_B}`, ADMIN_COOKIE);
    assert.deepEqual(
      body.hits?.map((hit) => `${hit.kind}:${hit.id}`).sort(),
      ["clinic_user:5", "particular_token:301"],
    );
    assert.ok(calls.every((call) => call.endsWith(`:${CLINIC_B}`)));

    assert.equal((await get(app, "/api/admin/search?q=rex&clinicId=abc", ADMIN_COOKIE)).response.statusCode, 400);
    assert.equal((await get(app, "/api/admin/search?q=rex&clinicId=0", ADMIN_COOKIE)).response.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("global search admin: id numérico encuentra el registro exacto primero", async () => {
  const { app } = await createApp();
  try {
    const { body } = await get(app, "/api/admin/search?q=%23901", ADMIN_COOKIE);
    assert.equal(body.hits?.[0]?.kind, "report");
    assert.equal(body.hits?.[0]?.id, 901);
    assert.equal(body.hits?.[0]?.rank, 0);
  } finally {
    await app.close();
  }
});
