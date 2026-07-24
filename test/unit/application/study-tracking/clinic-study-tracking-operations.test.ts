import assert from "node:assert/strict";
import test from "node:test";

import { createClinicStudyTrackingOperations } from "../../../../server/features/study-tracking/application/index.ts";

type TrackingCase = {
  id: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  estimatedDeliveryWasManuallyAdjusted: boolean;
  currentStage: string;
  specialStainRequired: boolean;
  specialStainNotifiedAt: Date | null;
  paymentUrl: string | null;
  adminContactEmail: string | null;
  adminContactPhone: string | null;
  notes: string | null;
};

type Notification = {
  id: number;
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  type: string;
  title: string;
};

const receptionAt = new Date("2026-07-01T12:00:00.000Z");
const notifiedAt = new Date("2026-07-24T10:00:00.000Z");

function buildTrackingCase(
  overrides: Partial<TrackingCase> = {},
): TrackingCase {
  return {
    id: 101,
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    receptionAt,
    estimatedDeliveryAt: new Date("2026-07-22T00:00:00.000Z"),
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "received",
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: null,
    adminContactEmail: "admin@example.test",
    adminContactPhone: null,
    notes: null,
    ...overrides,
  };
}

function buildNotification(): Notification {
  return {
    id: 202,
    studyTrackingCaseId: 101,
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    type: "special_stain_required",
    title: "Se requiere tinción especial",
  };
}

function createHarness(options: {
  created?: TrackingCase;
  updated?: TrackingCase | null;
  clinic?: { id: number; name: string; contactEmail: string | null } | null;
  secondClinic?: {
    id: number;
    name: string;
    contactEmail: string | null;
  } | null;
  report?: { id: number } | null | undefined;
  token?: { id: number; clinicId: number } | null | undefined;
  emailError?: unknown;
  auditError?: unknown;
} = {}) {
  const calls: Array<readonly unknown[]> = [];
  const created = options.created ?? buildTrackingCase();
  const updated =
    options.updated === undefined ? created : options.updated;
  const clinic =
    options.clinic === undefined
      ? { id: 7, name: "Clínica Norte", contactEmail: "clinic@example.test" }
      : options.clinic;
  let clinicLookupCount = 0;
  const notification = buildNotification();
  const operations = createClinicStudyTrackingOperations({
    queryRepository: {
      getClinicScopedStudyTrackingCase: async (
        id: number,
        clinicId: number,
      ) => {
        calls.push(["get-case", id, clinicId]);
        return created;
      },
      listStudyTrackingCases: async (params: {
        clinicId: number;
        reportId?: number;
        particularTokenId?: number;
        limit: number;
        offset: number;
      }) => {
        calls.push(["list-cases", params]);
        return [created];
      },
      listStudyTrackingNotifications: async (params: {
        clinicId: number;
        unreadOnly: boolean;
        limit: number;
        offset: number;
      }) => {
        calls.push(["list-notifications", params]);
        return [notification];
      },
    },
    commandRepository: {
      createStudyTrackingCase: async (input: unknown) => {
        calls.push(["create-case", input]);
        return created;
      },
      updateStudyTrackingCase: async (
        id: number,
        patch: Partial<TrackingCase>,
      ) => {
        calls.push(["update-case", id, patch]);
        return updated;
      },
      createStudyTrackingNotification: async (input: unknown) => {
        calls.push(["create-notification", input]);
        return notification;
      },
      markStudyTrackingNotificationReadScoped: async (params: {
        id: number;
        clinicId: number;
      }) => {
        calls.push(["mark-read", params]);
        return notification;
      },
      markAllStudyTrackingNotificationsReadScoped: async (params: {
        clinicId: number;
      }) => {
        calls.push(["mark-all", params]);
        return { updatedCount: 3 };
      },
    },
    referenceRepository: {
      getClinicById: async (clinicId: number) => {
        clinicLookupCount += 1;
        calls.push(["get-clinic", clinicId]);
        if (clinicLookupCount === 2 && options.secondClinic !== undefined) {
          return options.secondClinic;
        }
        return clinic;
      },
      getClinicScopedReportById: async (
        reportId: number,
        clinicId: number,
      ) => {
        calls.push(["get-report", reportId, clinicId]);
        return options.report === undefined ? { id: reportId } : options.report;
      },
      getParticularTokenById: async (tokenId: number) => {
        calls.push(["get-token", tokenId]);
        return options.token === undefined
          ? { id: tokenId, clinicId: 7 }
          : options.token;
      },
      updateParticularTokenReport: async (
        tokenId: number,
        reportId: number | null,
      ) => {
        calls.push(["link-token-report", tokenId, reportId]);
        return { id: tokenId, clinicId: 7 };
      },
    },
    notification: {
      sendSpecialStainRequiredEmail: async (input: unknown) => {
        calls.push(["email", input]);
        if (options.emailError !== undefined) {
          throw options.emailError;
        }
      },
    },
    audit: {
      writeAuditLog: async (request: { requestId: string }, input: unknown) => {
        calls.push(["audit", request, input]);
        if (options.auditError !== undefined) {
          throw options.auditError;
        }
      },
    },
    auditEvents: {
      caseCreated: "study_tracking.case.created",
      notificationCreated: "study_tracking.notification.created",
    },
    createDate: () => notifiedAt,
  });

  return { calls, created, notification, operations };
}

