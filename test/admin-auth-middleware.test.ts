import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createRequireAdminAuth } = await import(
  "../server/middlewares/admin-auth.ts"
);

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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
    getAdminSessionWithUser: (tokenHash: string) => Promise<any>;
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
    getAdminSessionWithUser: [] as string[],
    updateAdminSessionLastAccess: [] as string[],
    hashSessionToken: [] as string[],
  };

  const deps = {
    deleteAdminSession: async (tokenHash: string) => {
      calls.deleteAdminSession.push(tokenHash);
    },
    getAdminSessionWithUser: async (tokenHash: string) => {
      calls.getAdminSessionWithUser.push(tokenHash);
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

test("requireAdminAuth responde 401 cuando la cookie es inválida", async () => {
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
  assert.deepEqual(calls.getAdminSessionWithUser, ["hashed:raw-admin-token"]);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Sesión admin inválida",
  });
  assert.equal(nextCalls.length, 0);
});

test("requireAdminAuth elimina y limpia cookie cuando la sesión expiró", async () => {
  const { deps, calls } = createDeps({
    getAdminSessionWithUser: async (tokenHash: string) => {
      calls.getAdminSessionWithUser.push(tokenHash);
      return {
        session: {
          adminUserId: 77,
          expiresAt: new Date("2026-04-21T11:59:59.000Z"),
          lastAccess: null,
        },
        adminUser: {
          id: 77,
          username: "ADMIN",
        },
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
    getAdminSessionWithUser: async (tokenHash: string) => {
      calls.getAdminSessionWithUser.push(tokenHash);
      return {
        session: {
          adminUserId: 88,
          expiresAt: new Date("2026-04-21T13:00:00.000Z"),
          lastAccess: null,
        },
        adminUser: null,
      };
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

  assert.deepEqual(calls.getAdminSessionWithUser, ["hashed:token-sin-usuario"]);
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
    getAdminSessionWithUser: async (tokenHash: string) => {
      calls.getAdminSessionWithUser.push(tokenHash);
      return {
        session: {
          adminUserId: 99,
          expiresAt: new Date("2026-04-21T13:00:00.000Z"),
          lastAccess: new Date("2026-04-21T11:00:00.000Z"),
        },
        adminUser: {
          id: 99,
          username: "VETNEB",
        },
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
    getAdminSessionWithUser: async (tokenHash: string) => {
      calls.getAdminSessionWithUser.push(tokenHash);
      return {
        session: {
          adminUserId: 44,
          expiresAt: new Date("2026-04-21T13:00:00.000Z"),
          lastAccess: new Date("2026-04-21T11:55:00.000Z"),
        },
        adminUser: {
          id: 44,
          username: "ADMIN",
        },
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
    getAdminSessionWithUser: async () => {
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

test("requireAdminAuth usa getAdminSessionWithUser y no combina helpers separados", () => {
  const source = readSource("server/middlewares/admin-auth.ts");
  const fnStart = source.indexOf("return async function requireAdminAuth");
  const fnEnd = source.indexOf("} catch", fnStart);
  const fnBody = source.slice(fnStart, fnEnd);

  assert.ok(
    source.includes("getAdminSessionWithUser: db.getAdminSessionWithUser"),
  );
  assert.ok(fnBody.includes("deps.getAdminSessionWithUser(tokenHash)"));
  assert.equal(fnBody.includes("deps.getAdminSessionByToken"), false);
  assert.equal(fnBody.includes("deps.getAdminUserById"), false);
  assert.equal(fnBody.includes("getAdminSessionByToken"), false);
  assert.equal(fnBody.includes("getAdminUserById"), false);
});
