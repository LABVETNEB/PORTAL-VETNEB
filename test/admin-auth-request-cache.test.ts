import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const {
  authenticateFastifyAdmin,
  getRequestAdminAuthContext,
} = await import("../server/lib/fastify-admin-auth.ts");

type AdminAuthTestDeps = Parameters<typeof authenticateFastifyAdmin>[2];

function createRequest(input?: { token?: string; id?: string }) {
  const token = input?.token ?? "admin-session-token";

  return {
    id: input?.id ?? "req-1",
    method: "GET",
    url: "/api/admin/cache-test",
    ip: "127.0.0.1",
    headers: token
      ? {
          cookie: `${ENV.adminCookieName}=${encodeURIComponent(token)}`,
        }
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

function createDeps(
  overrides: Partial<AdminAuthTestDeps> = {},
): AdminAuthTestDeps & {
  calls: {
    deleteAdminSession: string[];
    getAdminSessionByToken: string[];
    getAdminUserById: number[];
    hashSessionToken: string[];
    updateAdminSessionLastAccess: string[];
  };
} {
  const calls = {
    deleteAdminSession: [] as string[],
    getAdminSessionByToken: [] as string[],
    getAdminUserById: [] as number[],
    hashSessionToken: [] as string[],
    updateAdminSessionLastAccess: [] as string[],
  };

  return {
    calls,
    deleteAdminSession: async (tokenHash: string) => {
      calls.deleteAdminSession.push(tokenHash);
    },
    getAdminSessionByToken: async (tokenHash: string) => {
      calls.getAdminSessionByToken.push(tokenHash);

      return {
        id: 9,
        adminUserId: 7,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        lastAccess: new Date("2026-06-03T10:00:00.000Z"),
      };
    },
    getAdminUserById: async (adminUserId: number) => {
      calls.getAdminUserById.push(adminUserId);

      return {
        id: adminUserId,
        username: "VETNEB",
      };
    },
    updateAdminSessionLastAccess: async (tokenHash: string) => {
      calls.updateAdminSessionLastAccess.push(tokenHash);
    },
    hashSessionToken: (token: string) => {
      calls.hashSessionToken.push(token);
      return `hash:${token}`;
    },
    now: () => Date.parse("2026-06-03T12:00:00.000Z"),
    ...overrides,
  };
}

test("admin auth request-scoped cache comparte dos lecturas dentro del mismo request", async () => {
  const deps = createDeps();
  const request = createRequest();

  const [first, second] = await Promise.all([
    getRequestAdminAuthContext(request as any, deps),
    getRequestAdminAuthContext(request as any, deps),
  ]);

  assert.equal(first, second);
  assert.equal(first.ok, true);
  assert.deepEqual(deps.calls.hashSessionToken, ["admin-session-token"]);
  assert.deepEqual(deps.calls.getAdminSessionByToken, [
    "hash:admin-session-token",
  ]);
  assert.deepEqual(deps.calls.getAdminUserById, [7]);
  assert.deepEqual(deps.calls.updateAdminSessionLastAccess, [
    "hash:admin-session-token",
  ]);
});

test("admin auth request-scoped cache no se comparte entre requests", async () => {
  const deps = createDeps();

  await authenticateFastifyAdmin(
    createRequest({ id: "req-1" }) as any,
    createReply() as any,
    deps,
  );
  await authenticateFastifyAdmin(
    createRequest({ id: "req-2" }) as any,
    createReply() as any,
    deps,
  );

  assert.deepEqual(deps.calls.getAdminSessionByToken, [
    "hash:admin-session-token",
    "hash:admin-session-token",
  ]);
  assert.deepEqual(deps.calls.getAdminUserById, [7, 7]);
});

test("admin auth request-scoped cache acepta con sesión y usuario admin válidos", async () => {
  const deps = createDeps();
  const request = createRequest();
  const reply = createReply();

  const first = await authenticateFastifyAdmin(request as any, reply as any, deps);
  const second = await authenticateFastifyAdmin(
    request as any,
    createReply() as any,
    deps,
  );

  assert.deepEqual(first, {
    id: 7,
    username: "VETNEB",
    sessionId: 9,
    sessionToken: "admin-session-token",
  });
  assert.deepEqual(second, first);
  assert.deepEqual((request as any).adminAuth, first);
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.payload, undefined);
  assert.equal(deps.calls.getAdminSessionByToken.length, 1);
  assert.equal(deps.calls.getAdminUserById.length, 1);
});

test("admin auth request-scoped cache mantiene rechazo de sesión inválida", async () => {
  const sessionCalls: string[] = [];
  const deps = createDeps({
    getAdminSessionByToken: async (tokenHash: string) => {
      sessionCalls.push(tokenHash);
      return null;
    },
  });
  const reply = createReply();

  const admin = await authenticateFastifyAdmin(
    createRequest() as any,
    reply as any,
    deps,
  );

  assert.equal(admin, null);
  assert.equal(reply.statusCode, 401);
  assert.deepEqual(reply.payload, {
    success: false,
    error: "Sesión admin inválida",
  });
  assert.deepEqual(deps.calls.getAdminUserById, []);
  assert.deepEqual(deps.calls.deleteAdminSession, []);
  assert.deepEqual(sessionCalls, ["hash:admin-session-token"]);
});

test("admin auth request-scoped cache mantiene rechazo de usuario admin ausente", async () => {
  const userCalls: number[] = [];
  const deps = createDeps({
    getAdminUserById: async (adminUserId: number) => {
      userCalls.push(adminUserId);
      return null;
    },
  });
  const reply = createReply();

  const admin = await authenticateFastifyAdmin(
    createRequest() as any,
    reply as any,
    deps,
  );

  assert.equal(admin, null);
  assert.equal(reply.statusCode, 401);
  assert.deepEqual(reply.payload, {
    success: false,
    error: "Usuario admin de sesión no encontrado",
  });
  assert.deepEqual(deps.calls.deleteAdminSession, [
    "hash:admin-session-token",
  ]);
  assert.deepEqual(userCalls, [7]);
  assert.match(String(reply.headers["set-cookie"]), /Max-Age=0/);
});

test("admin auth request-scoped cache mantiene rechazo de sesión expirada sin consultar usuario", async () => {
  const sessionCalls: string[] = [];
  const deps = createDeps({
    getAdminSessionByToken: async (tokenHash: string) => {
      sessionCalls.push(tokenHash);

      return {
        id: 9,
        adminUserId: 7,
        expiresAt: new Date("2026-06-03T11:59:59.000Z"),
        lastAccess: new Date("2026-06-03T10:00:00.000Z"),
      };
    },
  });
  const reply = createReply();

  const admin = await authenticateFastifyAdmin(
    createRequest() as any,
    reply as any,
    deps,
  );

  assert.equal(admin, null);
  assert.equal(reply.statusCode, 401);
  assert.deepEqual(reply.payload, {
    success: false,
    error: "Sesión admin expirada",
  });
  assert.deepEqual(deps.calls.getAdminUserById, []);
  assert.deepEqual(deps.calls.deleteAdminSession, [
    "hash:admin-session-token",
  ]);
  assert.deepEqual(sessionCalls, ["hash:admin-session-token"]);
  assert.match(String(reply.headers["set-cookie"]), /Max-Age=0/);
});