const createInput = {
  actor: { clinicId: 7, clinicUserId: 17 },
  data: {
    reportId: 31,
    particularTokenId: 41,
    receptionAt,
    currentStage: "received",
    specialStainRequired: false,
  },
  auditRequest: { requestId: "request-1" },
};

test("clinic operations aplican scope y preservan identidad en lecturas y acuses", async () => {
  const { calls, created, notification, operations } = createHarness();
  const listInput = {
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    limit: 25,
    offset: 5,
  };
  const notificationListInput = {
    clinicId: 7,
    unreadOnly: true,
    limit: 10,
    offset: 0,
  };

  assert.equal(
    await operations.getClinicStudyTrackingCase({
      clinicId: 7,
      trackingCaseId: 101,
    }),
    created,
  );
  assert.equal(
    (await operations.listClinicStudyTrackingCases(listInput))[0],
    created,
  );
  assert.equal(
    (
      await operations.listClinicStudyTrackingNotifications(
        notificationListInput,
      )
    )[0],
    notification,
  );
  assert.equal(
    await operations.acknowledgeClinicStudyTrackingNotification({
      clinicId: 7,
      notificationId: 202,
    }),
    notification,
  );
  assert.deepEqual(
    await operations.acknowledgeAllClinicStudyTrackingNotifications(7),
    { updatedCount: 3 },
  );
  assert.deepEqual(calls, [
    ["get-case", 101, 7],
    ["list-cases", listInput],
    ["list-notifications", notificationListInput],
    ["mark-read", { id: 202, clinicId: 7 }],
    ["mark-all", { clinicId: 7 }],
  ]);
});

test("clinic create corta antes de mutar ante referencias inválidas", async () => {
  const scenarios = [
    {
      options: { clinic: null },
      status: "clinic_not_found",
      calls: [["get-clinic", 7]],
    },
    {
      options: { report: null },
      status: "report_not_found",
      calls: [
        ["get-clinic", 7],
        ["get-report", 31, 7],
      ],
    },
    {
      options: { token: null },
      status: "particular_token_not_found",
      calls: [
        ["get-clinic", 7],
        ["get-report", 31, 7],
        ["get-token", 41],
      ],
    },
    {
      options: { token: { id: 41, clinicId: 99 } },
      status: "particular_token_wrong_clinic",
      calls: [
        ["get-clinic", 7],
        ["get-report", 31, 7],
        ["get-token", 41],
      ],
    },
  ] as const;

  for (const scenario of scenarios) {
    const { calls, operations } = createHarness(scenario.options);
    const result = await operations.createClinicStudyTrackingCase(createInput);

    assert.equal(result.status, scenario.status);
    assert.deepEqual(calls, scenario.calls);
  }
});

