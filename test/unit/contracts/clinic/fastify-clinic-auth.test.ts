import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { authenticateFastifyClinicUser } = await import(
  "../../../../server/lib/fastify-clinic-auth.ts"
);

type ClinicAuthDeps = Parameters<typeof authenticateFastifyClinicUser>[2];

function createRequest(token = "clinic-session-token") {
  return {
    headers: token
      ? { cookie: `${ENV.cookieName}=${encodeURIComponent(token)}` }
      : {},
  };
}

function createReply() {
  return {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    payload: undefined as unknown,
    code(code: number) {
      this.statusCode = code;
      return this;
    },
    header(name: string, value: unknown) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function createDeps(overrides: Partial<ClinicAuthDeps> = {}) {
  const calls = {
    deleteActiveSession: [] as string[],
    getActiveSessionByToken: [] as string[],
    getClinicUserById: [] as number[],
    updateSessionLastAccess: [] as string[],
  };

  return {
    calls,
    deleteActiveSession: async (tokenHash: string) => {
      calls.deleteActiveSession.push(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) => {
      calls.getActiveSessionByToken.push(tokenHash);
      return {
        clinicUserId: 7,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        lastAccess: new Date("2026-06-03T10:00:00.000Z"),
      };
    },
    getClinicUserById: async (clinicUserId: number) => {
      calls.getClinicUserById.push(clinicUserId);
      return {
        id: clinicUserId,
        clinicId: 3,
        username: "clinic-user",
        authProId: null,
        role: "clinic_staff" as const,
      };
    },
    updateSessionLastAccess: async (tokenHash: string) => {
      calls.updateSessionLastAccess.push(tokenHash);
    },
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  } satisfies ClinicAuthDeps & { calls: typeof calls };
}

const now = () => Date.parse("2026-06-03T12:00:00.000Z");

test("clinic auth rejects a missing cookie before database access", async () => {
  const deps = createDeps();
  const reply = createReply();

  const actor = await authenticateFastifyClinicUser(
    createRequest("") as any,
    reply as any,
    deps,
    now,
  );

  assert.equal(actor, null);
  assert.equal(reply.statusCode, 401);
  assert.deepEqual(reply.payload, { success: false, error: "No autenticado" });
  assert.deepEqual(deps.calls.getActiveSessionByToken, []);
});

test("clinic auth rejects an unknown session with the canonical message", async () => {
  const deps = createDeps({ getActiveSessionByToken: async () => null });
  const reply = createReply();

  const actor = await authenticateFastifyClinicUser(
    createRequest() as any,
    reply as any,
    deps,
    now,
  );

  assert.equal(actor, null);
  assert.deepEqual(reply.payload, { success: false, error: "Sesión inválida" });
  assert.deepEqual(deps.calls.deleteActiveSession, []);
  assert.deepEqual(deps.calls.getClinicUserById, []);
});

test("clinic auth expires and clears a stale session without reading its user", async () => {
  const deps = createDeps({
    getActiveSessionByToken: async () => ({
      clinicUserId: 7,
      expiresAt: new Date("2026-06-03T11:59:59.000Z"),
      lastAccess: null,
    }),
  });
  const reply = createReply();

  const actor = await authenticateFastifyClinicUser(
    createRequest() as any,
    reply as any,
    deps,
    now,
  );

  assert.equal(actor, null);
  assert.deepEqual(reply.payload, { success: false, error: "Sesión expirada" });
  assert.deepEqual(deps.calls.deleteActiveSession, ["hash:clinic-session-token"]);
  assert.deepEqual(deps.calls.getClinicUserById, []);
  assert.match(String(reply.headers["set-cookie"]), /Max-Age=0/);
});

test("clinic auth removes a session whose clinic user no longer exists", async () => {
  const deps = createDeps({ getClinicUserById: async () => null });
  const reply = createReply();

  const actor = await authenticateFastifyClinicUser(
    createRequest() as any,
    reply as any,
    deps,
    now,
  );

  assert.equal(actor, null);
  assert.deepEqual(reply.payload, {
    success: false,
    error: "Usuario de sesión no encontrado",
  });
  assert.deepEqual(deps.calls.deleteActiveSession, ["hash:clinic-session-token"]);
  assert.match(String(reply.headers["set-cookie"]), /Max-Age=0/);
});

test("clinic auth returns the authenticated actor and normalizes its role", async () => {
  const deps = createDeps({
    getClinicUserById: async () => ({
      id: 7,
      clinicId: 3,
      username: "clinic-user",
      authProId: "auth-pro-7",
      role: null,
      // WBR-08c: passwordHash is passed through (needed by auth.fastify.ts's
      // /change-password) without being used by any other consumer.
      passwordHash: "hash-7",
    }),
  });
  const reply = createReply();

  const actor = await authenticateFastifyClinicUser(
    createRequest() as any,
    reply as any,
    deps,
    now,
  );

  assert.deepEqual(actor, {
    id: 7,
    clinicId: 3,
    username: "clinic-user",
    authProId: "auth-pro-7",
    role: "clinic_staff",
    sessionToken: "clinic-session-token",
    passwordHash: "hash-7",
  });
  assert.deepEqual(deps.calls.updateSessionLastAccess, ["hash:clinic-session-token"]);
});

test("clinic auth does not refresh a recently accessed session", async () => {
  const deps = createDeps({
    getActiveSessionByToken: async () => ({
      clinicUserId: 7,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-06-03T11:59:00.000Z"),
    }),
  });

  await authenticateFastifyClinicUser(
    createRequest() as any,
    createReply() as any,
    deps,
    now,
  );

  assert.deepEqual(deps.calls.updateSessionLastAccess, []);
});

test("clinic auth allows per-consumer message overrides", async () => {
  const deps = createDeps({
    getActiveSessionByToken: async () => null,
    messages: { invalid_session: "Sesión de clínica inválida" },
  });
  const reply = createReply();

  await authenticateFastifyClinicUser(
    createRequest() as any,
    reply as any,
    deps,
    now,
  );

  assert.deepEqual(reply.payload, {
    success: false,
    error: "Sesión de clínica inválida",
  });
});

test("clinic auth lets dependency failures reach the route error boundary without leaking them", async () => {
  const deps = createDeps({
    getActiveSessionByToken: async () => {
      throw new Error("internal database failure");
    },
  });
  const reply = createReply();

  await assert.rejects(
    authenticateFastifyClinicUser(createRequest() as any, reply as any, deps, now),
    /internal database failure/,
  );
  assert.equal(reply.payload, undefined);
});
