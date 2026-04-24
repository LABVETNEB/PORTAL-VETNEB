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
  adminParticularTokensNativeRoutes,
} = await import("../server/routes/admin-particular-tokens.fastify.ts");

function createClinicFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    ...overrides,
  };
}

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
    createdByAdminId: 1,
    createdByClinicUserId: null,
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "ADMIN",
    }),
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(adminParticularTokensNativeRoutes as any, {
    prefix: "/api/admin/particular-tokens",
    ...createAuthStubs(),
    getClinicById: async () => createClinicFixture(),
    getReportById: async () => createReportFixture(),
    createParticularToken: async () => createParticularTokenFixture(),
    getParticularTokenById: async () => createParticularTokenFixture(),
    listParticularTokens: async () => [createParticularTokenFixture()],
    updateParticularTokenReport: async () => createParticularTokenFixture(),
    ...overrides,
  });

  return app;
}

test(
  "adminParticularTokensNativeRoutes crea POST / con payload estable y token raw",
  async () => {
    const rawToken = "a".repeat(64);
    const clinic = createClinicFixture();
    const report = createReportFixture();
    const createdToken = createParticularTokenFixture({
      tokenHash: `hash:${rawToken}`,
    });
    const createCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      generateSessionToken: () => rawToken,
      getClinicById: async (clinicId: number) => {
        assert.equal(clinicId, 3);
        return clinic;
      },
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
        url: "/api/admin/particular-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
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
      assert.equal(createCalls[0].createdByAdminId, 1);
      assert.equal(createCalls[0].createdByClinicUserId, null);
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
          createdByAdminId: 1,
          createdByClinicUserId: null,
          hasLinkedReport: true,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes bloquea POST / con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/particular-tokens",
        headers: {
          origin: "https://evil.example",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
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
  "adminParticularTokensNativeRoutes expone GET / con lista, filtros y paginación",
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
        url: "/api/admin/particular-tokens?clinicId=3&limit=5&offset=2",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].clinicId, 3);
      assert.equal(listCalls[0].limit, 5);
      assert.equal(listCalls[0].offset, 2);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        count: 1,
        particularTokens: [
          {
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
            createdByAdminId: 1,
            createdByClinicUserId: null,
            hasLinkedReport: true,
          },
        ],
        pagination: {
          limit: 5,
          offset: 2,
        },
        filters: {
          clinicId: 3,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes expone GET /:tokenId con detalle y reporte vinculado",
  async () => {
    const token = createParticularTokenFixture();
    const report = createReportFixture();

    const app = await createTestApp({
      getParticularTokenById: async (tokenId: number) => {
        assert.equal(tokenId, 7);
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
        url: "/api/admin/particular-tokens/7",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
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
          createdByAdminId: 1,
          createdByClinicUserId: null,
          hasLinkedReport: true,
          report: {
            id: 55,
            clinicId: 3,
            uploadDate: "2026-04-22T09:00:00.000Z",
            studyType: "Histopatología",
            patientName: "Luna",
            fileName: "luna-report.pdf",
            createdAt: "2026-04-22T09:00:00.000Z",
            updatedAt: "2026-04-22T09:30:00.000Z",
          },
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes vincula PATCH /:tokenId/report con trusted origin",
  async () => {
    const existing = createParticularTokenFixture({ reportId: null });
    const updated = createParticularTokenFixture({ reportId: 55 });
    const report = createReportFixture();
    const updateCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      getParticularTokenById: async () => existing,
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
        url: "/api/admin/particular-tokens/7/report",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
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
