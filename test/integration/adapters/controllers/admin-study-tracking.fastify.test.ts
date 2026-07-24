import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const {
  adminStudyTrackingNativeRoutes,
} = await import("../../../../server/routes/admin-study-tracking.fastify.ts");

function createTrackingCaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    clinicId: 3,
    reportId: 55,
    particularTokenId: 7,
    createdByAdminId: 1,
    createdByClinicUserId: null,
    receptionAt: new Date("2026-04-20T00:00:00.000Z"),
    estimatedDeliveryAt: new Date("2026-05-11T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt: new Date("2026-05-11T00:00:00.000Z"),
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "reception",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: "https://pay.example/study-11",
    adminContactEmail: "admin@example.com",
    adminContactPhone: "+5493410000000",
    notes: "Caso clínico inicial",
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-20T12:30:00.000Z"),
    ...overrides,
  };
}

function createNotificationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    studyTrackingCaseId: 11,
    clinicId: 3,
    reportId: 55,
    particularTokenId: 7,
    type: "special_stain_required",
    title: "Se requiere tinción especial",
    message:
      "El estudio ingresó a evaluación y requiere tinción especial para continuar.",
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-04-20T13:00:00.000Z"),
    ...overrides,
  };
}

function createAdminAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "VETNEB",
    }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(adminStudyTrackingNativeRoutes as any, {
    prefix: "/api/admin/study-tracking",
    ...createAdminAuthStubs(),
    getClinicById: async () => ({
      id: 3,
      name: "Clínica Centro",
      contactEmail: "clinic@example.com",
    }),
    getReportById: async () => ({
      id: 55,
      clinicId: 3,
      uploadDate: new Date("2026-04-19T09:00:00.000Z"),
      studyType: "Histopatología",
      patientName: "Luna",
      fileName: "luna.pdf",
      currentStatus: "ready",
      statusChangedAt: new Date("2026-04-19T10:00:00.000Z"),
      storagePath: "reports/luna.pdf",
      createdAt: new Date("2026-04-19T09:00:00.000Z"),
      updatedAt: new Date("2026-04-19T10:00:00.000Z"),
    }),
    getParticularTokenById: async () => ({
      id: 7,
      clinicId: 3,
      reportId: null,
      tokenHash: "hash",
      tokenLast4: "ABCD",
      tutorLastName: "Gomez",
      petName: "Luna",
      petAge: "8 años",
      petBreed: "Caniche",
      petSex: "Hembra",
      petSpecies: "Canina",
      sampleLocation: "Pabellón auricular",
      sampleEvolution: "15 días",
      detailsLesion: null,
      extractionDate: new Date("2026-04-18T00:00:00.000Z"),
      shippingDate: new Date("2026-04-19T00:00:00.000Z"),
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date("2026-04-18T12:00:00.000Z"),
      updatedAt: new Date("2026-04-18T12:30:00.000Z"),
      createdByAdminId: null,
      createdByClinicUserId: 9,
    }),
    updateParticularTokenReport: async () => undefined,
    createStudyTrackingCase: async () => createTrackingCaseFixture(),
    updateStudyTrackingCase: async () => createTrackingCaseFixture(),
    getClinicScopedStudyTrackingCase: async () => createTrackingCaseFixture(),
    getStudyTrackingCaseById: async () => createTrackingCaseFixture(),
    listStudyTrackingCases: async () => [createTrackingCaseFixture()],
    createStudyTrackingNotification: async () => createNotificationFixture(),
    listStudyTrackingNotifications: async () => [createNotificationFixture()],
    markStudyTrackingNotificationRead: async () => createNotificationFixture({
      isRead: true,
      readAt: new Date("2026-04-21T12:00:00.000Z"),
    }),
    markAllStudyTrackingNotificationsRead: async () => ({ updatedCount: 1 }),
    sendSpecialStainRequiredEmail: async () => ({ sent: true }),
    writeAuditLog: async () => {},
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    createDate: () => new Date("2026-04-20T13:30:00.000Z"),
    ...overrides,
  });

  return app;
}

