import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../server/lib/env.ts");
const { clinicAuthNativeRoutes } = await import("../../server/routes/auth.fastify.ts");
const { adminAuthNativeRoutes } = await import("../../server/routes/admin-auth.fastify.ts");
const { particularAuthNativeRoutes } = await import("../../server/routes/particular-auth.fastify.ts");

type ClinicSessionRecord = {
  clinicUserId: number;
  expiresAt: Date;
};

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date;
  lastAccess: Date | null;
};

type ParticularSessionRecord = {
  particularTokenId: number;
  expiresAt: Date;
  lastAccess: Date;
};

type AuthBoundariesHarness = {
  app: FastifyInstance;
  clinicSessions: Map<string, ClinicSessionRecord>;
  adminSessions: Map<string, AdminSessionRecord>;
  particularSessions: Map<string, ParticularSessionRecord>;
};

const CLINIC_USER = {
  id: 11,
  clinicId: 7,
  username: "clinic-user",
  passwordHash: "clinic-password",
  authProId: null,
  role: "clinic_owner" as const,
};

const ADMIN_USER = {
  id: 91,
  username: "ADMIN",
  passwordHash: "admin-password",
};

const PARTICULAR_TOKEN = {
  id: 501,
  clinicId: 7,
  reportId: 301,
  tokenLast4: "ABCD",
  tutorLastName: "Pérez",
  petName: "Luna",
  petAge: "7 años",
  petBreed: "Caniche",
  petSex: "Hembra",
  petSpecies: "Canina",
  sampleLocation: "Oreja",
  sampleEvolution: "2 semanas",
  detailsLesion: "Lesión nodular",
  extractionDate: new Date("2026-01-10T00:00:00.000Z"),
  shippingDate: new Date("2026-01-11T00:00:00.000Z"),
  isActive: true,
  lastLoginAt: new Date("2026-01-12T00:00:00.000Z"),
  createdAt: new Date("2026-01-10T00:00:00.000Z"),
  updatedAt: new Date("2026-01-12T00:00:00.000Z"),
  createdByAdminId: 91,
  createdByClinicUserId: null,
};

const REPORT = {
  id: 301,
  clinicId: 7,
  storagePath: "reports/luna.pdf",
  uploadDate: new Date("2026-01-12T00:00:00.000Z"),
  studyType: "Histopatología",
  patientName: "Luna",
  fileName: "luna.pdf",
  createdAt: new Date("2026-01-12T00:00:00.000Z"),
  updatedAt: new Date("2026-01-12T01:00:00.000Z"),
};

function getSetCookieHeader(response: { headers: Record<string, unknown> }) {
  const raw = response.headers["set-cookie"];

  if (Array.isArray(raw)) {
    return raw.join("\n");
  }

  return typeof raw === "string" ? raw : "";
}

function toCookieHeader(setCookieHeader: string) {
  const firstLine = setCookieHeader.split("\n")[0] ?? "";
  const cookiePair = firstLine.split(";")[0] ?? "";

  return cookiePair.trim();
}

