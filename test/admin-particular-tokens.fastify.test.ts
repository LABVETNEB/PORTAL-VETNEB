import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??= "http://localhost:3000";

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

function createTrackingCaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    clinicId: 3,
    reportId: 55,
    particularTokenId: 7,
    createdByAdminId: 1,
    createdByClinicUserId: null,
    receptionAt: new Date("2026-04-20T00:00:00.000Z"),
    estimatedDeliveryAt: new Date("2026-05-08T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt: new Date("2026-05-08T00:00:00.000Z"),
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "reception",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: null,
    adminContactEmail: null,
    adminContactPhone: null,
    notes: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-20T12:30:00.000Z"),
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
    revokeParticularToken: async () =>
      createParticularTokenFixture({
        isActive: false,
      }),
    deleteParticularToken: async (id: number) => ({ id }),
    sendParticularTokenEmail: async () => ({
      sent: true,
      messageId: "particular-email-1",
    }),
    getParticularStudyTrackingCase: async () => createTrackingCaseFixture(),
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => createTrackingCaseFixture(),
    updateStudyTrackingCase: async () => createTrackingCaseFixture(),
    createStudyTrackingNotification: async () => ({
      id: 29,
      studyTrackingCaseId: 11,
      clinicId: 3,
      reportId: 55,
      particularTokenId: 7,
      type: "token_created",
      title: "Token particular generado",
      message: "Se generó un token particular para Luna.",
      isRead: false,
      readAt: null,
      createdAt: new Date("2026-04-20T13:00:00.000Z"),
    }),
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
    const emailCalls: Array<Record<string, unknown>> = [];
    const notificationCalls: Array<Record<string, unknown>> = [];

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
      sendParticularTokenEmail: async (input: Record<string, unknown>) => {
        emailCalls.push(input);
        return { sent: true, messageId: "particular-email-1" };
      },
      createStudyTrackingNotification: async (input: Record<string, unknown>) => {
        notificationCalls.push(input);
        return {
          id: 29,
          studyTrackingCaseId: 11,
          clinicId: 3,
          reportId: 55,
          particularTokenId: 7,
          type: "token_created",
          title: "Token particular generado",
          message: "Se generó un token particular para Luna.",
          isRead: false,
          readAt: null,
          createdAt: new Date("2026-04-20T13:00:00.000Z"),
        };
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
          recipientEmail: "tutor@example.com",
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
      assert.equal(createCalls[0].recipientEmail, undefined);
      assert.deepEqual(emailCalls, [
        {
          to: "tutor@example.com",
          token: rawToken,
          tutorLastName: "Gomez",
          petName: "Luna",
        },
      ]);
      assert.equal(notificationCalls.length, 1);
      assert.equal(notificationCalls[0].studyTrackingCaseId, 11);
      assert.equal(notificationCalls[0].clinicId, 3);
      assert.equal(notificationCalls[0].reportId, 55);
      assert.equal(notificationCalls[0].particularTokenId, 7);
      assert.equal(notificationCalls[0].type, "token_created");
      assert.equal(notificationCalls[0].title, "Token particular generado");
      assert.equal(
        notificationCalls[0].message,
        "Se generó un token particular para Luna.",
      );
      assert.equal(String(notificationCalls[0].message).includes(rawToken), false);

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
  "adminParticularTokensNativeRoutes valida recipientEmail antes de crear token",
  async () => {
    const createCalls: Array<Record<string, unknown>> = [];
    const emailCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      createParticularToken: async (input: Record<string, unknown>) => {
        createCalls.push(input);
        return createParticularTokenFixture();
      },
      sendParticularTokenEmail: async (input: Record<string, unknown>) => {
        emailCalls.push(input);
        return { sent: true, messageId: "particular-email-1" };
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
          recipientEmail: "no-es-email",
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

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Email del particular inválido",
      });
      assert.equal(createCalls.length, 0);
      assert.equal(emailCalls.length, 0);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes mantiene creación si ensureTrackingForToken falla",
  async () => {
    const createdToken = createParticularTokenFixture();
    const notificationCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      createParticularToken: async () => createdToken,
      getParticularStudyTrackingCase: async () => {
        throw new Error("db timeout");
      },
      createStudyTrackingNotification: async (input: Record<string, unknown>) => {
        notificationCalls.push(input);
        return {
          id: 33,
          studyTrackingCaseId: 11,
          clinicId: 3,
          reportId: 55,
          particularTokenId: 7,
          type: "token_created",
          title: "Token particular generado",
          message: "Se generó un token particular para Luna.",
          isRead: false,
          readAt: null,
          createdAt: new Date("2026-04-20T13:00:00.000Z"),
        };
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
          recipientEmail: "tutor@example.com",
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
      assert.equal(notificationCalls.length, 0);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.ok(body.token);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes desactiva token si falla el envío de email",
  async () => {
    const createdToken = createParticularTokenFixture();
    const createCalls: Array<Record<string, unknown>> = [];
    const revokeCalls: number[] = [];

    const app = await createTestApp({
      createParticularToken: async (input: Record<string, unknown>) => {
        createCalls.push(input);
        return createdToken;
      },
      revokeParticularToken: async (tokenId: number) => {
        revokeCalls.push(tokenId);
        return createParticularTokenFixture({ id: tokenId, isActive: false });
      },
      sendParticularTokenEmail: async () => ({
        sent: false,
        reason: "smtp_disabled",
      }),
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
          recipientEmail: "tutor@example.com",
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

      const body = JSON.parse(response.body);
      assert.equal(response.statusCode, 503);
      assert.equal(body.success, false);
      assert.equal(body.reason, "smtp_disabled");
      assert.equal(body.token, undefined);
      assert.equal(createCalls.length, 1);
      assert.equal(createCalls[0].recipientEmail, undefined);
      assert.deepEqual(revokeCalls, [7]);
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
  "adminParticularTokensNativeRoutes normaliza paginación default, max e inválida",
  async () => {
    const listCalls: Array<Record<string, unknown>> = [];
    const app = await createTestApp({
      listParticularTokens: async (params: Record<string, unknown>) => {
        listCalls.push(params);
        return [];
      },
    });

    try {
      const baseHeaders = {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      };
      const defaultResponse = await app.inject({
        method: "GET",
        url: "/api/admin/particular-tokens",
        headers: baseHeaders,
      });
      const maxResponse = await app.inject({
        method: "GET",
        url: "/api/admin/particular-tokens?limit=999&offset=2",
        headers: baseHeaders,
      });
      const invalidResponse = await app.inject({
        method: "GET",
        url: "/api/admin/particular-tokens?limit=abc&offset=-2",
        headers: baseHeaders,
      });

      assert.equal(defaultResponse.statusCode, 200);
      assert.equal(maxResponse.statusCode, 200);
      assert.equal(invalidResponse.statusCode, 200);
      assert.equal(listCalls.length, 3);
      assert.equal(listCalls[0].limit, 50);
      assert.equal(listCalls[0].offset, 0);
      assert.equal(listCalls[1].limit, 100);
      assert.equal(listCalls[1].offset, 2);
      assert.equal(listCalls[2].limit, 50);
      assert.equal(listCalls[2].offset, 0);

      assert.deepEqual(JSON.parse(defaultResponse.body).pagination, {
        limit: 50,
        offset: 0,
      });
      assert.deepEqual(JSON.parse(maxResponse.body).pagination, {
        limit: 100,
        offset: 2,
      });
      assert.deepEqual(JSON.parse(invalidResponse.body).pagination, {
        limit: 50,
        offset: 0,
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
            status: "ready",
            currentStatus: "ready",
            statusChangedAt: "2026-04-22T09:30:00.000Z",
            createdAt: "2026-04-22T09:00:00.000Z",
            updatedAt: "2026-04-22T09:30:00.000Z",
            hasFile: true,
          },
        },
      });
      assert.equal(response.body.includes("storagePath"), false);
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

test(
  "adminParticularTokensNativeRoutes PATCH /:tokenId/revoke ahora hard-deletea y responde deletedTokenId",
  async () => {
    const activeToken = createParticularTokenFixture({ isActive: true });
    const deleteCalls: number[] = [];

    const app = await createTestApp({
      getParticularTokenById: async () => activeToken,
      deleteParticularToken: async (tokenId: number) => {
        deleteCalls.push(tokenId);
        return { id: tokenId };
      },
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/admin/particular-tokens/7/revoke",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(deleteCalls, [7]);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.message, "Token particular eliminado correctamente");
      assert.equal(body.deletedTokenId, 7);
      assert.equal(body.particularToken, undefined);
      assert.equal(body.tokenHash, undefined);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes DELETE /:tokenId elimina físicamente y responde deletedTokenId",
  async () => {
    const activeToken = createParticularTokenFixture({ isActive: true });
    const deleteCalls: number[] = [];

    const app = await createTestApp({
      getParticularTokenById: async () => activeToken,
      deleteParticularToken: async (tokenId: number) => {
        deleteCalls.push(tokenId);
        return { id: tokenId };
      },
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/admin/particular-tokens/7",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(deleteCalls, [7]);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.message, "Token particular eliminado correctamente");
      assert.equal(body.deletedTokenId, 7);
      assert.equal(body.particularToken, undefined);
      assert.equal(body.tokenHash, undefined);
      assert.equal(body.tokenLast4, undefined);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes DELETE /:tokenId devuelve 404 si token no existe",
  async () => {
    const app = await createTestApp({
      getParticularTokenById: async () => undefined,
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/admin/particular-tokens/999",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 404);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Token particular no encontrado",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminParticularTokensNativeRoutes DELETE /:tokenId bloquea origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/admin/particular-tokens/7",
        headers: {
          origin: "https://evil.example",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
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
  "adminParticularTokensNativeRoutes GET / no devuelve tokenHash en listado",
  async () => {
    const token = createParticularTokenFixture();
    const app = await createTestApp({
      listParticularTokens: async () => [token],
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/particular-tokens",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.particularTokens[0].tokenHash, undefined);
      assert.ok(body.particularTokens[0].tokenLast4);
    } finally {
      await app.close();
    }
  },
);