test("clinic create sin tinción coordina persistencia, vínculo y auditoría en orden", async () => {
  const { calls, created, operations } = createHarness();
  const result = await operations.createClinicStudyTrackingCase(createInput);

  assert.equal(result.status, "created");
  if (result.status !== "created") {
    assert.fail("resultado de creación inesperado");
  }
  assert.equal(result.trackingCase, created);
  assert.deepEqual(createInput, {
    actor: { clinicId: 7, clinicUserId: 17 },
    data: {
      reportId: 31,
      particularTokenId: 41,
      receptionAt,
      currentStage: "received",
      specialStainRequired: false,
    },
    auditRequest: { requestId: "request-1" },
  });
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "get-clinic",
      "get-report",
      "get-token",
      "create-case",
      "link-token-report",
      "audit",
    ],
  );
  const createCall = calls.find(([name]) => name === "create-case");
  assert.deepEqual(createCall?.[1], {
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    createdByAdminId: null,
    createdByClinicUserId: 17,
    receptionAt,
    estimatedDeliveryAt: new Date("2026-07-23T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt:
      new Date("2026-07-23T00:00:00.000Z"),
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "received",
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
  });
  const auditCall = calls.find(([name]) => name === "audit");
  assert.equal(auditCall?.[1], createInput.auditRequest);
  assert.deepEqual(auditCall?.[2], {
    event: "study_tracking.case.created",
    clinicId: 7,
    reportId: 31,
    metadata: {
      trackingCaseId: 101,
      particularTokenId: 41,
      currentStage: "received",
      specialStainRequired: false,
      specialStainNotifiedAt: null,
      estimatedDeliveryAt: created.estimatedDeliveryAt,
      estimatedDeliveryWasManuallyAdjusted: false,
      createdVia: "clinic",
    },
  });
});

test("clinic create con tinción conserva el orden completo y usa el caso actualizado", async () => {
  const created = buildTrackingCase({
    specialStainRequired: true,
    specialStainNotifiedAt: null,
  });
  const updated = buildTrackingCase({
    specialStainRequired: true,
    specialStainNotifiedAt: notifiedAt,
  });
  const { calls, notification, operations } = createHarness({
    created,
    updated,
  });

  const result = await operations.createClinicStudyTrackingCase({
    ...createInput,
    data: { ...createInput.data, specialStainRequired: true },
  });

  assert.equal(result.status, "created");
  if (result.status !== "created") {
    assert.fail("resultado de creación inesperado");
  }
  assert.equal(result.trackingCase, updated);
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "get-clinic",
      "get-report",
      "get-token",
      "create-case",
      "link-token-report",
      "create-notification",
      "update-case",
      "get-clinic",
      "email",
      "audit",
      "audit",
    ],
  );
  assert.deepEqual(calls[6], [
    "update-case",
    101,
    { specialStainNotifiedAt: notifiedAt },
  ]);
  assert.deepEqual(calls[8]?.[1], {
    to: ["clinic@example.test", "admin@example.test"],
    clinicName: "Clínica Norte",
    trackingCaseId: 101,
    receptionAt,
    estimatedDeliveryAt: updated.estimatedDeliveryAt,
    currentStage: "received",
    paymentUrl: null,
    adminContactEmail: "admin@example.test",
    adminContactPhone: null,
    notes: null,
  });
  assert.deepEqual(calls[10]?.[2], {
    event: "study_tracking.notification.created",
    clinicId: 7,
    reportId: 31,
    metadata: {
      trackingCaseId: 101,
      notificationId: notification.id,
      particularTokenId: 41,
      type: "special_stain_required",
      title: "Se requiere tinción especial",
      createdVia: "clinic",
    },
  });
});

