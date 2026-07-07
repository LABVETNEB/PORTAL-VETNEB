import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../server/lib/env.ts");
const { AUDIT_EVENTS } = await import("../../server/lib/audit.ts");
const { LOGIN_RATE_LIMIT_CODE } = await import(
  "../../server/lib/login-rate-limit.ts"
);
const { createMemoryRateLimitStore } = await import(
  "../../server/lib/rate-limit-store.ts"
);
const { adminAuthNativeRoutes } = await import(
  "../../server/routes/admin-auth.fastify.ts"
);
const { clinicAuthNativeRoutes } = await import(
  "../../server/routes/auth.fastify.ts"
);

const ALLOWED_ORIGIN = "http://localhost:3000";
const PASSWORD_CHANGE_ERROR = "No se pudo actualizar la credencial.";
const NOW = Date.UTC(2026, 5, 16, 12, 0, 0);
const FUTURE = new Date("2099-01-01T00:00:00.000Z");

type AuditCall = {
  event?: unknown;
  targetAdminUserId?: unknown;
  targetClinicUserId?: unknown;
  metadata?: Record<string, unknown>;
};

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertSecretNotPresent(value: unknown, secret: string): void {
  assert.equal(
    JSON.stringify(value).includes(secret),
    false,
    `response/audit payload must not contain secret: ${secret}`,
  );
}

function createPasswordHarness(input: {
  initialPassword: string;
  initialHash: string;
}) {
  const passwordByHash = new Map<string, string>([
    [input.initialHash, input.initialPassword],
  ]);
  let storedHash = input.initialHash;

  return {
    get storedHash() {
      return storedHash;
    },
    setStoredHash(hash: string) {
      storedHash = hash;
    },
    hashPassword: async (password: string) => {
      const hash = `argon:${password}`;
      passwordByHash.set(hash, password);
      return hash;
    },
    verifyPassword: async (password: string, passwordHash: string) => ({
      valid: passwordByHash.get(passwordHash) === password,
      needsRehash: passwordHash.startsWith("legacy:"),
    }),
  };
}

async function createClinicPasswordChangeApp(input?: {
  initialPassword?: string;
  initialHash?: string;
  maxAttempts?: number;
}) {
  const initialPassword = input?.initialPassword ?? "old-clinic-password";
  const passwords = createPasswordHarness({
    initialPassword,
    initialHash: input?.initialHash ?? "legacy:clinic-password",
  });
  const auditCalls: AuditCall[] = [];
  const upserts: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];
  const deletedSessions: string[] = [];
  const app = Fastify();

  const clinicUser = () => ({
    id: 7,
    clinicId: 3,
    username: "vetneb",
    passwordHash: passwords.storedHash,
    authProId: null,
    role: "clinic_owner",
  });

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: input?.maxAttempts ?? 10,
    loginRateLimitStore: createMemoryRateLimitStore(),
    createActiveSession: async (session: Record<string, unknown>) => {
      createdSessions.push(session);
    },
    deleteActiveSession: async (tokenHash: string) => {
      deletedSessions.push(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) =>
      tokenHash === "hash:clinic-session"
        ? { clinicUserId: 7, expiresAt: FUTURE }
        : null,
    getClinicUserById: async (clinicUserId: number) =>
      clinicUserId === 7 ? clinicUser() : null,
    getClinicUserByUsername: async (username: string) =>
      username.trim() === "vetneb" ? clinicUser() : null,
    getClinicUserByIdentifier: async (identifier: string) =>
      identifier.trim() === "vetneb" ? clinicUser() : null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async (nextUser: Record<string, unknown>) => {
      upserts.push(nextUser);
      passwords.setStoredHash(String(nextUser.passwordHash));
    },
    generateSessionToken: () => "new-clinic-session",
    hashPassword: passwords.hashPassword,
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: passwords.verifyPassword,
    writeAuditLog: async (_req: unknown, input: AuditCall) => {
      auditCalls.push(input);
    },
    recordLoginFailedAttempt: async () => {},
  });

  return {
    app,
    auditCalls,
    upserts,
    createdSessions,
    deletedSessions,
    getStoredHash: () => passwords.storedHash,
  };
}

