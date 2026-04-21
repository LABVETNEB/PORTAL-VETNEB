import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createRequireParticularAuth } = await import(
  "../server/middlewares/particular-auth.ts"
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
    deleteParticularSession: (tokenHash: string) => Promise<void>;
    getParticularSessionByToken: (tokenHash: string) => Promise<any>;
    getParticularTokenById: (id: number) => Promise<any>;
    updateParticularSessionLastAccess: (tokenHash: string) => Promise<void>;
    hashSessionToken: (token: string) => string;
    cookieName: string;
    cookieSameSite: "lax" | "strict" | "none";
    cookieSecure: boolean;
    now: () => number;
  }>,
) {
  const calls = {
    deleteParticularSession: [] as string[],
    getParticularSessionByToken: [] as string[],
    getParticularTokenById: [] as number[],
    updateParticularSessionLastAccess: [] as string[],
    hashSessionToken: [] as string[],
  };

  const deps = {
    deleteParticularSession: async (tokenHash: string) => {
      calls.deleteParticularSession.push(tokenHash);
    },
    getParticularSessionByToken: async (tokenHash: string) => {
      calls.getParticularSessionByToken.push(tokenHash);
      return null;
    },
    getParticularTokenById: async (id: number) => {
      calls.getParticularTokenById.push(id);
      return null;
    },
    updateParticularSessionLastAccess: async (tokenHash: string) => {
      calls.updateParticularSessionLastAccess.push(tokenHash);
    },
    hashSessionToken: (token: string) => {
      calls.hashSessionToken.push(token);
      return `hashed:${token}`;
    },
    cookieName: "particular_session",
    cookieSameSite: "lax" as const,
    cookieSecure: false,
    now: () => new Date("2026-04-21T12:00:00.000Z").getTime(),
    ...overrides,
  };

  return { deps, calls };
}

test("requireParticularAuth responde 401 cuando no hay cookie", async () => {
  const { deps, calls } = createDeps();
  const middleware = createRequireParticularAuth(deps as any);

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
    error: "Particular no autenticado",
  });
  assert.equal(nextCalls.length, 0);
  assert.deepEqual(calls.hashSessionToken, []);
});

test("requireParticularAuth responde 401 cuando la sesión no existe", async () => {
  const { deps, calls } = createDeps();
  const middleware = createRequireParticularAuth(deps as any);

  const req = {
    cookies: {
      particular_session: " raw-token ",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.hashSessionToken, ["raw-token"]);
  assert.deepEqual(calls.getParticularSessionByToken, ["hashed:raw-token"]);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Sesión particular inválida",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireParticularAuth elimina y limpia cookie cuando la sesión expiró", async () => {
  const { deps, calls } = createDeps({
    getParticularSessionByToken: async (tokenHash: string) => {
      calls.getParticularSessionByToken.push(tokenHash);
      return {
        particularTokenId: 77,
        expiresAt: new Date("2026-04-21T11:59:59.000Z"),
        lastAccess: null,
      };
    },
  });

  const middleware = createRequireParticularAuth(deps as any);

  const req = {
    cookies: {
      particular_session: "token-expirado",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.deleteParticularSession, ["hashed:token-expirado"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.deepEqual(res.clearedCookies[0], {
    name: "particular_session",
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
    error: "Sesión particular expirada",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireParticularAuth elimina sesión cuando el token está inactivo", async () => {
  const { deps, calls } = createDeps({
    getParticularSessionByToken: async (tokenHash: string) => {
      calls.getParticularSessionByToken.push(tokenHash);
      return {
        particularTokenId: 88,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
        lastAccess: null,
      };
    },
    getParticularTokenById: async (id: number) => {
      calls.getParticularTokenById.push(id);
      return {
        id,
        clinicId: 3,
        reportId: 22,
        isActive: false,
      };
    },
  });

  const middleware = createRequireParticularAuth(deps as any);

  const req = {
    cookies: {
      particular_session: "token-inactivo",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req as any,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.getParticularTokenById, [88]);
  assert.deepEqual(calls.deleteParticularSession, ["hashed:token-inactivo"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Token particular inválido o inactivo",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireParticularAuth autentica y refresca lastAccess cuando corresponde", async () => {
  const { deps, calls } = createDeps({
    getParticularSessionByToken: async (tokenHash: string) => {
      calls.getParticularSessionByToken.push(tokenHash);
      return {
        particularTokenId: 99,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
        lastAccess: new Date("2026-04-21T11:00:00.000Z"),
      };
    },
    getParticularTokenById: async (id: number) => {
      calls.getParticularTokenById.push(id);
      return {
        id,
        clinicId: 7,
        reportId: 33,
        isActive: true,
      };
    },
  });

  const middleware = createRequireParticularAuth(deps as any);

  const req: any = {
    cookies: {
      particular_session: "token-valido",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.updateParticularSessionLastAccess, ["hashed:token-valido"]);
  assert.deepEqual(req.particularAuth, {
    tokenId: 99,
    clinicId: 7,
    reportId: 33,
    sessionToken: "token-valido",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
  assert.deepEqual(nextCalls, [undefined]);
});

test("requireParticularAuth autentica sin refrescar lastAccess si aún no corresponde", async () => {
  const { deps, calls } = createDeps({
    getParticularSessionByToken: async (tokenHash: string) => {
      calls.getParticularSessionByToken.push(tokenHash);
      return {
        particularTokenId: 44,
        expiresAt: new Date("2026-04-21T13:00:00.000Z"),
        lastAccess: new Date("2026-04-21T11:55:00.000Z"),
      };
    },
    getParticularTokenById: async (id: number) => {
      calls.getParticularTokenById.push(id);
      return {
        id,
        clinicId: 4,
        reportId: null,
        isActive: true,
      };
    },
  });

  const middleware = createRequireParticularAuth(deps as any);

  const req: any = {
    cookies: {
      particular_session: "token-reciente",
    },
  };

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  await middleware(
    req,
    res as any,
    ((error?: unknown) => nextCalls.push(error)) as any,
  );

  assert.deepEqual(calls.updateParticularSessionLastAccess, []);
  assert.deepEqual(req.particularAuth, {
    tokenId: 44,
    clinicId: 4,
    reportId: null,
    sessionToken: "token-reciente",
  });
  assert.deepEqual(nextCalls, [undefined]);
});

test("requireParticularAuth propaga errores inesperados a next", async () => {
  const expectedError = new Error("fallo db");

  const { deps } = createDeps({
    getParticularSessionByToken: async () => {
      throw expectedError;
    },
  });

  const middleware = createRequireParticularAuth(deps as any);

  const req = {
    cookies: {
      particular_session: "token-error",
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
