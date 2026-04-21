import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createRequireAdminAuth } = await import(
  "../server/middlewares/admin-auth.ts"
);

function createMockResponse() {
  return {
    statusCode: 200,
    jsonPayload: undefined as unknown,
    clearedCookies: [] as Array<{ name: string; options: unknown }>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      return this;
    },
    clearCookie(name: string, options: unknown) {
      this.clearedCookies.push({ name, options });
      return this;
    },
  };
}

function createDeps(
  overrides?: Partial<{
    deleteAdminSession: (tokenHash: string) => Promise<void>;
    getAdminSessionByToken: (tokenHash: string) => Promise<any>;
    getAdminUserById: (id: number) => Promise<any>;
    updateAdminSessionLastAccess: (tokenHash: string) => Promise<void>;
    hashSessionToken: (token: string) => string;
    cookieName: string;
    cookieSameSite: "lax" | "strict" | "none";
    cookieSecure: boolean;
    now: () => number;
  }>,
) {
  const calls = {
    deleteAdminSession: [] as string[],
    getAdminSessionByToken: [] as string[],
    getAdminUserById: [] as number[],
    updateAdminSessionLastAccess: [] as string[],
    hashSessionToken: [] as string[],
  };

  const deps = {
    deleteAdminSession: async (tokenHash: string) => {
      calls.deleteAdminSession.push(tokenHash);
    },
    getAdminSessionByToken: async (tokenHash: string) => {
      calls.getAdminSessionByToken.push(tokenHash);
      return null;
    },
    getAdminUserById: async (id: number) => {
      calls.getAdminUserById.push(id);
      return null;
    },
    updateAdminSessionLastAccess: async (tokenHash: string) => {
      calls.updateAdminSessionLastAccess.push(tokenHash);
    },
    hashSessionToken: (token: string) => {
      calls.hashSessionToken.push(token);
      return `hashed:${token}`;
    },
    cookieName: "admin_session",
    cookieSameSite: "lax" as const,
    cookieSecure: false,
    now: () => new Date("2026-04-21T12:00:00.000Z").getTime(),
    ...overrides,
  };

  return { deps, calls };
}

test("requireAdminAuth responde 401 cuando no hay cookie", async () => {
  const { deps, calls } = createDeps();
  const middleware = createRequireAdminAuth(deps as any);

  const req = {
    cookies: {},
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Admin no autenticado",
  });
  assert.equal(nextCalls.length, 0);
  assert.deepEqual(calls.hashSessionToken, []);
});

test("requireAdminAuth responde 401 cuando la sesión no existe", async () => {
  const { deps, calls } = createDeps();
  const middleware = createRequireAdminAuth(deps as any);

  const req = {
    cookies: {
      admin_session: " raw-admin-token ",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.hashSessionToken, ["raw-admin-token"]);
  assert.deepEqual(calls.getAdminSessionByToken, ["hashed:raw-admin-token"]);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Sesión admin inválida",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAdminAuth elimina y limpia cookie cuando la sesión expiró", async () => {
  const { deps, calls } = createDeps({
    getAdminSessionByToken: async (tokenHash: string) => {
      calls.getAdminSessionByToken.push(tokenHash);
      return {
        adminUserId: 77,
        expiresAt: new Date("2026-04-21T11:59:59.000Z"),
        lastAccess: null,
      };
    },
  });

  const middleware = createRequireAdminAuth(deps as any);

  const req = {
    cookies: {
      admin_session: "token-expirado",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.deleteAdminSession, ["hashed:token-expirado"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.deepEqual(res.clearedCookies[0], {
    name: "admin_session",
    options: {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    },
  });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Sesión admin expirada",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAdminAuth elimina sesión cuando el usuario admin no existe", async () => {
  const { deps, calls } = createDeps({
    getAdminSessionByToken: async (tokenHash: string) => {
      calls.getAdminSessionByToken.push(tokenHash);
      return {
        adminUserId: 88,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
        lastAccess: null,
      };
    },
    getAdminUserById: async (id: number) => {
      calls.getAdminUserById.push(id);
      return null;
    },
  });

  const middleware = createRequireAdminAuth(deps as any);

  const req = {
    cookies: {
      admin_session: "token-sin-usuario",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.getAdminUserById, [88]);
  assert.deepEqual(calls.deleteAdminSession, ["hashed:token-sin-usuario"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Usuario admin de sesión no encontrado",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAdminAuth autentica y refresca lastAccess cuando corresponde", async () => {
  const { deps, calls } = createDeps({
    getAdminSessionByToken: async (tokenHash: string) => {
      calls.getAdminSessionByToken.push(tokenHash);
      return {
        adminUserId: 99,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
        lastAccess: new Date("2026-04-21T11:00:00.000Z"),
      };
    },
    getAdminUserById: async (id: number) => {
      calls.getAdminUserById.push(id);
      return {
        id,
        username: "VETNEB",
      };
    },
  });

  const middleware = createRequireAdminAuth(deps as any);

  const req: any = {
    cookies: {
      admin_session: "token-valido",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.updateAdminSessionLastAccess, ["hashed:token-valido"]);
  assert.deepEqual(req.adminAuth, {
    id: 99,
    username: "VETNEB",
    sessionToken: "token-valido",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
  assert.deepEqual(nextCalls, [undefined]);
});

test("requireAdminAuth autentica sin refrescar lastAccess si aún no corresponde", async () => {
  const { deps, calls } = createDeps({
    getAdminSessionByToken: async (tokenHash: string) => {
      calls.getAdminSessionByToken.push(tokenHash);
      return {
        adminUserId: 44,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
        lastAccess: new Date("2026-04-21T11:55:00.000Z"),
      };
    },
    getAdminUserById: async (id: number) => {
      calls.getAdminUserById.push(id);
      return {
        id,
        username: "ADMIN",
      };
    },
  });

  const middleware = createRequireAdminAuth(deps as any);

  const req: any = {
    cookies: {
      admin_session: "token-reciente",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.updateAdminSessionLastAccess, []);
  assert.deepEqual(req.adminAuth, {
    id: 44,
    username: "ADMIN",
    sessionToken: "token-reciente",
  });
  assert.deepEqual(nextCalls, [undefined]);
});

test("requireAdminAuth propaga errores inesperados a next", async () => {
  const expectedError = new Error("fallo db");

  const { deps } = createDeps({
    getAdminSessionByToken: async () => {
      throw expectedError;
    },
  });

  const middleware = createRequireAdminAuth(deps as any);

  const req = {
    cookies: {
      admin_session: "token-error",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
  assert.deepEqual(nextCalls, [expectedError]);
});