async function createAdminPasswordChangeApp(input?: {
  initialPassword?: string;
  initialHash?: string;
  maxAttempts?: number;
}) {
  const initialPassword = input?.initialPassword ?? "old-admin-password";
  const passwords = createPasswordHarness({
    initialPassword,
    initialHash: input?.initialHash ?? "legacy:admin-password",
  });
  const auditCalls: AuditCall[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];
  const deletedSessions: string[] = [];
  const app = Fastify();

  const adminUser = () => ({
    id: 1,
    username: "VETNEB",
    passwordHash: passwords.storedHash,
  });

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: input?.maxAttempts ?? 10,
    loginRateLimitStore: createMemoryRateLimitStore(),
    createAdminSession: async (session: Record<string, unknown>) => {
      createdSessions.push(session);
    },
    deleteAdminSession: async (tokenHash: string) => {
      deletedSessions.push(tokenHash);
    },
    getAdminSessionByToken: async (tokenHash: string) =>
      tokenHash === "hash:admin-session"
        ? { adminUserId: 1, expiresAt: FUTURE }
        : null,
    getAdminUserById: async (adminUserId: number) =>
      adminUserId === 1 ? { id: 1, username: "VETNEB" } : null,
    getAdminUserByUsername: async (username: string) =>
      username.trim() === "VETNEB" ? adminUser() : null,
    getAdminUserForPasswordChange: async (adminUserId: number) =>
      adminUserId === 1 ? adminUser() : null,
    updateAdminSessionLastAccess: async () => {},
    updateAdminPasswordHash: async (
      adminUserId: number,
      passwordHash: string,
    ) => {
      updates.push({ adminUserId, passwordHash });
      passwords.setStoredHash(passwordHash);
    },
    generateSessionToken: () => "new-admin-session",
    hashPassword: passwords.hashPassword,
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: passwords.verifyPassword,
    writeAuditLog: async (_req: unknown, input: AuditCall) => {
      auditCalls.push(input);
    },
    recordLoginFailedAttempt: async () => {},
  });

  return {
    app,
    auditCalls,
    updates,
    createdSessions,
    deletedSessions,
    getStoredHash: () => passwords.storedHash,
  };
}

test("clinic password change updates hash, keeps session, and allows login with new password", async () => {
  const oldPassword = "old-clinic-password";
  const newPassword = "new-clinic-password";
  const harness = await createClinicPasswordChangeApp({
    initialPassword: oldPassword,
    initialHash: "legacy:clinic-password",
  });

  try {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: `${ENV.cookieName}=clinic-session`,
      },
      payload: {
        currentPassword: oldPassword,
        newPassword,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { success: true });
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal(harness.deletedSessions.length, 0);
    assert.equal(harness.getStoredHash(), `argon:${newPassword}`);

    assert.equal(harness.upserts.length, 1);
    assert.equal(harness.upserts[0].passwordHash, `argon:${newPassword}`);
    assert.equal(harness.upserts[0].role, "clinic_owner");

    assert.equal(harness.auditCalls.length, 1);
    assert.equal(
      harness.auditCalls[0].event,
      AUDIT_EVENTS.CLINIC_USER_CREDENTIALS_UPDATED,
    );
    assert.equal(harness.auditCalls[0].targetClinicUserId, 7);
    assert.equal(harness.auditCalls[0].metadata?.selfService, true);
    assert.equal(harness.auditCalls[0].metadata?.sessionMaintained, true);
    assertSecretNotPresent(harness.auditCalls, oldPassword);
    assertSecretNotPresent(harness.auditCalls, newPassword);

    const login = await harness.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: ALLOWED_ORIGIN,
      },
      payload: {
        username: "vetneb",
        password: newPassword,
      },
    });

    assert.equal(login.statusCode, 200);
    assert.equal(JSON.parse(login.body).success, true);
    assert.equal(harness.createdSessions.length, 1);
  } finally {
    await harness.app.close();
  }
});

