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
const {
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../server/lib/login-rate-limit.ts");
const {
  particularAuthNativeRoutes,
} = await import("../server/routes/particular-auth.fastify.ts");

function createParticularTokenFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    clinicId: 3,
    reportId: 55,
    tokenLast4: "ABCD",
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    detailsLesion: "Lesión nodular pequeña",
    extractionDate: new Date("2026-04-20T00:00:00.000Z"),
    shippingDate: new Date("2026-04-21T00:00:00.000Z"),
    isActive: true,
    lastLoginAt: new Date("2026-04-22T10:00:00.000Z"),
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    createdByAdminId: 1,
    createdByClinicUserId: null,
    ...overrides,
  };
}

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    clinicId: 3,
    storagePath: "reports/report-55.pdf",
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatología",
    patientName: "Luna",
    fileName: "luna-report.pdf",
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    createParticularSession: async () => {},
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    getParticularTokenByTokenHash: async () => null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    generateSessionToken: () => "particular-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  });

  return app;
}

function getSetCookieHeader(response: { headers: Record<string, unknown> }) {
  const raw = response.headers["set-cookie"];

  if (Array.isArray(raw)) {
    return raw.join("\n");
  }

  return typeof raw === "string" ? raw : "";
}

test(
  "particularAuthNativeRoutes login exitoso conserva payload, cookie y lastLogin",
  async () => {
    const sessionCalls: Array<{
      particularTokenId: number;
      tokenHash: string;
      lastAccess: Date;
      expiresAt: Date;
    }> = [];
    const lastLoginCalls: number[] = [];
    const particularToken = createParticularTokenFixture();
    const report = createReportFixture();

    const app = await createTestApp({
      now: () => 0,
      getParticularTokenByTokenHash: async (tokenHash: string) => {
        assert.equal(tokenHash, "hash:PARTICULAR-RAW-TOKEN");
        return particularToken;
      },
      createParticularSession: async (input: {
        particularTokenId: number;
        tokenHash: string;
        lastAccess: Date;
        expiresAt: Date;
      }) => {
        sessionCalls.push(input);
      },
      updateParticularTokenLastLogin: async (tokenId: number) => {
        lastLoginCalls.push(tokenId);
      },
      getParticularTokenById: async (tokenId: number) => {
        assert.equal(tokenId, particularToken.id);
        return particularToken;
      },
      getReportById: async (reportId: number) => {
        assert.equal(reportId, report.id);
        return report;
      },
      generateSessionToken: () => "particular-session-123",
      hashSessionToken: (token: string) => `hash:${token}`,
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          token: " PARTICULAR-RAW-TOKEN ",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["access-control-allow-credentials"], "true");

      const setCookie = getSetCookieHeader(response);
      assert.ok(
        setCookie.includes(
          `${ENV.particularCookieName}=particular-session-123`,
        ),
      );
      assert.ok(setCookie.includes("Path=/"));
      assert.ok(setCookie.includes("HttpOnly"));

      assert.equal(sessionCalls.length, 1);
      assert.equal(sessionCalls[0].particularTokenId, particularToken.id);
      assert.equal(sessionCalls[0].tokenHash, "hash:particular-session-123");
      assert.equal(
        sessionCalls[0].expiresAt.getTime(),
        ENV.sessionTtlHours * 60 * 60 * 1000,
      );
      assert.equal(sessionCalls[0].lastAccess.getTime(), 0);
      assert.deepEqual(lastLoginCalls, [particularToken.id]);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        particular: {
          id: particularToken.id,
          clinicId: particularToken.clinicId,
          reportId: particularToken.reportId,
          tokenLast4: particularToken.tokenLast4,
          tutorLastName: particularToken.tutorLastName,
          petName: particularToken.petName,
          petAge: particularToken.petAge,
          petBreed: particularToken.petBreed,
          petSex: particularToken.petSex,
          petSpecies: particularToken.petSpecies,
          sampleLocation: particularToken.sampleLocation,
          sampleEvolution: particularToken.sampleEvolution,
          detailsLesion: particularToken.detailsLesion,
          extractionDate: particularToken.extractionDate.toISOString(),
          shippingDate: particularToken.shippingDate.toISOString(),
          isActive: particularToken.isActive,
          lastLoginAt: particularToken.lastLoginAt.toISOString(),
          createdAt: particularToken.createdAt.toISOString(),
          updatedAt: particularToken.updatedAt.toISOString(),
          createdByAdminId: particularToken.createdByAdminId,
          createdByClinicUserId: particularToken.createdByClinicUserId,
          hasLinkedReport: true,
          report: {
            id: report.id,
            clinicId: report.clinicId,
            uploadDate: report.uploadDate.toISOString(),
            studyType: report.studyType,
            patientName: report.patientName,
            fileName: report.fileName,
            createdAt: report.createdAt.toISOString(),
            updatedAt: report.updatedAt.toISOString(),
          },
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "particularAuthNativeRoutes bloquea login con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: {
          origin: "https://evil.example",
        },
        payload: {
          token: "PARTICULAR-RAW-TOKEN",
        },
      });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Origen no permitido",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "particularAuthNativeRoutes expone /me con sesión particular válida por cookie",
  async () => {
    const lastAccessCalls: string[] = [];
    const particularToken = createParticularTokenFixture();
    const report = createReportFixture();

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getParticularSessionByToken: async (tokenHash: string) => {
        assert.equal(tokenHash, "hash:particular-session-token");

        return {
          particularTokenId: particularToken.id,
          expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
          lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
        };
      },
      getParticularTokenById: async (tokenId: number) => {
        assert.equal(tokenId, particularToken.id);
        return particularToken;
      },
      updateParticularSessionLastAccess: async (tokenHash: string) => {
        lastAccessCalls.push(tokenHash);
      },
      getReportById: async (reportId: number) => {
        assert.equal(reportId, report.id);
        return report;
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular/auth/me",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.particularCookieName}=particular-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.deepEqual(lastAccessCalls, ["hash:particular-session-token"]);

      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.particular.id, particularToken.id);
      assert.equal(body.particular.report.id, report.id);
      assert.equal(body.particular.hasLinkedReport, true);
    } finally {
      await app.close();
    }
  },
);

