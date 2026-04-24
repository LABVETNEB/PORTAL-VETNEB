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
  particularTokensNativeRoutes,
} = await import("../server/routes/particular-tokens.fastify.ts");

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatología",
    patientName: "Luna",
    fileName: "luna-report.pdf",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
    storagePath: "reports/report-55.pdf",
    ...overrides,
  };
}

function createParticularTokenFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    clinicId: 3,
    reportId: 55,
    tokenHash: "hash:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    tokenLast4: "aaaa",
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
    lastLoginAt: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    createdByAdminId: null,
    createdByClinicUserId: 9,
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => ({
      clinicUserId: 9,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getClinicUserById: async () => ({
      id: 9,
      clinicId: 3,
      username: "doctor",
      authProId: null,
      role: "clinic_owner",
    }),
    updateSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(particularTokensNativeRoutes as any, {
    prefix: "/api/particular-tokens",
    ...createAuthStubs(),
    getReportById: async () => createReportFixture(),
    createParticularToken: async () => createParticularTokenFixture(),
    getClinicScopedParticularToken: async () => createParticularTokenFixture(),
    listParticularTokens: async () => [createParticularTokenFixture()],
    updateParticularTokenReport: async () => createParticularTokenFixture(),
    ...overrides,
  });

  return app;
}

test(
  "particularTokensNativeRoutes crea POST / con payload estable y token raw",
  async () => {
    const rawToken = "a".repeat(64);
    const report = createReportFixture();
    const createdToken = createParticularTokenFixture({
      tokenHash: `hash:${rawToken}`,
    });
    const createCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      generateSessionToken: () => rawToken,
      getReportById: async (reportId: number) => {
        assert.equal(reportId, 55);
        return report;
      },
      createParticularToken: async (input: Record<string, unknown>) => {
        createCalls.push(input);
        return createdToken;
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/particular-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          reportId: 55,
          tutorLastName: "Gomez",
          petName: "Luna",
          petAge: "8 años",
          petBreed: "Caniche",
          petSex: "Hembra",
          petSpecies: "Canina",
          sampleLocation: "Pabellón auricular",
          sampleEvolution: "15 días",
          detailsLesion: "Lesión nodular pequeña",
          extractionDate: "2026-04-20T00:00:00.000Z",
          shippingDate: "2026-04-21T00:00:00.000Z",
        },
      });

      assert.equal(response.statusCode, 201);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(createCalls.length, 1);
      assert.equal(createCalls[0].clinicId, 3);
      assert.equal(createCalls[0].reportId, 55);
      assert.equal(createCalls[0].createdByAdminId, null);
      assert.equal(createCalls[0].createdByClinicUserId, 9);
      assert.equal(createCalls[0].tokenHash, `hash:${rawToken}`);
      assert.equal(createCalls[0].tokenLast4, "aaaa");

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Token particular creado correctamente",
        token: rawToken,
        particularToken: {
          id: 7,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "aaaa",
          tutorLastName: "Gomez",
          petName: "Luna",
          petAge: "8 años",
          petBreed: "Caniche",
          petSex: "Hembra",
          petSpecies: "Canina",
          sampleLocation: "Pabellón auricular",
          sampleEvolution: "15 días",
          detailsLesion: "Lesión nodular pequeña",
          extractionDate: "2026-04-20T00:00:00.000Z",
          shippingDate: "2026-04-21T00:00:00.000Z",
          isActive: true,
          lastLoginAt: null,
          createdAt: "2026-04-20T12:00:00.000Z",
          updatedAt: "2026-04-22T12:00:00.000Z",
          createdByAdminId: null,
          createdByClinicUserId: 9,
          hasLinkedReport: true,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "particularTokensNativeRoutes bloquea POST / con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/particular-tokens",
        headers: {
          origin: "https://evil.example",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          tutorLastName: "Gomez",
          petName: "Luna",
          petAge: "8 años",
          petBreed: "Caniche",
          petSex: "Hembra",
          petSpecies: "Canina",
          sampleLocation: "Pabellón auricular",
          sampleEvolution: "15 días",
          extractionDate: "2026-04-20T00:00:00.000Z",
          shippingDate: "2026-04-21T00:00:00.000Z",
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
  "particularTokensNativeRoutes expone GET / con lista y paginación clinic-scoped",
  async () => {
    const listCalls: Array<Record<string, unknown>> = [];
    const token = createParticularTokenFixture();

    const app = await createTestApp({
      listParticularTokens: async (params: Record<string, unknown>) => {
        listCalls.push(params);
        return [token];
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular-tokens?limit=5&offset=2",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].clinicId, 3);
      assert.equal(listCalls[0].limit, 5);
      assert.equal(listCalls[0].offset, 2);

      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.count, 1);
      assert.equal(body.pagination.limit, 5);
      assert.equal(body.pagination.offset, 2);
      assert.equal(body.particularTokens[0].id, 7);
      assert.equal(body.particularTokens[0].clinicId, 3);
      assert.equal(body.particularTokens[0].hasLinkedReport, true);
    } finally {
      await app.close();
    }
  },
);

test(
  "particularTokensNativeRoutes expone GET /:tokenId con detalle y reporte vinculado",
  async () => {
    const token = createParticularTokenFixture();
    const report = createReportFixture();

    const app = await createTestApp({
      getClinicScopedParticularToken: async (
        tokenId: number,
        clinicId: number,
      ) => {
        assert.equal(tokenId, 7);
        assert.equal(clinicId, 3);
        return token;
      },
      getReportById: async (reportId: number) => {
        assert.equal(reportId, 55);
        return report;
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular-tokens/7",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);

      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.particularToken.id, 7);
      assert.equal(body.particularToken.clinicId, 3);
      assert.equal(body.particularToken.reportId, 55);
      assert.equal(body.particularToken.report.id, 55);
    } finally {
      await app.close();
    }
  },
);

test(
  "particularTokensNativeRoutes vincula PATCH /:tokenId/report con trusted origin",
  async () => {
    const existing = createParticularTokenFixture({ reportId: null });
    const updated = createParticularTokenFixture({ reportId: 55 });
    const report = createReportFixture();
    const updateCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      getClinicScopedParticularToken: async (
        tokenId: number,
        clinicId: number,
      ) => {
        assert.equal(tokenId, 7);
        assert.equal(clinicId, 3);
        return existing;
      },
      getReportById: async () => report,
      updateParticularTokenReport: async (
        tokenId: number,
        reportId: number | null,
      ) => {
        updateCalls.push({ tokenId, reportId });
        return updated;
      },
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/particular-tokens/7/report",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          reportId: 55,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(updateCalls, [{ tokenId: 7, reportId: 55 }]);

      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.message, "Informe vinculado al token correctamente");
      assert.equal(body.particularToken.id, 7);
      assert.equal(body.particularToken.reportId, 55);
      assert.equal(body.particularToken.report.id, 55);
    } finally {
      await app.close();
    }
  },
);
