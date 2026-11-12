import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { readSourceFile as readSource } from "../helpers/tracked-source-files.ts";

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

type CommitFailure = "throw" | "null";

function assertSecretNotPresent(value: unknown, secret: string): void {
  assert.equal(
    JSON.stringify(value).includes(secret),
    false,
    `response/audit payload must not contain secret: ${secret}`,
  );
}

function createPasswordHarness(initialHashes: Map<number, string>) {
  const passwordByHash = new Map<string, string>();
  const hashByUser = new Map(initialHashes);

  return {
    hashByUser,
    registerPassword(hash: string, password: string) {
      passwordByHash.set(hash, password);
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

// Synthetic identities: user 7 and 8 share clinic 3, user 9 belongs to clinic 4.
const syntheticClinicUsers = [
  { id: 7, clinicId: 3, username: "vetneb", role: "clinic_owner" },
  { id: 8, clinicId: 3, username: "vetneb-staff", role: "clinic_staff" },
  { id: 9, clinicId: 4, username: "otra-clinica", role: "clinic_owner" },
] as const;

async function createClinicPasswordChangeApp(input?: {
  initialPassword?: string;
  maxAttempts?: number;
  commitFailure?: CommitFailure;
}) {
  const initialPassword = input?.initialPassword ?? "old-clinic-password";
  const passwords = createPasswordHarness(
    new Map([
      [7, "legacy:clinic-password"],
      [8, "legacy:peer-password"],
      [9, "legacy:other-password"],
    ]),
  );
  passwords.registerPassword("legacy:clinic-password", initialPassword);

  const sessions = new Map<string, { clinicUserId: number; expiresAt: Date }>([
    ["hash:clinic-session", { clinicUserId: 7, expiresAt: FUTURE }],
    ["hash:clinic-session-2", { clinicUserId: 7, expiresAt: FUTURE }],
    ["hash:clinic-peer", { clinicUserId: 8, expiresAt: FUTURE }],
    ["hash:clinic-other", { clinicUserId: 9, expiresAt: FUTURE }],
  ]);
  const auditCalls: AuditCall[] = [];
  const commits: Array<Record<string, unknown>> = [];
  const upserts: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];
  const deletedSessions: string[] = [];
  const app = Fastify();

  const clinicUser = (id: number) => {
    const user = syntheticClinicUsers.find((candidate) => candidate.id === id);

    return user
      ? {
          ...user,
          passwordHash: passwords.hashByUser.get(id)!,
          authProId: null,
        }
      : null;
  };
  const clinicUserByName = (name: string) =>
    clinicUser(
      syntheticClinicUsers.find((candidate) => candidate.username === name.trim())?.id ??
        -1,
    );

  await app.register(clinicAuthNativeRoutes, {
    prefix: "/api/auth",
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: input?.maxAttempts ?? 10,
    loginRateLimitStore: createMemoryRateLimitStore(),
    createActiveSession: async (session: {
      clinicUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }) => {
      createdSessions.push(session);
      sessions.set(session.tokenHash, {
        clinicUserId: session.clinicUserId,
        expiresAt: session.expiresAt,
      });
    },
    deleteActiveSession: async (tokenHash: string) => {
      deletedSessions.push(tokenHash);
      sessions.delete(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) =>
      sessions.get(tokenHash) ?? null,
    getClinicUserById: async (clinicUserId: number) => clinicUser(clinicUserId),
    getClinicUserByUsername: async (username: string) =>
      clinicUserByName(username),
    getClinicUserByIdentifier: async (identifier: string) =>
      clinicUserByName(identifier),
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async (nextUser: Record<string, unknown>) => {
      upserts.push(nextUser);
    },
    changeClinicUserPasswordAndRevokeOtherSessions: async (change) => {
      commits.push({ ...change });

      if (input?.commitFailure === "throw") {
        throw new Error("synthetic commit failure");
      }

      if (input?.commitFailure === "null" || !clinicUser(change.clinicUserId)) {
        return null;
      }

      passwords.hashByUser.set(change.clinicUserId, change.passwordHash);
      let revokedSessionCount = 0;

      for (const [tokenHash, session] of sessions) {
        if (
          session.clinicUserId === change.clinicUserId &&
          tokenHash !== change.keepSessionTokenHash
        ) {
          sessions.delete(tokenHash);
          revokedSessionCount += 1;
        }
      }

      return { revokedSessionCount };
    },
    generateSessionToken: () => "new-clinic-session",
    hashPassword: passwords.hashPassword,
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: passwords.verifyPassword,
    writeAuditLog: async (_req: unknown, call: AuditCall) => {
      auditCalls.push(call);
    },
    recordLoginFailedAttempt: async () => {},
  });

  return {
    app,
    auditCalls,
    commits,
    upserts,
    createdSessions,
    deletedSessions,
    sessions,
    getStoredHash: (clinicUserId = 7) => passwords.hashByUser.get(clinicUserId),
  };
}

const syntheticAdminUsers = [
  { id: 1, username: "VETNEB" },
  { id: 2, username: "VETNEB-2" },
] as const;

async function createAdminPasswordChangeApp(input?: {
  initialPassword?: string;
  maxAttempts?: number;
  commitFailure?: CommitFailure;
}) {
  const initialPassword = input?.initialPassword ?? "old-admin-password";
  const passwords = createPasswordHarness(
    new Map([
      [1, "legacy:admin-password"],
      [2, "legacy:admin-2-password"],
    ]),
  );
  passwords.registerPassword("legacy:admin-password", initialPassword);

  const lastAccess = new Date(NOW);
  const sessions = new Map<
    string,
    { adminUserId: number; expiresAt: Date; lastAccess: Date }
  >([
    ["hash:admin-session", { adminUserId: 1, expiresAt: FUTURE, lastAccess }],
    ["hash:admin-session-2", { adminUserId: 1, expiresAt: FUTURE, lastAccess }],
    ["hash:admin-other", { adminUserId: 2, expiresAt: FUTURE, lastAccess }],
  ]);
  const auditCalls: AuditCall[] = [];
  const commits: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];
  const app = Fastify();

  const adminUser = (id: number) => {
    const user = syntheticAdminUsers.find((candidate) => candidate.id === id);

    return user ? { ...user, passwordHash: passwords.hashByUser.get(id)! } : null;
  };

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: input?.maxAttempts ?? 10,
    loginRateLimitStore: createMemoryRateLimitStore(),
    createAdminSession: async (session: {
      adminUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }) => {
      createdSessions.push(session);
      sessions.set(session.tokenHash, {
        adminUserId: session.adminUserId,
        expiresAt: session.expiresAt,
        lastAccess: new Date(NOW),
      });
    },
    deleteAdminSession: async (tokenHash: string) => {
      sessions.delete(tokenHash);
    },
    getAdminSessionByToken: async (tokenHash: string) =>
      sessions.get(tokenHash) ?? null,
    getAdminUserById: async (adminUserId: number) => {
      const user = adminUser(adminUserId);
      return user ? { id: user.id, username: user.username } : null;
    },
    getAdminUserByUsername: async (username: string) =>
      adminUser(
        syntheticAdminUsers.find((candidate) => candidate.username === username.trim())
          ?.id ?? -1,
      ),
    getAdminUserForPasswordChange: async (adminUserId: number) =>
      adminUser(adminUserId),
    updateAdminSessionLastAccess: async () => {},
    changeAdminPasswordAndRevokeOtherSessions: async (change: {
      adminUserId: number;
      passwordHash: string;
      keepSessionTokenHash: string;
    }) => {
      commits.push({ ...change });

      if (input?.commitFailure === "throw") {
        throw new Error("synthetic commit failure");
      }

      if (input?.commitFailure === "null") {
        return null;
      }

      passwords.hashByUser.set(change.adminUserId, change.passwordHash);
      let revokedSessionCount = 0;

      for (const [tokenHash, session] of sessions) {
        if (
          session.adminUserId === change.adminUserId &&
          tokenHash !== change.keepSessionTokenHash
        ) {
          sessions.delete(tokenHash);
          revokedSessionCount += 1;
        }
      }

      return { revokedSessionCount };
    },
    generateSessionToken: () => "new-admin-session",
    hashPassword: passwords.hashPassword,
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: passwords.verifyPassword,
    writeAuditLog: async (_req: unknown, call: AuditCall) => {
      auditCalls.push(call);
    },
    recordLoginFailedAttempt: async () => {},
  });

  return {
    app,
    auditCalls,
    commits,
    createdSessions,
    sessions,
    getStoredHash: (adminUserId = 1) => passwords.hashByUser.get(adminUserId),
  };
}