test("adminStudyTrackingNativeRoutes preserva OPTIONS y CORS en toda la superficie", async () => {
  const app = await createTestApp();
  const urls = [
    "/api/admin/study-tracking",
    "/api/admin/study-tracking/notifications",
    "/api/admin/study-tracking/notifications/21/read",
    "/api/admin/study-tracking/notifications/read-all",
    "/api/admin/study-tracking/11",
  ];

  try {
    for (const url of urls) {
      const allowed = await app.inject({
        method: "OPTIONS",
        url,
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-method": "PATCH",
          "access-control-request-headers": "content-type",
        },
      });

      assert.equal(allowed.statusCode, 204, url);
      assert.equal(
        allowed.headers["access-control-allow-origin"],
        "http://localhost:3000",
        url,
      );
      assert.equal(
        allowed.headers["access-control-allow-credentials"],
        "true",
        url,
      );

      const forbidden = await app.inject({
        method: "OPTIONS",
        url,
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "PATCH",
        },
      });

      assert.equal(forbidden.statusCode, 403, url);
      assert.equal(forbidden.headers["access-control-allow-origin"], undefined);
      assert.deepEqual(JSON.parse(forbidden.body), {
        success: false,
        error: "Origen no permitido",
      });
    }
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes conserva auth ausente inválida y expirada con clear-cookie", async () => {
  const missingApp = await createTestApp();
  const invalidApp = await createTestApp({
    getAdminSessionByToken: async () => null,
  });
  const deletedSessions: string[] = [];
  const expiredApp = await createTestApp({
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2026-04-23T00:00:00.000Z"),
      lastAccess: new Date("2026-04-22T00:00:00.000Z"),
    }),
    deleteAdminSession: async (tokenHash: string) => {
      deletedSessions.push(tokenHash);
    },
  });

  try {
    const missing = await missingApp.inject({
      method: "GET",
      url: "/api/admin/study-tracking/notifications",
    });
    const invalid = await invalidApp.inject({
      method: "GET",
      url: "/api/admin/study-tracking/notifications",
      headers: {
        cookie: `${ENV.adminCookieName}=invalid-session-token`,
      },
    });
    const expired = await expiredApp.inject({
      method: "GET",
      url: "/api/admin/study-tracking/notifications",
      headers: {
        cookie: `${ENV.adminCookieName}=expired-session-token`,
      },
    });

    assert.equal(missing.statusCode, 401);
    assert.equal(JSON.parse(missing.body).error, "Admin no autenticado");
    assert.equal(invalid.statusCode, 401);
    assert.equal(JSON.parse(invalid.body).error, "Sesión admin inválida");
    assert.equal(expired.statusCode, 401);
    assert.equal(JSON.parse(expired.body).error, "Sesión admin expirada");
    assert.deepEqual(deletedSessions, ["hash:expired-session-token"]);
    assert.match(String(expired.headers["set-cookie"]), /Max-Age=0/);
  } finally {
    await missingApp.close();
    await invalidApp.close();
    await expiredApp.close();
  }
});

