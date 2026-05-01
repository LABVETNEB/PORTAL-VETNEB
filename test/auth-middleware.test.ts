import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createRequireAuth } = await import(
  "../server/middlewares/auth.ts"
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
    deleteActiveSession: (tokenHash: string) => Promise<void>;
    getActiveSessionByToken: (tokenHash: string) => Promise<any>;
    getClinicUserById: (id: number) => Promise<any>;
    updateSessionLastAccess: (tokenHash: string) => Promise<void>;
    hashSessionToken: (token: string) => string;
    cookieName: string;
    cookieSameSite: "lax" | "strict" | "none";
    cookieSecure: boolean;
    now: () => number;
  }>,
) {
  const calls = {
    deleteActiveSession: [] as string[],
    getActiveSessionByToken: [] as string[],
    getClinicUserById: [] as number[],
    updateSessionLastAccess: [] as string[],
    hashSessionToken: [] as string[],
  };

  const deps = {
    deleteActiveSession: async (tokenHash: string) => {
      calls.deleteActiveSession.push(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) => {
      calls.getActiveSessionByToken.push(tokenHash);
      return null;
    },
    getClinicUserById: async (id: number) => {
      calls.getClinicUserById.push(id);
      return null;
    },
    updateSessionLastAccess: async (tokenHash: string) => {
      calls.updateSessionLastAccess.push(tokenHash);
    },
    hashSessionToken: (token: string) => {
      calls.hashSessionToken.push(token);
      return `hashed:${token}`;
    },
    cookieName: "clinic_session",
    cookieSameSite: "lax" as const,
    cookieSecure: false,
    now: () => new Date("2026-04-21T12:00:00.000Z").getTime(),
    ...overrides,
  };

  return { deps, calls };
}

test("requireAuth responde 401 cuando no hay cookie", async () => {
  const { deps, calls } = createDeps();
  const middleware = createRequireAuth(deps as any);

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
    error: "No autenticado",
  });
  assert.equal(nextCalls.length, 0);
  assert.deepEqual(calls.hashSessionToken, []);
});

test("requireAuth responde 401 cuando la sesión no existe", async () => {
  const { deps, calls } = createDeps();
  const middleware = createRequireAuth(deps as any);

  const req = {
    cookies: {
      clinic_session: " raw-clinic-token ",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.hashSessionToken, ["raw-clinic-token"]);
  assert.deepEqual(calls.getActiveSessionByToken, ["hashed:raw-clinic-token"]);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Sesión inválida",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAuth elimina y limpia cookie cuando la sesión expiró", async () => {
  const { deps, calls } = createDeps({
    getActiveSessionByToken: async (tokenHash: string) => {
      calls.getActiveSessionByToken.push(tokenHash);
      return {
        clinicUserId: 77,
        expiresAt: new Date("2026-04-21T11:59:59.000Z"),
      };
    },
  });

  const middleware = createRequireAuth(deps as any);

  const req = {
    cookies: {
      clinic_session: "token-expirado",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.deleteActiveSession, ["hashed:token-expirado"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.deepEqual(res.clearedCookies[0], {
    name: "clinic_session",
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
    error: "Sesión expirada",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAuth elimina sesión cuando el usuario clinic no existe", async () => {
  const { deps, calls } = createDeps({
    getActiveSessionByToken: async (tokenHash: string) => {
      calls.getActiveSessionByToken.push(tokenHash);
      return {
        clinicUserId: 88,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
      };
    },
    getClinicUserById: async (id: number) => {
      calls.getClinicUserById.push(id);
      return null;
    },
  });

  const middleware = createRequireAuth(deps as any);

  const req = {
    cookies: {
      clinic_session: "token-sin-usuario",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.getClinicUserById, [88]);
  assert.deepEqual(calls.deleteActiveSession, ["hashed:token-sin-usuario"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Usuario de sesión no encontrado",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAuth autentica owner y actualiza lastAccess", async () => {
  const { deps, calls } = createDeps({
    getActiveSessionByToken: async (tokenHash: string) => {
      calls.getActiveSessionByToken.push(tokenHash);
      return {
        clinicUserId: 99,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
      };
    },
    getClinicUserById: async (id: number) => {
      calls.getClinicUserById.push(id);
      return {
        id,
        clinicId: 7,
        username: "owner-user",
        authProId: "authpro-1",
        role: "clinic_owner",
      };
    },
  });

  const middleware = createRequireAuth(deps as any);

  const req: any = {
    cookies: {
      clinic_session: "token-valido",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.updateSessionLastAccess, ["hashed:token-valido"]);
  assert.deepEqual(req.auth, {
    id: 99,
    clinicId: 7,
    username: "owner-user",
    authProId: "authpro-1",
    role: "clinic_owner",
    permissions: {
      canUploadReports: false,
      canManageClinicUsers: true,
    },
    canUploadReports: false,
    canManageClinicUsers: true,
    sessionToken: "token-valido",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
  assert.deepEqual(nextCalls, [undefined]);
});

test("requireAuth normaliza role inválido a clinic_staff", async () => {
  const { deps, calls } = createDeps({
    getActiveSessionByToken: async (tokenHash: string) => {
      calls.getActiveSessionByToken.push(tokenHash);
      return {
        clinicUserId: 44,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
      };
    },
    getClinicUserById: async (id: number) => {
      calls.getClinicUserById.push(id);
      return {
        id,
        clinicId: 4,
        username: "staff-user",
        authProId: null,
        role: "ROL_INVALIDO",
      };
    },
  });

  const middleware = createRequireAuth(deps as any);

  const req: any = {
    cookies: {
      clinic_session: "token-reciente",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.updateSessionLastAccess, ["hashed:token-reciente"]);
  assert.deepEqual(req.auth, {
    id: 44,
    clinicId: 4,
    username: "staff-user",
    authProId: null,
    role: "clinic_staff",
    permissions: {
      canUploadReports: false,
      canManageClinicUsers: false,
    },
    canUploadReports: false,
    canManageClinicUsers: false,
    sessionToken: "token-reciente",
  });
  assert.deepEqual(nextCalls, [undefined]);
});

test("requireAuth propaga errores inesperados a next", async () => {
  const expectedError = new Error("fallo db");

  const { deps } = createDeps({
    getActiveSessionByToken: async () => {
      throw expectedError;
    },
  });

  const middleware = createRequireAuth(deps as any);

  const req = {
    cookies: {
      clinic_session: "token-error",
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