async function clinicMe(
  app: Awaited<ReturnType<typeof createClinicPasswordChangeApp>>["app"],
  sessionToken: string,
) {
  return app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: `${ENV.cookieName}=${sessionToken}` },
  });
}

async function adminMe(
  app: Awaited<ReturnType<typeof createAdminPasswordChangeApp>>["app"],
  sessionToken: string,
) {
  return app.inject({
    method: "GET",
    url: "/api/admin/auth/me",
    headers: { cookie: `${ENV.adminCookieName}=${sessionToken}` },
  });
}

function changeClinicPassword(
  app: Awaited<ReturnType<typeof createClinicPasswordChangeApp>>["app"],
  payload: Record<string, unknown>,
  sessionToken = "clinic-session",
) {
  return app.inject({
    method: "POST",
    url: "/api/auth/change-password",
    headers: {
      origin: ALLOWED_ORIGIN,
      cookie: `${ENV.cookieName}=${sessionToken}`,
    },
    payload,
  });
}

function changeAdminPassword(
  app: Awaited<ReturnType<typeof createAdminPasswordChangeApp>>["app"],
  payload: Record<string, unknown>,
  sessionToken = "admin-session",
) {
  return app.inject({
    method: "POST",
    url: "/api/admin/auth/change-password",
    headers: {
      origin: ALLOWED_ORIGIN,
      cookie: `${ENV.adminCookieName}=${sessionToken}`,
    },
    payload,
  });
}

