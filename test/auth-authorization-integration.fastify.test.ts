import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { getClinicPermissions } = await import("../server/lib/permissions.ts");
const { clinicAuthNativeRoutes } = await import("../server/routes/auth.fastify.ts");
const { reportsNativeRoutes } = await import("../server/routes/reports.fastify.ts");

type StoredSession = {
  clinicUserId: number;
  tokenHash: string;
  expiresAt: Date;
};

function getSetCookieHeader(response: { headers: Record<string, unknown> }) {
  const raw = response.headers["set-cookie"];

  if (Array.isArray(raw)) {
    return raw.join("\n");
  }

  return typeof raw === "string" ? raw : "";
}

function extractCookiePair(setCookie: string) {
  const firstPart = setCookie.split(";")[0];

  assert.ok(firstPart, "set-cookie debe incluir name=value");

  return firstPart;
}

function createReportFixture() {
  return {
    id: 55,
    clinicId: 3,
    patientName: "Luna Gomez",
    studyType: "Histopatologia",
    uploadDate: new Date("2026-04-20T00:00:00.000Z"),
    fileName: "luna.pdf",
    storagePath: "reports/3/luna.pdf",
    previewUrl: null,
    downloadUrl: null,
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-21T00:00:00.000Z"),
    statusChangedByClinicUserId: 9,
    statusChangedByAdminUserId: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
  };
}

