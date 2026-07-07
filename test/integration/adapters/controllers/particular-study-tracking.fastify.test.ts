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
  particularStudyTrackingNativeRoutes,
} = await import("../../../../server/routes/particular-study-tracking.fastify.ts");

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
    currentStage: "evaluation",
    processingAt: new Date("2026-04-21T00:00:00.000Z"),
    evaluationAt: new Date("2026-04-22T00:00:00.000Z"),
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: true,
    specialStainNotifiedAt: new Date("2026-04-22T12:00:00.000Z"),
    paymentUrl: "https://pay.example/study-11",
    adminContactEmail: "admin@example.com",
    adminContactPhone: "+5493410000000",
    notes: "Caso clínico inicial",
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:30:00.000Z"),
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
      "El estudio requiere tinción especial. Revisá el seguimiento para continuar la gestión.",
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-04-22T13:00:00.000Z"),
    ...overrides,
  };
}

function createParticularAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => ({
      particularTokenId: 7,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getParticularTokenById: async () => ({
      id: 7,
      clinicId: 3,
      reportId: 55,
      isActive: true,
    }),
    updateParticularSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(particularStudyTrackingNativeRoutes as any, {
    prefix: "/api/particular/study-tracking",
    ...createParticularAuthStubs(),
    getParticularStudyTrackingCase: async () => createTrackingCaseFixture(),
    listStudyTrackingNotifications: async () => [createNotificationFixture()],
    markStudyTrackingNotificationReadScoped: async () =>
      createNotificationFixture({
        isRead: true,
        readAt: new Date("2026-04-23T12:00:00.000Z"),
      }),
    markAllStudyTrackingNotificationsReadScoped: async () => ({
      updatedCount: 1,
    }),
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

test("particularStudyTrackingNativeRoutes expone GET /me con seguimiento del token autenticado", async () => {
  const calls: number[] = [];
  const app = await createTestApp({
    getParticularStudyTrackingCase: async (particularTokenId: number) => {
      calls.push(particularTokenId);
      return createTrackingCaseFixture();
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/study-tracking/me",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [7]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.trackingCase.id, 11);
    assert.equal(body.trackingCase.particularTokenId, 7);
    assert.equal(body.trackingCase.specialStainRequired, true);
    assert.equal(
      body.trackingCase.receptionAt,
      "2026-04-20T00:00:00.000Z",
      "receptionAt debe exponerse al particular autenticado",
    );
    assert.equal(
      body.trackingCase.estimatedDeliveryAt,
      "2026-05-11T00:00:00.000Z",
      "estimatedDeliveryAt debe exponerse al particular autenticado",
    );
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes no permite modificar labReceivedAt", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/particular/study-tracking/me",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.particularCookieName}=particular-session-token`,
        "content-type": "application/json",
      },
      payload: {
        labReceivedAt: "2026-04-25T00:00:00.000Z",
      },
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes devuelve 404 cuando no existe seguimiento para el token", async () => {
  const app = await createTestApp({
    getParticularStudyTrackingCase: async () => null,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/study-tracking/me",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Seguimiento no encontrado para el token particular autenticado",
    });
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes expone GET /notifications con filtro por token particular", async () => {
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
      url: "/api/particular/study-tracking/notifications?unreadOnly=true&limit=5&offset=2",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(listCalls, [
      {
        particularTokenId: 7,
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

test("particularStudyTrackingNativeRoutes expone PATCH /notifications/:notificationId/read scoped por token", async () => {
  const markCalls: Array<Record<string, unknown>> = [];
  const readAt = new Date("2026-04-23T12:00:00.000Z");
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
      url: "/api/particular/study-tracking/notifications/21/read",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(markCalls, [{ id: 21, particularTokenId: 7 }]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.notification.id, 21);
    assert.equal(body.notification.isRead, true);
    assert.equal(body.notification.readAt, readAt.toISOString());
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes responde 404 genérico en PATCH /notifications/:notificationId/read cross-token", async () => {
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
      url: "/api/particular/study-tracking/notifications/999/read",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(markCalls, [{ id: 999, particularTokenId: 7 }]);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Notificación no encontrada",
    });
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes expone PATCH /notifications/read-all con Origin permitido", async () => {
  const markAllCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    markAllStudyTrackingNotificationsReadScoped: async (
      params: Record<string, unknown>,
    ) => {
      markAllCalls.push(params);
      return { updatedCount: 3 };
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/particular/study-tracking/notifications/read-all",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(markAllCalls, [{ particularTokenId: 7 }]);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      updatedCount: 3,
    });
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes bloquea PATCH /notifications/read-all sin Origin ni Referer", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/particular/study-tracking/notifications/read-all",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
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

test("particularStudyTrackingNativeRoutes bloquea PATCH /notifications/read-all con Origin no permitido", async () => {
  const markAllCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    markAllStudyTrackingNotificationsReadScoped: async (
      params: Record<string, unknown>,
    ) => {
      markAllCalls.push(params);
      return { updatedCount: 3 };
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/particular/study-tracking/notifications/read-all",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(markAllCalls, []);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes bloquea PATCH /notifications/read-all sin sesión particular", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/particular/study-tracking/notifications/read-all",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Particular no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes bloquea GET /me sin sesión particular", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/study-tracking/me",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Particular no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("particularStudyTrackingNativeRoutes limpia cookie cuando la sesión está expirada", async () => {
  const app = await createTestApp({
    getParticularSessionByToken: async () => ({
      particularTokenId: 7,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      lastAccess: new Date("2020-01-01T00:00:00.000Z"),
    }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/study-tracking/me",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.match(String(response.headers["set-cookie"]), /Max-Age=0/);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Sesión particular expirada",
    });
  } finally {
    await app.close();
  }
});