test("clinic password change updates hash, keeps the initiating session, revokes the user's other sessions and allows login with new password", async () => {
  const oldPassword = "old-clinic-password";
  const newPassword = "new-clinic-password";
  const harness = await createClinicPasswordChangeApp({
    initialPassword: oldPassword,
  });

  try {
    assert.equal((await clinicMe(harness.app, "clinic-session-2")).statusCode, 200);

    const response = await changeClinicPassword(harness.app, {
      currentPassword: oldPassword,
      newPassword,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { success: true });
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal(harness.getStoredHash(), `argon:${newPassword}`);

    assert.deepEqual(harness.commits, [
      {
        clinicUserId: 7,
        passwordHash: `argon:${newPassword}`,
        keepSessionTokenHash: "hash:clinic-session",
      },
    ]);
    assert.deepEqual(harness.upserts, []);

    assert.equal((await clinicMe(harness.app, "clinic-session")).statusCode, 200);
    assert.equal(harness.sessions.has("hash:clinic-session-2"), false);
    const revoked = await clinicMe(harness.app, "clinic-session-2");
    assert.equal(revoked.statusCode, 401);
    assert.equal(JSON.parse(revoked.body).success, false);

    assert.deepEqual(
      harness.auditCalls.map((call) => call.event),
      [AUDIT_EVENTS.CLINIC_USER_CREDENTIALS_UPDATED],
    );
    assert.equal(harness.auditCalls[0].targetClinicUserId, 7);
    assert.equal(harness.auditCalls[0].metadata?.selfService, true);
    assert.equal(harness.auditCalls[0].metadata?.sessionMaintained, true);
    assert.equal(harness.auditCalls[0].metadata?.otherSessionsRevoked, 1);
    assertSecretNotPresent(harness.auditCalls, oldPassword);
    assertSecretNotPresent(harness.auditCalls, newPassword);
    assertSecretNotPresent(harness.auditCalls, "clinic-session");

    const login = await harness.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: ALLOWED_ORIGIN },
      payload: { username: "vetneb", password: newPassword },
    });

    assert.equal(login.statusCode, 200);
    assert.equal(JSON.parse(login.body).success, true);
    assert.deepEqual(
      harness.createdSessions.map((session) => session.tokenHash),
      ["hash:new-clinic-session"],
    );
    assert.equal((await clinicMe(harness.app, "new-clinic-session")).statusCode, 200);

    const oldLogin = await harness.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: ALLOWED_ORIGIN },
      payload: { username: "vetneb", password: oldPassword },
    });
    assert.equal(oldLogin.statusCode, 401);
  } finally {
    await harness.app.close();
  }
});

test("clinic password change never touches sessions of other users or other clinics", async () => {
  const harness = await createClinicPasswordChangeApp();

  try {
    const response = await changeClinicPassword(harness.app, {
      currentPassword: "old-clinic-password",
      newPassword: "new-clinic-password",
    });

    assert.equal(response.statusCode, 200);
    assert.equal((await clinicMe(harness.app, "clinic-peer")).statusCode, 200);
    assert.equal((await clinicMe(harness.app, "clinic-other")).statusCode, 200);
    assert.deepEqual([...harness.sessions.keys()].sort(), [
      "hash:clinic-other",
      "hash:clinic-peer",
      "hash:clinic-session",
    ]);
    assert.equal(harness.getStoredHash(8), "legacy:peer-password");
    assert.equal(harness.getStoredHash(9), "legacy:other-password");
  } finally {
    await harness.app.close();
  }
});