test("adminStudyTrackingNativeRoutes expone GET /notifications con filtros admin", async () => {
  const listCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    listStudyTrackingNotifications: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      return [createNotificationFixture()];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/study-tracking/notifications?clinicId=3&unreadOnly=true&limit=5&offset=2",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(listCalls, [
      {
        clinicId: 3,
        unreadOnly: true,
        limit: 5,
        offset: 2,
      },
    ]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.notifications[0].id, 21);
    assert.equal(body.notifications[0].clinicId, 3);
    assert.equal(body.pagination.limit, 5);
    assert.equal(body.pagination.offset, 2);
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes expone PATCH /notifications/:notificationId/read y marca leída", async () => {
  const markCalls: number[] = [];
  const readAt = new Date("2026-04-21T12:00:00.000Z");
  const app = await createTestApp({
    markStudyTrackingNotificationRead: async (notificationId: number) => {
      markCalls.push(notificationId);
      return createNotificationFixture({
        id: notificationId,
        isRead: true,
        readAt,
      });
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/notifications/21/read",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(markCalls, [21]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.notification.id, 21);
    assert.equal(body.notification.isRead, true);
    assert.equal(body.notification.readAt, readAt.toISOString());
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes expone PATCH /notifications/read-all y marca todas", async () => {
  const markAllCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    markAllStudyTrackingNotificationsRead: async (
      params?: Record<string, unknown>,
    ) => {
      markAllCalls.push(params ?? {});
      return { updatedCount: 4 };
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/notifications/read-all?clinicId=3",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(markAllCalls, [{ clinicId: 3 }]);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      updatedCount: 4,
    });
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes crea POST / con admin, vínculos y notificación especial", async () => {
  const createCalls: Array<Record<string, unknown>> = [];
  const updateTokenCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];
  const emailCalls: Array<Record<string, unknown>> = [];
  const notifiedAt = new Date("2026-04-20T13:30:00.000Z");
  const created = createTrackingCaseFixture({ specialStainRequired: true });
  const updated = createTrackingCaseFixture({
    specialStainRequired: true,
    specialStainNotifiedAt: notifiedAt,
  });

  const app = await createTestApp({
    createStudyTrackingCase: async (input: Record<string, unknown>) => {
      createCalls.push(input);
      return created;
    },
    updateParticularTokenReport: async (
      particularTokenId: number,
      reportId: number | null,
    ) => {
      updateTokenCalls.push({ particularTokenId, reportId });
      return undefined;
    },
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture();
    },
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: Record<string, unknown>,
    ) => {
      assert.equal(trackingCaseId, 11);
      assert.deepEqual(input, { specialStainNotifiedAt: notifiedAt });
      return updated;
    },
    sendSpecialStainRequiredEmail: async (input: Record<string, unknown>) => {
      emailCalls.push(input);
      return { sent: true };
    },
    createDate: () => notifiedAt,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/study-tracking",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        reportId: 55,
        particularTokenId: 7,
        labReceivedAt: "2026-04-22T00:00:00.000Z",
        currentStage: "evaluation",
        specialStainRequired: true,
        paymentUrl: "https://pay.example/study-11",
        adminContactEmail: "admin@example.com",
        adminContactPhone: "+5493410000000",
        notes: "Caso clínico inicial",
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
    assert.equal(createCalls[0].particularTokenId, 7);
    assert.equal(createCalls[0].createdByAdminId, 1);
    assert.equal(createCalls[0].createdByClinicUserId, null);
    assert.equal(
      (createCalls[0].receptionAt as Date).toISOString(),
      "2026-04-22T00:00:00.000Z",
    );
    assert.notEqual(
      (createCalls[0].receptionAt as Date).toISOString(),
      "2026-04-19T00:00:00.000Z",
    );
    assert.equal(
      (createCalls[0].estimatedDeliveryAt as Date).toISOString(),
      "2026-05-13T00:00:00.000Z",
    );
    assert.equal(createCalls[0].specialStainRequired, true);
    assert.ok(createCalls[0].estimatedDeliveryAt instanceof Date);
    assert.deepEqual(updateTokenCalls, [{ particularTokenId: 7, reportId: 55 }]);
    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].studyTrackingCaseId, 11);
    assert.equal(notificationCalls[0].clinicId, 3);
    assert.equal(notificationCalls[0].type, "special_stain_required");
    assert.equal(emailCalls.length, 1);
    assert.deepEqual(emailCalls[0].to, ["clinic@example.com", "admin@example.com"]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.message, "Seguimiento creado correctamente");
    assert.equal(body.trackingCase.id, 11);
    assert.equal(body.trackingCase.clinicId, 3);
    assert.equal(body.trackingCase.specialStainNotifiedAt, notifiedAt.toISOString());
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes mapea faltantes y ownership inválido al crear", async () => {
  const validPayload = {
    clinicId: 3,
    reportId: 55,
    particularTokenId: 7,
    labReceivedAt: "2026-04-22T00:00:00.000Z",
  };
  const scenarios = [
    {
      overrides: { getClinicById: async () => null },
      statusCode: 404,
      error: "Clínica no encontrada",
    },
    {
      overrides: { getReportById: async () => null },
      statusCode: 404,
      error: "Informe no encontrado",
    },
    {
      overrides: {
        getReportById: async () => ({ id: 55, clinicId: 9 }),
      },
      statusCode: 400,
      error: "El informe no pertenece a la clínica indicada",
    },
    {
      overrides: { getParticularTokenById: async () => null },
      statusCode: 404,
      error: "Token particular no encontrado",
    },
    {
      overrides: {
        getParticularTokenById: async () => ({ id: 7, clinicId: 9 }),
      },
      statusCode: 400,
      error: "El token particular no pertenece a la clínica indicada",
    },
  ];

  for (const scenario of scenarios) {
    const app = await createTestApp(scenario.overrides);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/study-tracking",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: validPayload,
      });

      assert.equal(response.statusCode, scenario.statusCode);
      assert.equal(JSON.parse(response.body).error, scenario.error);
    } finally {
      await app.close();
    }
  }
});