test("clinic create usa fallback al caso creado cuando update devuelve null", async () => {
  const created = buildTrackingCase({ specialStainRequired: true });
  const { calls, operations } = createHarness({ created, updated: null });
  const result = await operations.createClinicStudyTrackingCase({
    ...createInput,
    data: { ...createInput.data, specialStainRequired: true },
  });

  assert.equal(result.status, "created");
  if (result.status === "created") {
    assert.equal(result.trackingCase, created);
  }
  assert.equal(calls.filter(([name]) => name === "audit").length, 2);
});

test("clinic create trata solo SMTP como best-effort y mantiene auditorías", async () => {
  const smtpError = Object.assign(new Error("smtp failed"), {
    code: "ECONNECTION",
  });
  const created = buildTrackingCase({ specialStainRequired: true });
  const { calls, operations } = createHarness({
    created,
    emailError: smtpError,
  });
  const originalConsoleError = console.error;
  const logged: Array<readonly unknown[]> = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const result = await operations.createClinicStudyTrackingCase({
      ...createInput,
      data: { ...createInput.data, specialStainRequired: true },
    });
    assert.equal(result.status, "created");
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.filter(([name]) => name === "audit").length, 2);
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0]?.[1], {
    trackingCaseId: 101,
    clinicId: 7,
    errorName: "Error",
    errorCode: "ECONNECTION",
  });
});

test("clinic create omite email si la segunda lectura no encuentra clínica", async () => {
  const created = buildTrackingCase({ specialStainRequired: true });
  const { calls, operations } = createHarness({
    created,
    secondClinic: null,
  });
  const originalConsoleWarn = console.warn;
  console.warn = () => {};

  try {
    const result = await operations.createClinicStudyTrackingCase({
      ...createInput,
      data: { ...createInput.data, specialStainRequired: true },
    });
    assert.equal(result.status, "created");
  } finally {
    console.warn = originalConsoleWarn;
  }

  assert.equal(calls.some(([name]) => name === "email"), false);
  assert.equal(calls.filter(([name]) => name === "audit").length, 2);
});

test("clinic create propaga por identidad errores de repositorio y auditoría", async () => {
  const repositoryError = new Error("repository failed");
  const repositoryHarness = createHarness();
  const failingOperations = createClinicStudyTrackingOperations({
    queryRepository: {
      getClinicScopedStudyTrackingCase: async () => null,
      listStudyTrackingCases: async () => [],
      listStudyTrackingNotifications: async () => [],
    },
    commandRepository: {
      createStudyTrackingCase: async () => {
        throw repositoryError;
      },
      updateStudyTrackingCase: async () => null,
      createStudyTrackingNotification: async () => {
        throw new Error("unreachable");
      },
      markStudyTrackingNotificationReadScoped: async () => null,
      markAllStudyTrackingNotificationsReadScoped: async () => ({
        updatedCount: 0,
      }),
    },
    referenceRepository: {
      getClinicById: async () => ({
        id: 7,
        name: "Clínica Norte",
        contactEmail: null,
      }),
      getClinicScopedReportById: async () => ({ id: 31 }),
      getParticularTokenById: async () => ({ id: 41, clinicId: 7 }),
      updateParticularTokenReport: async () => null,
    },
    notification: {
      sendSpecialStainRequiredEmail: async () => {},
    },
    audit: {
      writeAuditLog: async () => {},
    },
    auditEvents: {
      caseCreated: "study_tracking.case.created",
      notificationCreated: "study_tracking.notification.created",
    },
    createDate: () => notifiedAt,
  });

  await assert.rejects(
    failingOperations.createClinicStudyTrackingCase(createInput),
    (error) => error === repositoryError,
  );

  const auditError = new Error("audit failed");
  const auditHarness = createHarness({ auditError });
  await assert.rejects(
    auditHarness.operations.createClinicStudyTrackingCase(createInput),
    (error) => error === auditError,
  );
  assert.equal(
    auditHarness.calls.some(([name]) => name === "email"),
    false,
  );
  assert.equal(repositoryHarness.calls.length, 0);
});