test("clinic logout keeps working after a password change", async () => {
  const harness = await createClinicPasswordChangeApp();

  try {
    await changeClinicPassword(harness.app, {
      currentPassword: "old-clinic-password",
      newPassword: "new-clinic-password",
    });

    const logout = await harness.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: `${ENV.cookieName}=clinic-session`,
      },
    });

    assert.equal(logout.statusCode, 200);
    assert.deepEqual(harness.deletedSessions, ["hash:clinic-session"]);
    assert.equal((await clinicMe(harness.app, "clinic-session")).statusCode, 401);
  } finally {
    await harness.app.close();
  }
});

for (const commitFailure of ["throw", "null"] as const) {
  test(`clinic password change commit failure (${commitFailure}) reports no success, writes no audit and keeps sessions`, async () => {
    const harness = await createClinicPasswordChangeApp({ commitFailure });

    try {
      const response = await changeClinicPassword(harness.app, {
        currentPassword: "old-clinic-password",
        newPassword: "new-clinic-password",
      });

      assert.equal(response.statusCode, 500);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: PASSWORD_CHANGE_ERROR,
      });
      assert.equal(response.body.includes("synthetic commit failure"), false);
      assert.deepEqual(
        harness.commits.map((commit) => commit.clinicUserId),
        [7],
      );
      assert.equal(harness.getStoredHash(), "legacy:clinic-password");
      assert.equal(harness.sessions.size, 4);
      assert.deepEqual(harness.auditCalls, []);
    } finally {
      await harness.app.close();
    }
  });
}

test("admin password change updates hash, keeps the initiating session, revokes its other sessions and allows login with new password", async () => {
  const oldPassword = "old-admin-password";
  const newPassword = "new-admin-password";
  const harness = await createAdminPasswordChangeApp({
    initialPassword: oldPassword,
  });

  try {
    assert.equal((await adminMe(harness.app, "admin-session-2")).statusCode, 200);

    const response = await changeAdminPassword(harness.app, {
      currentPassword: oldPassword,
      newPassword,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { success: true });
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal(harness.getStoredHash(), `argon:${newPassword}`);
    assert.deepEqual(harness.commits, [
      {
        adminUserId: 1,
        passwordHash: `argon:${newPassword}`,
        keepSessionTokenHash: "hash:admin-session",
      },
    ]);

    assert.equal((await adminMe(harness.app, "admin-session")).statusCode, 200);
    assert.equal((await adminMe(harness.app, "admin-session-2")).statusCode, 401);
    assert.equal((await adminMe(harness.app, "admin-other")).statusCode, 200);
    assert.equal(harness.getStoredHash(2), "legacy:admin-2-password");

    assert.deepEqual(
      harness.auditCalls.map((call) => call.event),
      ["auth.admin.password.changed"],
    );
    assert.equal(harness.auditCalls[0].targetAdminUserId, 1);
    assert.equal(harness.auditCalls[0].metadata?.selfService, true);
    assert.equal(harness.auditCalls[0].metadata?.sessionMaintained, true);
    assert.equal(harness.auditCalls[0].metadata?.otherSessionsRevoked, 1);
    assertSecretNotPresent(harness.auditCalls, oldPassword);
    assertSecretNotPresent(harness.auditCalls, newPassword);
    assertSecretNotPresent(harness.auditCalls, "admin-session");

    const login = await harness.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: ALLOWED_ORIGIN },
      payload: { username: "VETNEB", password: newPassword },
    });

    assert.equal(login.statusCode, 200);
    assert.equal(JSON.parse(login.body).success, true);
    assert.deepEqual(
      harness.createdSessions.map((session) => session.tokenHash),
      ["hash:new-admin-session"],
    );
    assert.equal((await adminMe(harness.app, "new-admin-session")).statusCode, 200);
  } finally {
    await harness.app.close();
  }
});

for (const commitFailure of ["throw", "null"] as const) {
  test(`admin password change commit failure (${commitFailure}) reports no success, writes no audit and keeps sessions`, async () => {
    const harness = await createAdminPasswordChangeApp({ commitFailure });

    try {
      const response = await changeAdminPassword(harness.app, {
        currentPassword: "old-admin-password",
        newPassword: "new-admin-password",
      });

      assert.equal(response.statusCode, 500);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: PASSWORD_CHANGE_ERROR,
      });
      assert.equal(response.body.includes("synthetic commit failure"), false);
      assert.equal(harness.getStoredHash(), "legacy:admin-password");
      assert.equal(harness.sessions.size, 3);
      assert.deepEqual(harness.auditCalls, []);
    } finally {
      await harness.app.close();
    }
  });
}