test("admin password change updates hash, keeps session, and allows login with new password", async () => {
  const oldPassword = "old-admin-password";
  const newPassword = "new-admin-password";
  const harness = await createAdminPasswordChangeApp({
    initialPassword: oldPassword,
    initialHash: "legacy:admin-password",
  });

  try {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/admin/auth/change-password",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: `${ENV.adminCookieName}=admin-session`,
      },
      payload: {
        currentPassword: oldPassword,
        newPassword,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { success: true });
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal(harness.deletedSessions.length, 0);
    assert.equal(harness.getStoredHash(), `argon:${newPassword}`);

    assert.deepEqual(harness.updates, [
      {
        adminUserId: 1,
        passwordHash: `argon:${newPassword}`,
      },
    ]);
    assert.equal(harness.auditCalls.length, 1);
    assert.equal(harness.auditCalls[0].event, "auth.admin.password.changed");
    assert.equal(harness.auditCalls[0].targetAdminUserId, 1);
    assert.equal(harness.auditCalls[0].metadata?.selfService, true);
    assert.equal(harness.auditCalls[0].metadata?.sessionMaintained, true);
    assertSecretNotPresent(harness.auditCalls, oldPassword);
    assertSecretNotPresent(harness.auditCalls, newPassword);

    const login = await harness.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: {
        origin: ALLOWED_ORIGIN,
      },
      payload: {
        username: "VETNEB",
        password: newPassword,
      },
    });

    assert.equal(login.statusCode, 200);
    assert.equal(JSON.parse(login.body).success, true);
    assert.equal(harness.createdSessions.length, 1);
  } finally {
    await harness.app.close();
  }
});

test("password change failures use generic responses and never update hashes", async () => {
  const oldPassword = "old-clinic-password";
  const harness = await createClinicPasswordChangeApp({
    initialPassword: oldPassword,
  });
  const expectedBody = {
    success: false,
    error: PASSWORD_CHANGE_ERROR,
  };

  try {
    const payloads = [
      {},
      { currentPassword: 123, newPassword: "new-clinic-password" },
      { currentPassword: oldPassword, newPassword: "short" },
      { currentPassword: "wrong-clinic-password", newPassword: "new-clinic-password" },
      { currentPassword: oldPassword, newPassword: oldPassword },
    ];

    for (const payload of payloads) {
      const response = await harness.app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        headers: {
          origin: ALLOWED_ORIGIN,
          cookie: `${ENV.cookieName}=clinic-session`,
        },
        payload,
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), expectedBody);
      assertSecretNotPresent(response.body, oldPassword);
    }

    assert.equal(harness.upserts.length, 0);
    assert.equal(harness.auditCalls.length, 0);
  } finally {
    await harness.app.close();
  }
});

test("password change endpoint requires authenticated session", async () => {
  const harness = await createClinicPasswordChangeApp();

  try {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: {
        origin: ALLOWED_ORIGIN,
      },
      payload: {
        currentPassword: "old-clinic-password",
        newPassword: "new-clinic-password",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(harness.upserts.length, 0);
    assert.equal(harness.auditCalls.length, 0);
  } finally {
    await harness.app.close();
  }
});

test("password change reuses auth rate limit store for failed attempts", async () => {
  const harness = await createClinicPasswordChangeApp({
    maxAttempts: 1,
  });

  try {
    const first = await harness.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: `${ENV.cookieName}=clinic-session`,
      },
      payload: {
        currentPassword: "wrong-clinic-password",
        newPassword: "new-clinic-password",
      },
    });

    assert.equal(first.statusCode, 400);
    assert.equal(first.headers["ratelimit-limit"], "1");
    assert.equal(first.headers["ratelimit-remaining"], "0");

    const second = await harness.app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: `${ENV.cookieName}=clinic-session`,
      },
      payload: {
        currentPassword: "wrong-clinic-password",
        newPassword: "new-clinic-password",
      },
    });

    assert.equal(second.statusCode, 429);
    assert.equal(JSON.parse(second.body).code, LOGIN_RATE_LIMIT_CODE);
    assert.equal(harness.upserts.length, 0);
    assert.equal(harness.auditCalls.length, 0);
  } finally {
    await harness.app.close();
  }
});

test("particular auth remains token-backed and has no password change endpoint", () => {
  const source = readSource("server/routes/particular-auth.fastify.ts");

  assert.equal(source.includes("change-password"), false);
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(source.includes("verifyPassword"), false);
  assert.equal(source.includes("getParticularTokenByTokenHash"), true);
});