async function createIntegrationApp() {
  const app = Fastify();
  const sessions = new Map<string, StoredSession>();
  const deletedSessionHashes: string[] = [];
  const reportCalls: Array<{
    clinicId: number;
    limit: number;
    offset: number;
    currentStatus?: string;
  }> = [];

  const hashSessionToken = (token: string) => `hash:${token}`;

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    now: () => Date.UTC(2026, 4, 5, 0, 0, 0),
    createActiveSession: async (input: StoredSession) => {
      sessions.set(input.tokenHash, input);
    },
    deleteActiveSession: async (tokenHash: string) => {
      deletedSessionHashes.push(tokenHash);
      sessions.delete(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) => sessions.get(tokenHash) ?? null,
    getClinicUserById: async (clinicUserId: number) => {
      if (clinicUserId !== 9) {
        return null;
      }

      return {
        id: 9,
        clinicId: 3,
        username: "doctor",
        authProId: "AUTH-9",
        role: "clinic_owner",
      };
    },
    getClinicUserByUsername: async (username: string) => {
      if (username !== "doctor") {
        return null;
      }

      return {
        id: 9,
        clinicId: 3,
        username: "doctor",
        passwordHash: "stored-hash",
        authProId: "AUTH-9",
        role: "clinic_owner",
      };
    },
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "session-token",
    hashPassword: async () => "unused",
    hashSessionToken,
    verifyPassword: async (password: string) => ({
      valid: password === "secret",
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  });

  await app.register(reportsNativeRoutes as any, {
    prefix: "/api/reports",
    now: () => Date.UTC(2026, 4, 5, 0, 0, 0),
    deleteActiveSession: async (tokenHash: string) => {
      deletedSessionHashes.push(tokenHash);
      sessions.delete(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) => sessions.get(tokenHash) ?? null,
    getClinicUserById: async (clinicUserId: number) => {
      if (clinicUserId !== 9) {
        return null;
      }

      return {
        id: 9,
        clinicId: 3,
        username: "doctor",
        authProId: "AUTH-9",
        role: "clinic_owner",
      };
    },
    updateSessionLastAccess: async () => {},
    hashSessionToken,
    getReportsByClinicId: async (
      clinicId: number,
      limit: number,
      offset: number,
      currentStatus?: string,
    ) => {
      reportCalls.push({
        clinicId,
        limit,
        offset,
        currentStatus,
      });

      return [createReportFixture()];
    },
    searchReports: async () => [],
    getStudyTypes: async () => [],
    getReportById: async () => null,
    getReportStatusHistory: async () => [],
    getClinicScopedStudyTrackingCase: async () => null,
    updateStudyTrackingCase: async () => null,
    uploadReport: async () => "reports/test.pdf",
    upsertReport: async () => ({}),
    createSignedReportUrl: async (storagePath: string) => `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `download:${storagePath}:${fileName ?? ""}`,
  });

  return {
    app,
    sessions,
    deletedSessionHashes,
    reportCalls,
  };
}

test("auth integration permite usar cookie de login en endpoint protegido y respeta clinic scope", async () => {
  const { app, sessions, reportCalls } = await createIntegrationApp();

  try {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: " doctor ",
        password: "secret",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const loginBody = JSON.parse(loginResponse.body);
    assert.deepEqual(loginBody, {
      success: true,
      clinicUser: {
        id: 9,
        clinicId: 3,
        username: "doctor",
        authProId: "AUTH-9",
        role: "clinic_owner",
      },
      permissions: getClinicPermissions("clinic_owner"),
    });

    const setCookie = getSetCookieHeader(loginResponse);
    assert.ok(setCookie.includes(`${ENV.cookieName}=session-token`));
    assert.equal(sessions.size, 1);

    const cookie = extractCookiePair(setCookie);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        origin: "http://localhost:3000",
        cookie,
      },
    });

    assert.equal(meResponse.statusCode, 200);
    assert.equal(JSON.parse(meResponse.body).clinicUser.clinicId, 3);

    const reportsResponse = await app.inject({
      method: "GET",
      url: "/api/reports?status=ready&limit=5&offset=2",
      headers: {
        origin: "http://localhost:3000",
        cookie,
      },
    });

    assert.equal(reportsResponse.statusCode, 200);

    const reportsBody = JSON.parse(reportsResponse.body);
    assert.equal(reportsBody.success, true);
    assert.equal(reportsBody.count, 1);
    assert.equal(reportsBody.reports[0].id, 55);
    assert.equal(reportsBody.reports[0].previewUrl, "preview:reports/3/luna.pdf");
    assert.equal(reportsBody.reports[0].downloadUrl, "download:reports/3/luna.pdf:luna.pdf");

    assert.deepEqual(reportCalls, [
      {
        clinicId: 3,
        limit: 5,
        offset: 2,
        currentStatus: "ready",
      },
    ]);

    const crossClinicResponse = await app.inject({
      method: "GET",
      url: "/api/reports?clinicId=99",
      headers: {
        origin: "http://localhost:3000",
        cookie,
      },
    });

    assert.equal(crossClinicResponse.statusCode, 403);
    assert.deepEqual(JSON.parse(crossClinicResponse.body), {
      success: false,
      error: "No autorizado para consultar otra clinica",
    });

    assert.equal(reportCalls.length, 1);
  } finally {
    await app.close();
  }
});

test("auth integration logout invalida la cookie para endpoints protegidos", async () => {
  const { app, sessions, deletedSessionHashes } = await createIntegrationApp();

  try {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "doctor",
        password: "secret",
      },
    });

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(sessions.size, 1);

    const cookie = extractCookiePair(getSetCookieHeader(loginResponse));

    const beforeLogoutResponse = await app.inject({
      method: "GET",
      url: "/api/reports",
      headers: {
        cookie,
      },
    });

    assert.equal(beforeLogoutResponse.statusCode, 200);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie,
      },
    });

    assert.equal(logoutResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(logoutResponse.body), {
      success: true,
      message: "Sesi\u00f3n cerrada correctamente",
    });

    assert.deepEqual(deletedSessionHashes, ["hash:session-token"]);
    assert.equal(sessions.size, 0);

    const logoutSetCookie = getSetCookieHeader(logoutResponse);
    assert.ok(logoutSetCookie.includes(`${ENV.cookieName}=`));
    assert.ok(logoutSetCookie.includes("Max-Age=0"));

    const afterLogoutResponse = await app.inject({
      method: "GET",
      url: "/api/reports",
      headers: {
        cookie,
      },
    });

    assert.equal(afterLogoutResponse.statusCode, 401);

    const afterLogoutBody = JSON.parse(afterLogoutResponse.body);

    assert.equal(afterLogoutBody.success, false);
    assert.equal(typeof afterLogoutBody.error, "string");
    assert.ok(afterLogoutBody.error.length > 0);
    assert.equal(Object.prototype.hasOwnProperty.call(afterLogoutBody, "reports"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(afterLogoutBody, "clinicUser"), false);
  } finally {
    await app.close();
  }
});