test("password change failures use generic responses and never update hashes or revoke sessions", async () => {
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
      const response = await changeClinicPassword(harness.app, payload);

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), expectedBody);
      assertSecretNotPresent(response.body, oldPassword);
    }

    assert.deepEqual(harness.commits, []);
    assert.deepEqual(harness.upserts, []);
    assert.equal(harness.sessions.size, 4);
    assert.equal(harness.getStoredHash(), "legacy:clinic-password");
    assert.deepEqual(harness.auditCalls, []);
  } finally {
    await harness.app.close();
  }
});

test("admin password change with a wrong current password neither updates nor revokes", async () => {
  const harness = await createAdminPasswordChangeApp();

  try {
    const response = await changeAdminPassword(harness.app, {
      currentPassword: "wrong-admin-password",
      newPassword: "new-admin-password",
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: PASSWORD_CHANGE_ERROR,
    });
    assert.deepEqual(harness.commits, []);
    assert.equal(harness.sessions.size, 3);
    assert.deepEqual(harness.auditCalls, []);
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
    assert.deepEqual(harness.commits, []);
    assert.deepEqual(harness.auditCalls, []);
  } finally {
    await harness.app.close();
  }
});

test("a revoked session cannot change the password", async () => {
  const harness = await createClinicPasswordChangeApp();

  try {
    await changeClinicPassword(harness.app, {
      currentPassword: "old-clinic-password",
      newPassword: "new-clinic-password",
    });

    const replay = await changeClinicPassword(
      harness.app,
      {
        currentPassword: "new-clinic-password",
        newPassword: "attacker-chosen-password",
      },
      "clinic-session-2",
    );

    assert.equal(replay.statusCode, 401);
    assert.deepEqual(
      harness.commits.map((commit) => commit.clinicUserId),
      [7],
    );
    assert.equal(harness.getStoredHash(), "argon:new-clinic-password");
  } finally {
    await harness.app.close();
  }
});

test("password change reuses auth rate limit store for failed attempts", async () => {
  const harness = await createClinicPasswordChangeApp({
    maxAttempts: 1,
  });

  try {
    const first = await changeClinicPassword(harness.app, {
      currentPassword: "wrong-clinic-password",
      newPassword: "new-clinic-password",
    });

    assert.equal(first.statusCode, 400);
    assert.equal(first.headers["ratelimit-limit"], "1");
    assert.equal(first.headers["ratelimit-remaining"], "0");

    const second = await changeClinicPassword(harness.app, {
      currentPassword: "wrong-clinic-password",
      newPassword: "new-clinic-password",
    });

    assert.equal(second.statusCode, 429);
    assert.equal(JSON.parse(second.body).code, LOGIN_RATE_LIMIT_CODE);
    assert.deepEqual(harness.commits, []);
    assert.deepEqual(harness.auditCalls, []);
  } finally {
    await harness.app.close();
  }
});

test("password change persistence is atomic: credential write and session revocation are one SQL statement", () => {
  const source = readSource("server/db.ts");

  for (const [name, users, sessions, owner] of [
    [
      "changeClinicUserPasswordAndRevokeOtherSessions",
      "clinic_users",
      "active_sessions",
      "clinic_user_id",
    ],
    [
      "changeAdminPasswordAndRevokeOtherSessions",
      "admin_users",
      "admin_sessions",
      "admin_user_id",
    ],
  ] as const) {
    const start = source.indexOf(`export async function ${name}(`);
    assert.ok(start >= 0, name);
    const body = source.slice(start, source.indexOf("\nexport ", start + 1));

    assert.deepEqual(body.match(/db\.execute\(/g), ["db.execute("], name);
    assert.ok(body.includes(`update "${users}"`), name);
    assert.ok(body.includes(`delete from "${sessions}"`), name);
    assert.ok(
      body.includes(`"${owner}" in (select "id" from updated)`),
      `${name} revokes only sessions of the updated identity`,
    );
    assert.ok(
      body.includes(`"token_hash" <> \${input.keepSessionTokenHash}`),
      `${name} keeps the initiating session`,
    );
  }
});

test("particular auth remains token-backed and has no password change endpoint", () => {
  const source = readSource("server/routes/particular-auth.fastify.ts");

  assert.equal(source.includes("change-password"), false);
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(source.includes("verifyPassword"), false);
  assert.equal(source.includes("getParticularTokenByTokenHash"), true);
});