test(
  "particularAuthNativeRoutes logout elimina sesión y limpia cookie",
  async () => {
    const deletedHashes: string[] = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getParticularSessionByToken: async () => ({
        particularTokenId: 7,
        expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
        lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
      }),
      getParticularTokenById: async () => ({
        id: 7,
        clinicId: 3,
        reportId: 55,
        isActive: true,
      }),
      updateParticularSessionLastAccess: async () => {},
      deleteParticularSession: async (tokenHash: string) => {
        deletedHashes.push(tokenHash);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/particular/auth/logout",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.particularCookieName}=particular-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Sesión particular cerrada correctamente",
      });

      assert.deepEqual(deletedHashes, ["hash:particular-session-token"]);

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.particularCookieName}=`));
      assert.ok(setCookie.includes("Max-Age=0"));
    } finally {
      await app.close();
    }
  },
);

test(
  "particularAuthNativeRoutes expone preview-url cuando hay informe vinculado",
  async () => {
    const report = createReportFixture();

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getParticularSessionByToken: async () => ({
        particularTokenId: 7,
        expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
        lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
      }),
      getParticularTokenById: async () => ({
        id: 7,
        clinicId: 3,
        reportId: 55,
        isActive: true,
      }),
      updateParticularSessionLastAccess: async () => {},
      getReportById: async () => report,
      createSignedReportUrl: async (storagePath: string) => {
        assert.equal(storagePath, report.storagePath);
        return "https://signed.example/preview";
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular/auth/report/preview-url",
        headers: {
          cookie: `${ENV.particularCookieName}=particular-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        previewUrl: "https://signed.example/preview",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "particularAuthNativeRoutes expone download-url cuando hay informe vinculado",
  async () => {
    const report = createReportFixture();

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getParticularSessionByToken: async () => ({
        particularTokenId: 7,
        expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
        lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
      }),
      getParticularTokenById: async () => ({
        id: 7,
        clinicId: 3,
        reportId: 55,
        isActive: true,
      }),
      updateParticularSessionLastAccess: async () => {},
      getReportById: async () => report,
      createSignedReportDownloadUrl: async (
        storagePath: string,
        fileName?: string,
      ) => {
        assert.equal(storagePath, report.storagePath);
        assert.equal(fileName, report.fileName);
        return "https://signed.example/download";
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular/auth/report/download-url",
        headers: {
          cookie: `${ENV.particularCookieName}=particular-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        downloadUrl: "https://signed.example/download",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "particularAuthNativeRoutes aplica rate limit de login sobre intentos fallidos",
  async () => {
    const app = await createTestApp({
      now: () => 0,
      loginRateLimitWindowMs: 60_000,
      loginRateLimitMaxAttempts: 2,
      getParticularTokenByTokenHash: async () => null,
    });

    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        remoteAddress: "203.0.113.30",
        payload: {
          token: "bad-1",
        },
      });

      const second = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        remoteAddress: "203.0.113.30",
        payload: {
          token: "bad-2",
        },
      });

      const third = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        remoteAddress: "203.0.113.30",
        payload: {
          token: "bad-3",
        },
      });

      assert.equal(first.statusCode, 401);
      assert.equal(second.statusCode, 401);
      assert.equal(third.statusCode, 429);
      assert.equal(third.headers["ratelimit-limit"], "2");
      assert.equal(third.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(third.body), {
        success: false,
        error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      });
    } finally {
      await app.close();
    }
  },
);