test("adminStudyTrackingNativeRoutes bloquea POST / con origin no permitido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/study-tracking",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        receptionAt: "2026-04-20T00:00:00.000Z",
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
});

test("adminStudyTrackingNativeRoutes expone GET / con lista admin-scoped", async () => {
  const listCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    listStudyTrackingCases: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      return [createTrackingCaseFixture()];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/study-tracking?clinicId=3&reportId=55&particularTokenId=7&limit=5&offset=2",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(listCalls, [
      {
        clinicId: 3,
        reportId: 55,
        particularTokenId: 7,
        limit: 5,
        offset: 2,
      },
    ]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.trackingCases[0].id, 11);
    assert.equal(body.trackingCases[0].clinicId, 3);
    assert.equal(body.pagination.limit, 5);
    assert.equal(body.pagination.offset, 2);
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes expone GET /:trackingCaseId con detalle global o clinic-scoped", async () => {
  const scopedCalls: Array<Record<string, unknown>> = [];
  const globalCalls: number[] = [];
  const app = await createTestApp({
    getClinicScopedStudyTrackingCase: async (
      trackingCaseId: number,
      clinicId: number,
    ) => {
      scopedCalls.push({ trackingCaseId, clinicId });
      return createTrackingCaseFixture();
    },
    getStudyTrackingCaseById: async (trackingCaseId: number) => {
      globalCalls.push(trackingCaseId);
      return createTrackingCaseFixture();
    },
  });

  try {
    const scopedResponse = await app.inject({
      method: "GET",
      url: "/api/admin/study-tracking/11?clinicId=3",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });
    const globalResponse = await app.inject({
      method: "GET",
      url: "/api/admin/study-tracking/11",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(scopedResponse.statusCode, 200);
    assert.equal(globalResponse.statusCode, 200);
    assert.deepEqual(scopedCalls, [{ trackingCaseId: 11, clinicId: 3 }]);
    assert.deepEqual(globalCalls, [11]);

    const body = JSON.parse(scopedResponse.body);
    assert.equal(body.success, true);
    assert.equal(body.trackingCase.id, 11);
    assert.equal(body.trackingCase.clinicId, 3);
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes conserva 404 antes de Zod y clinicId body sobre query en PATCH", async () => {
  const notFoundLookups: Array<Record<string, unknown>> = [];
  const notFoundUpdates: Array<Record<string, unknown>> = [];
  const notFoundApp = await createTestApp({
    getClinicScopedStudyTrackingCase: async (
      trackingCaseId: number,
      clinicId: number,
    ) => {
      notFoundLookups.push({ trackingCaseId, clinicId });
      return null;
    },
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: Record<string, unknown>,
    ) => {
      notFoundUpdates.push({ trackingCaseId, input });
      return createTrackingCaseFixture();
    },
  });
  const invalidUpdates: Array<Record<string, unknown>> = [];
  const invalidApp = await createTestApp({
    getStudyTrackingCaseById: async () => createTrackingCaseFixture(),
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: Record<string, unknown>,
    ) => {
      invalidUpdates.push({ trackingCaseId, input });
      return createTrackingCaseFixture();
    },
  });

  try {
    const notFound = await notFoundApp.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11?clinicId=3",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 4,
        currentStage: "invalid-stage",
      },
    });
    const invalid = await invalidApp.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        currentStage: "invalid-stage",
      },
    });

    assert.equal(notFound.statusCode, 404);
    assert.deepEqual(notFoundLookups, [{ trackingCaseId: 11, clinicId: 4 }]);
    assert.deepEqual(notFoundUpdates, []);
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalidUpdates, []);
  } finally {
    await notFoundApp.close();
    await invalidApp.close();
  }
});

