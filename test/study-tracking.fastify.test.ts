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
  studyTrackingNativeRoutes,
} = await import("../server/routes/study-tracking.fastify.ts");
const {
  calculateEstimatedDeliveryAt,
  getBusinessDayWeight,
  isArgentinaNationalHoliday,
} = await import("../server/lib/study-tracking.ts");

function createTrackingCaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    clinicId: 3,
    reportId: 55,
    particularTokenId: 7,
    createdByAdminId: null,
    createdByClinicUserId: 9,
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
      "El estudio requiere tinción especial. Se generó una notificación para seguimiento.",
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-04-20T13:00:00.000Z"),
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
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(studyTrackingNativeRoutes as any, {
    prefix: "/api/study-tracking",
    ...createAuthStubs(),
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
    listStudyTrackingCases: async () => [createTrackingCaseFixture()],
    createStudyTrackingNotification: async () => createNotificationFixture(),
    listStudyTrackingNotifications: async () => [createNotificationFixture()],
    markStudyTrackingNotificationReadScoped: async () =>
      createNotificationFixture({
        isRead: true,
        readAt: new Date("2026-04-21T12:00:00.000Z"),
      }),
    markAllStudyTrackingNotificationsReadScoped: async () => ({
      updatedCount: 1,
    }),
    sendSpecialStainRequiredEmail: async () => ({ sent: true }),
    writeAuditLog: async () => {},
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    createDate: () => new Date("2026-04-20T13:30:00.000Z"),
    ...overrides,
  });

  return app;
}

test("study tracking calcula entrega con feriados argentinos configurados", () => {
  const independenceDay2026 = new Date("2026-07-09T00:00:00.000Z");
  const bridgeHoliday2026 = new Date("2026-07-10T00:00:00.000Z");
  const futureIndependenceDay = new Date("2040-07-09T00:00:00.000Z");

  assert.equal(isArgentinaNationalHoliday(independenceDay2026), true);
  assert.equal(getBusinessDayWeight(independenceDay2026), 0);
  assert.equal(isArgentinaNationalHoliday(bridgeHoliday2026), true);
  assert.equal(getBusinessDayWeight(bridgeHoliday2026), 0);
  assert.equal(isArgentinaNationalHoliday(futureIndependenceDay), false);

  const oneBusinessDayAcrossHoliday = calculateEstimatedDeliveryAt(
    new Date("2026-07-08T00:00:00.000Z"),
    1,
  );

  assert.equal(
    oneBusinessDayAcrossHoliday.toISOString(),
    "2026-07-13T00:00:00.000Z",
  );

  const fifteenBusinessDays = calculateEstimatedDeliveryAt(
    new Date("2026-04-20T00:00:00.000Z"),
  );

  assert.equal(fifteenBusinessDays.toISOString(), "2026-05-11T00:00:00.000Z");
});

test("studyTrackingNativeRoutes expone GET /notifications clinic-scoped", async () => {
  const listCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    listStudyTrackingNotifications: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      return [
        createNotificationFixture({
          type: "stage_changed",
          title: "Estado de estudio actualizado",
          message: "El estudio cambió de estado: Recepción → Procesamiento.",
        }),
      ];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/study-tracking/notifications?unreadOnly=true&limit=5&offset=2",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
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
    assert.equal(body.notifications[0].particularTokenId, 7);
    assert.equal(body.notifications[0].type, "stage_changed");
    assert.equal(body.pagination.limit, 5);
    assert.equal(body.pagination.offset, 2);
  } finally {
    await app.close();
  }
});