async function createAuthBoundariesHarness(): Promise<AuthBoundariesHarness> {
  const app = Fastify();
  const clinicSessions = new Map<string, ClinicSessionRecord>();
  const adminSessions = new Map<string, AdminSessionRecord>();
  const particularSessions = new Map<string, ParticularSessionRecord>();

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    createActiveSession: async (input: ClinicSessionRecord & { tokenHash: string }) => {
      clinicSessions.set(input.tokenHash, {
        clinicUserId: input.clinicUserId,
        expiresAt: input.expiresAt,
      });
    },
    deleteActiveSession: async (tokenHash: string) => {
      clinicSessions.delete(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) =>
      clinicSessions.get(tokenHash) ?? null,
    getClinicUserById: async (clinicUserId: number) =>
      clinicUserId === CLINIC_USER.id ? CLINIC_USER : null,
    getClinicUserByUsername: async (username: string) =>
      username === CLINIC_USER.username ? CLINIC_USER : null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "clinic-session-token",
    hashPassword: async () => "rehash-password",
    hashSessionToken: (token: string) => `clinic:${token}`,
    verifyPassword: async (password: string, passwordHash: string) => ({
      valid: password === passwordHash,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: async () => {},
  });

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    createAdminSession: async (
      input: AdminSessionRecord & { tokenHash: string },
    ) => {
      adminSessions.set(input.tokenHash, {
        adminUserId: input.adminUserId,
        expiresAt: input.expiresAt,
        lastAccess: input.lastAccess ?? null,
      });
    },
    deleteAdminSession: async (tokenHash: string) => {
      adminSessions.delete(tokenHash);
    },
    getAdminSessionByToken: async (tokenHash: string) =>
      adminSessions.get(tokenHash) ?? null,
    getAdminUserById: async (adminUserId: number) =>
      adminUserId === ADMIN_USER.id
        ? { id: ADMIN_USER.id, username: ADMIN_USER.username }
        : null,
    getAdminUserByUsername: async (username: string) =>
      username === ADMIN_USER.username ? ADMIN_USER : null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "admin-session-token",
    hashSessionToken: (token: string) => `admin:${token}`,
    verifyPassword: async (password: string, passwordHash: string) => ({
      valid: password === passwordHash,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: async () => {},
  });

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    createParticularSession: async (
      input: ParticularSessionRecord & { tokenHash: string },
    ) => {
      particularSessions.set(input.tokenHash, {
        particularTokenId: input.particularTokenId,
        expiresAt: input.expiresAt,
        lastAccess: input.lastAccess,
      });
    },
    deleteParticularSession: async (tokenHash: string) => {
      particularSessions.delete(tokenHash);
    },
    getParticularSessionByToken: async (tokenHash: string) =>
      particularSessions.get(tokenHash) ?? null,
    getParticularTokenById: async (tokenId: number) =>
      tokenId === PARTICULAR_TOKEN.id ? PARTICULAR_TOKEN : null,
    getParticularTokenByTokenHash: async (tokenHash: string) =>
      tokenHash === "particular:PARTICULAR-TOKEN" ? PARTICULAR_TOKEN : null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async (reportId: number) =>
      reportId === REPORT.id ? REPORT : null,
    createSignedReportUrl: async (storagePath: string) =>
      `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (storagePath: string) =>
      `download:${storagePath}`,
    generateSessionToken: () => "particular-session-token",
    hashSessionToken: (token: string) => `particular:${token}`,
    recordLoginFailedAttempt: async () => {},
  });

  return { app, clinicSessions, adminSessions, particularSessions };
}

test("clinic login crea solo cookie y sesión clínica", async () => {
  const harness = await createAuthBoundariesHarness();

  try {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: CLINIC_USER.username,
        password: CLINIC_USER.passwordHash,
      },
    });

    assert.equal(response.statusCode, 200);

    const setCookie = getSetCookieHeader(response);
    assert.ok(setCookie.includes(`${ENV.cookieName}=`));
    assert.equal(setCookie.includes(`${ENV.adminCookieName}=`), false);
    assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

    assert.equal(harness.clinicSessions.size, 1);
    assert.equal(harness.adminSessions.size, 0);
    assert.equal(harness.particularSessions.size, 0);
  } finally {
    await harness.app.close();
  }
});

test("admin login crea solo cookie y sesión admin", async () => {
  const harness = await createAuthBoundariesHarness();

  try {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: ADMIN_USER.username,
        password: ADMIN_USER.passwordHash,
      },
    });

    assert.equal(response.statusCode, 200);

    const setCookie = getSetCookieHeader(response);
    assert.ok(setCookie.includes(`${ENV.adminCookieName}=`));
    assert.equal(setCookie.includes(`${ENV.cookieName}=`), false);
    assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

    assert.equal(harness.clinicSessions.size, 0);
    assert.equal(harness.adminSessions.size, 1);
    assert.equal(harness.particularSessions.size, 0);
  } finally {
    await harness.app.close();
  }
});

test("particular login crea solo cookie y sesión particular", async () => {
  const harness = await createAuthBoundariesHarness();

  try {
    const response = await harness.app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        token: "PARTICULAR-TOKEN",
      },
    });

    assert.equal(response.statusCode, 200);

    const setCookie = getSetCookieHeader(response);
    assert.ok(setCookie.includes(`${ENV.particularCookieName}=`));
    assert.equal(setCookie.includes(`${ENV.cookieName}=`), false);
    assert.equal(setCookie.includes(`${ENV.adminCookieName}=`), false);

    assert.equal(harness.clinicSessions.size, 0);
    assert.equal(harness.adminSessions.size, 0);
    assert.equal(harness.particularSessions.size, 1);
  } finally {
    await harness.app.close();
  }
});

test("endpoints /me respetan límites de sesión por superficie sin fallback cruzado", async () => {
  const harness = await createAuthBoundariesHarness();

  try {
    const clinicLogin = await harness.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: {
        username: CLINIC_USER.username,
        password: CLINIC_USER.passwordHash,
      },
    });
    const clinicCookie = toCookieHeader(getSetCookieHeader(clinicLogin));

    const adminLogin = await harness.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: {
        username: ADMIN_USER.username,
        password: ADMIN_USER.passwordHash,
      },
    });
    const adminCookie = toCookieHeader(getSetCookieHeader(adminLogin));

    const particularLogin = await harness.app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: { token: "PARTICULAR-TOKEN" },
    });
    const particularCookie = toCookieHeader(getSetCookieHeader(particularLogin));

    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: { cookie: clinicCookie },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/admin/auth/me",
          headers: { cookie: adminCookie },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/particular/auth/me",
          headers: { cookie: particularCookie },
        })
      ).statusCode,
      200,
    );

    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/admin/auth/me",
          headers: { cookie: clinicCookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: { cookie: adminCookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: { cookie: particularCookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/admin/auth/me",
          headers: { cookie: particularCookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/particular/auth/me",
          headers: { cookie: clinicCookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await harness.app.inject({
          method: "GET",
          url: "/api/particular/auth/me",
          headers: { cookie: adminCookie },
        })
      ).statusCode,
      401,
    );
  } finally {
    await harness.app.close();
  }
});

test("frontend proxy mantiene separación dashboard/admin y deja particulares fuera", () => {
  const source = readFileSync(
    resolve(process.cwd(), "frontend/src/proxy.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert.ok(source.includes('from "../../shared/session-cookie-names"'));
  assert.ok(source.includes("CLINIC_SESSION_COOKIE_NAME"));
  assert.ok(source.includes("ADMIN_SESSION_COOKIE_NAME"));
  assert.ok(source.includes("function getRequiredSessionCookieName(pathname: string): string"));
  assert.ok(source.includes("return isAdminDashboardPath(pathname)"));
  assert.ok(source.includes("? ADMIN_SESSION_COOKIE_NAME"));
  assert.ok(source.includes(": CLINIC_SESSION_COOKIE_NAME"));
  assert.ok(source.includes('matcher: ["/dashboard/:path*"]'));
  assert.equal(source.includes("/particulares"), false);
  assert.equal(source.includes("hasClinicSession || hasAdminSession"), false);
});