test("adminStudyTrackingNativeRoutes recalcula estimación al modificar labReceivedAt", async () => {
  const updateCalls: Array<Record<string, unknown>> = [];
  const current = createTrackingCaseFixture({
    receptionAt: new Date("2026-04-20T00:00:00.000Z"),
    estimatedDeliveryAt: new Date("2026-05-11T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt: new Date("2026-05-11T00:00:00.000Z"),
  });
  const updated = createTrackingCaseFixture({
    receptionAt: new Date("2026-04-22T00:00:00.000Z"),
    estimatedDeliveryAt: new Date("2026-05-13T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt: new Date("2026-05-13T00:00:00.000Z"),
  });

  const app = await createTestApp({
    getClinicScopedStudyTrackingCase: async () => current,
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: Record<string, unknown>,
    ) => {
      assert.equal(trackingCaseId, 11);
      updateCalls.push(input);
      return updated;
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        labReceivedAt: "2026-04-22T00:00:00.000Z",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(updateCalls.length, 1);
    assert.equal(
      (updateCalls[0].receptionAt as Date).toISOString(),
      "2026-04-22T00:00:00.000Z",
    );
    assert.equal(
      (updateCalls[0].estimatedDeliveryAt as Date).toISOString(),
      "2026-05-13T00:00:00.000Z",
    );
    assert.equal(
      (updateCalls[0].estimatedDeliveryAutoCalculatedAt as Date).toISOString(),
      "2026-05-13T00:00:00.000Z",
    );
    assert.equal(updateCalls[0].estimatedDeliveryWasManuallyAdjusted, false);

    const body = JSON.parse(response.body);
    assert.equal(body.trackingCase.labReceivedAt, "2026-04-22T00:00:00.000Z");
    assert.equal(body.trackingCase.estimatedDeliveryAt, "2026-05-13T00:00:00.000Z");
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes notifica cambio de etapa en PATCH /:trackingCaseId", async () => {
  const notificationCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const current = createTrackingCaseFixture({ currentStage: "processing" });
  const updated = createTrackingCaseFixture({ currentStage: "evaluation" });

  const app = await createTestApp({
    getClinicScopedStudyTrackingCase: async () => current,
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: Record<string, unknown>,
    ) => {
      assert.equal(trackingCaseId, 11);
      assert.equal(input.currentStage, "evaluation");
      return updated;
    },
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture({ id: 31, ...input });
    },
    writeAuditLog: async (_request: unknown, input: Record<string, unknown>) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        currentStage: "evaluation",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(notificationCalls.length, 1);

    const notification = notificationCalls[0];
    assert.equal(notification.studyTrackingCaseId, 11);
    assert.equal(notification.clinicId, 3);
    assert.equal(notification.reportId, 55);
    assert.equal(notification.particularTokenId, 7);
    assert.equal(notification.type, "stage_changed");
    assert.equal(notification.title, "Estado de estudio actualizado");
    assert.equal(
      notification.message,
      "El estudio cambió de estado: Procesamiento → Evaluación.",
    );
    assert.equal(notification.isRead, false);
    assert.equal(notification.readAt, null);

    const notificationAudit = auditCalls.find((call) => {
      const metadata = call.metadata as Record<string, unknown> | undefined;
      return (
        call.event === "study_tracking.notification.created" &&
        metadata?.type === "stage_changed"
      );
    });

    assert.ok(notificationAudit);
    const metadata = notificationAudit.metadata as Record<string, unknown>;
    assert.equal(metadata.trackingCaseId, 11);
    assert.equal(metadata.notificationId, 31);
    assert.equal(metadata.particularTokenId, 7);
    assert.equal(metadata.type, "stage_changed");
    assert.equal(metadata.title, "Estado de estudio actualizado");
    assert.equal(metadata.fromStage, "processing");
    assert.equal(metadata.toStage, "evaluation");
    assert.equal(metadata.createdVia, "admin");
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes no notifica stage_changed si currentStage no cambia", async () => {
  const withoutStageCalls: Array<Record<string, unknown>> = [];
  const current = createTrackingCaseFixture({ currentStage: "evaluation" });

  const appWithoutStage = await createTestApp({
    getClinicScopedStudyTrackingCase: async () => current,
    updateStudyTrackingCase: async () =>
      createTrackingCaseFixture({ currentStage: "evaluation" }),
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      withoutStageCalls.push(input);
      return createNotificationFixture({ ...input });
    },
  });

  try {
    const response = await appWithoutStage.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        notes: "Actualización administrativa",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(withoutStageCalls.length, 0);
  } finally {
    await appWithoutStage.close();
  }

  const sameStageCalls: Array<Record<string, unknown>> = [];
  const appSameStage = await createTestApp({
    getClinicScopedStudyTrackingCase: async () => current,
    updateStudyTrackingCase: async () =>
      createTrackingCaseFixture({ currentStage: "evaluation" }),
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      sameStageCalls.push(input);
      return createNotificationFixture({ ...input });
    },
  });

  try {
    const response = await appSameStage.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        currentStage: "evaluation",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(sameStageCalls.length, 0);
  } finally {
    await appSameStage.close();
  }
});

test("adminStudyTrackingNativeRoutes actualiza PATCH /:trackingCaseId y notifica tinción especial", async () => {
  const updateCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];
  const emailCalls: Array<Record<string, unknown>> = [];
  const notifiedAt = new Date("2026-04-20T13:30:00.000Z");
  const current = createTrackingCaseFixture({
    specialStainRequired: false,
    specialStainNotifiedAt: null,
  });
  const updated = createTrackingCaseFixture({
    currentStage: "evaluation",
    specialStainRequired: true,
    specialStainNotifiedAt: null,
  });
  const finalCase = createTrackingCaseFixture({
    currentStage: "evaluation",
    specialStainRequired: true,
    specialStainNotifiedAt: notifiedAt,
  });

  const app = await createTestApp({
    getClinicScopedStudyTrackingCase: async () => current,
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: Record<string, unknown>,
    ) => {
      assert.equal(trackingCaseId, 11);
      updateCalls.push(input);

      if ("specialStainNotifiedAt" in input) {
        return finalCase;
      }

      return updated;
    },
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture();
    },
    sendSpecialStainRequiredEmail: async (input: Record<string, unknown>) => {
      emailCalls.push(input);
      return { sent: true };
    },
    createDate: () => notifiedAt,
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        currentStage: "evaluation",
        specialStainRequired: true,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(updateCalls.length, 2);
    assert.equal(updateCalls[0].currentStage, "evaluation");
    assert.equal(updateCalls[0].specialStainRequired, true);
    assert.deepEqual(updateCalls[1], { specialStainNotifiedAt: notifiedAt });
    assert.equal(notificationCalls.length, 2);
    assert.ok(
      notificationCalls.find((call) => call.type === "special_stain_required"),
    );
    const stageNotification = notificationCalls.find(
      (call) => call.type === "stage_changed",
    );
    assert.ok(stageNotification);
    assert.equal(
      stageNotification.message,
      "El estudio cambió de estado: Recepción → Evaluación.",
    );
    assert.equal(emailCalls.length, 1);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.message, "Seguimiento actualizado correctamente");
    assert.equal(body.trackingCase.id, 11);
    assert.equal(body.trackingCase.specialStainNotifiedAt, notifiedAt.toISOString());
  } finally {
    await app.close();
  }
});

test("adminStudyTrackingNativeRoutes notifica special_stain_resolved cuando la alerta pasa a false", async () => {
  const notificationCalls: Array<Record<string, unknown>> = [];
  const current = createTrackingCaseFixture({
    currentStage: "evaluation",
    specialStainRequired: true,
    specialStainNotifiedAt: new Date("2026-04-20T13:30:00.000Z"),
  });
  const updated = createTrackingCaseFixture({
    currentStage: "evaluation",
    specialStainRequired: false,
    specialStainNotifiedAt: new Date("2026-04-20T13:30:00.000Z"),
  });

  const app = await createTestApp({
    getClinicScopedStudyTrackingCase: async () => current,
    updateStudyTrackingCase: async () => updated,
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture({ id: 61, ...input });
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/study-tracking/11",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        clinicId: 3,
        specialStainRequired: false,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].type, "special_stain_resolved");
    assert.equal(notificationCalls[0].title, "Tinción especial resuelta");
    assert.equal(
      notificationCalls[0].message,
      "La solicitud de tinción especial fue resuelta.",
    );
    assert.equal(notificationCalls[0].isRead, false);
    assert.equal(notificationCalls[0].readAt, null);
  } finally {
    await app.close();
  }
});