test("studyTrackingNativeRoutes expone PATCH /notifications/:notificationId/read clinic-scoped", async () => {
  const markCalls: Array<Record<string, unknown>> = [];
  const readAt = new Date("2026-04-21T12:00:00.000Z");
  const app = await createTestApp({
    markStudyTrackingNotificationReadScoped: async (
      params: Record<string, unknown>,
    ) => {
      markCalls.push(params);
      return createNotificationFixture({
        id: params.id,
        isRead: true,
        readAt,
      });
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/study-tracking/notifications/21/read",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(markCalls, [{ id: 21, clinicId: 3 }]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.notification.id, 21);
    assert.equal(body.notification.isRead, true);
    assert.equal(body.notification.readAt, readAt.toISOString());
  } finally {
    await app.close();
  }
});

test("studyTrackingNativeRoutes responde 404 genérico en PATCH /notifications/:notificationId/read cross-clinic", async () => {
  const markCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    markStudyTrackingNotificationReadScoped: async (
      params: Record<string, unknown>,
    ) => {
      markCalls.push(params);
      return null;
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/study-tracking/notifications/999/read",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(markCalls, [{ id: 999, clinicId: 3 }]);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Notificación no encontrada",
    });
  } finally {
    await app.close();
  }
});

test("studyTrackingNativeRoutes expone PATCH /notifications/read-all con Origin permitido", async () => {
  const markAllCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    markAllStudyTrackingNotificationsReadScoped: async (
      params: Record<string, unknown>,
    ) => {
      markAllCalls.push(params);
      return { updatedCount: 4 };
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/study-tracking/notifications/read-all",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
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

test("studyTrackingNativeRoutes bloquea PATCH /notifications/read-all sin Origin ni Referer", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/study-tracking/notifications/read-all",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
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

test("studyTrackingNativeRoutes bloquea PATCH /notifications/read-all sin sesión", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/study-tracking/notifications/read-all",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autenticado",
    });
  } finally {
    await app.close();
  }
});

test("studyTrackingNativeRoutes bloquea POST / porque el workflow es admin-only", async () => {
  const createCalls: Array<Record<string, unknown>> = [];
  const updateTokenCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];
  const emailCalls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    createStudyTrackingCase: async (input: Record<string, unknown>) => {
      createCalls.push(input);
      return createTrackingCaseFixture({ specialStainRequired: true });
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
    sendSpecialStainRequiredEmail: async (input: Record<string, unknown>) => {
      emailCalls.push(input);
      return { sent: true };
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/study-tracking",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
        "content-type": "application/json",
      },
      payload: {
        reportId: 55,
        particularTokenId: 7,
        labReceivedAt: "2026-04-25T00:00:00.000Z",
        receptionAt: "2026-04-20T00:00:00.000Z",
        currentStage: "reception",
        specialStainRequired: true,
        paymentUrl: "https://pay.example/study-11",
        adminContactEmail: "admin@example.com",
        adminContactPhone: "+5493410000000",
        notes: "Caso clínico inicial",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
    assert.equal(createCalls.length, 0);
    assert.equal(updateTokenCalls.length, 0);
    assert.equal(notificationCalls.length, 0);
    assert.equal(emailCalls.length, 0);

    const body = JSON.parse(response.body);
    assert.deepEqual(body, {
      success: false,
      error: "Solo administración puede crear seguimientos",
    });
  } finally {
    await app.close();
  }
});

test("studyTrackingNativeRoutes bloquea POST / con origin no permitido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/study-tracking",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.cookieName}=session-token`,
        "content-type": "application/json",
      },
      payload: {
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

test("studyTrackingNativeRoutes expone GET / con lista clinic-scoped", async () => {
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
      url: "/api/study-tracking?reportId=55&particularTokenId=7&limit=5&offset=2",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
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

test("studyTrackingNativeRoutes expone GET /:trackingCaseId con detalle", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    getClinicScopedStudyTrackingCase: async (
      trackingCaseId: number,
      clinicId: number,
    ) => {
      calls.push({ trackingCaseId, clinicId });
      return createTrackingCaseFixture();
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/study-tracking/11",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [{ trackingCaseId: 11, clinicId: 3 }]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.trackingCase.id, 11);
    assert.equal(body.trackingCase.clinicId, 3);
  } finally {
    await app.close();
  }
});
