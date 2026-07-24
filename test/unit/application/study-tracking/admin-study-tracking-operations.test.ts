import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminStudyTrackingOperations,
  type AdminStudyTrackingCaseListParams,
  type AdminStudyTrackingNotificationListParams,
  type CreateAdminStudyTrackingCaseData,
  type UpdateAdminStudyTrackingCaseData,
} from "../../../../server/features/study-tracking/application/index.ts";

type TrackingCase = {
  id: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  estimatedDeliveryAutoCalculatedAt: Date;
  estimatedDeliveryWasManuallyAdjusted: boolean;
  currentStage: string;
  processingAt: Date | null;
  evaluationAt: Date | null;
  reportDevelopmentAt: Date | null;
  deliveredAt: Date | null;
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

type Call = {
  name: string;
  args: readonly unknown[];
};

const labReceivedAt = new Date("2026-07-01T00:00:00.000Z");
const automaticDeliveryAt = new Date("2026-07-22T00:00:00.000Z");
const notifiedAt = new Date("2026-07-24T10:00:00.000Z");
const auditRequest = { requestId: "admin-study-tracking-test" };

function buildTrackingCase(
  overrides: Partial<TrackingCase> = {},
): TrackingCase {
  return {
    id: 101,
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    receptionAt: labReceivedAt,
    estimatedDeliveryAt: automaticDeliveryAt,
    estimatedDeliveryAutoCalculatedAt: automaticDeliveryAt,
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "reception",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: "https://pay.example.test/case-101",
    adminContactEmail: "admin@example.test",
    adminContactPhone: "+5493410000000",
    notes: "Caso administrativo",
    ...overrides,
  };
}

function buildNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: 202,
    studyTrackingCaseId: 101,
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    type: "special_stain_required",
    title: "Se requiere tinción especial",
    ...overrides,
  };
}

function createData(
  overrides: Partial<CreateAdminStudyTrackingCaseData> = {},
): CreateAdminStudyTrackingCaseData {
  return {
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    labReceivedAt,
    currentStage: "reception",
    specialStainRequired: false,
    paymentUrl: "https://pay.example.test/case-101",
    adminContactEmail: "admin@example.test",
    adminContactPhone: "+5493410000000",
    notes: "Caso administrativo",
    ...overrides,
  };
}

function createHarness(options: {
  created?: TrackingCase;
  scopedCase?: TrackingCase | null | undefined;
  globalCase?: TrackingCase | null | undefined;
  useScopedCase?: boolean;
  useGlobalCase?: boolean;
  updateResults?: Array<TrackingCase | null | undefined>;
  clinic?: { id: number; name: string; contactEmail: string | null } | null;
  report?: { id: number; clinicId: number } | null;
  token?: { id: number; clinicId: number } | null | undefined;
  markOneResult?: Notification | null | undefined;
  emailError?: unknown;
  auditError?: unknown;
  errorAt?: string;
  error?: unknown;
} = {}) {
  const calls: Call[] = [];
  const created = options.created ?? buildTrackingCase();
  const notification = buildNotification();
  const updateResults = [...(options.updateResults ?? [created])];
  const expectedError = options.error ?? new Error("repository failed");

  function record(name: string, ...args: readonly unknown[]) {
    calls.push({ name, args });

    if (options.errorAt === name) {
      throw expectedError;
    }
  }

  const operations = createAdminStudyTrackingOperations({
    queryRepository: {
      getClinicScopedStudyTrackingCase: async (
        id: number,
        clinicId: number,
      ) => {
        record("get-scoped-case", id, clinicId);
        return options.useScopedCase ? options.scopedCase : created;
      },
      getStudyTrackingCaseById: async (id: number) => {
        record("get-global-case", id);
        return options.useGlobalCase ? options.globalCase : created;
      },
      listStudyTrackingCases: async (
        params: AdminStudyTrackingCaseListParams,
      ) => {
        record("list-cases", params);
        return [created];
      },
      listStudyTrackingNotifications: async (
        params: AdminStudyTrackingNotificationListParams,
      ) => {
        record("list-notifications", params);
        return [notification];
      },
    },
    commandRepository: {
      createStudyTrackingCase: async (input) => {
        record("create-case", input);
        return created;
      },
      updateStudyTrackingCase: async (id, patch) => {
        record("update-case", id, patch);
        return updateResults.length > 0 ? updateResults.shift() : created;
      },
      createStudyTrackingNotification: async (input) => {
        record("create-notification", input);
        return buildNotification({
          id: 202 + calls.filter((call) => call.name === "create-notification").length,
          studyTrackingCaseId: input.studyTrackingCaseId,
          clinicId: input.clinicId,
          reportId: input.reportId,
          particularTokenId: input.particularTokenId,
          type: input.type,
          title: input.title,
        });
      },
      markStudyTrackingNotificationRead: async (id: number) => {
        record("mark-read", id);
        return options.markOneResult === undefined
          ? notification
          : options.markOneResult;
      },
      markAllStudyTrackingNotificationsRead: async (params) => {
        record("mark-all", params);
        return { updatedCount: 3 };
      },
    },
    referenceRepository: {
      getClinicById: async (clinicId: number) => {
        record("get-clinic", clinicId);
        return options.clinic === undefined
          ? {
              id: clinicId,
              name: "Clínica Norte",
              contactEmail: "clinic@example.test",
            }
          : options.clinic;
      },
      getReportById: async (reportId: number) => {
        record("get-report", reportId);
        return options.report === undefined
          ? { id: reportId, clinicId: 7 }
          : options.report;
      },
      getParticularTokenById: async (tokenId: number) => {
        record("get-token", tokenId);
        return options.token === undefined
          ? { id: tokenId, clinicId: 7 }
          : options.token;
      },
      updateParticularTokenReport: async (
        tokenId: number,
        reportId: number | null,
      ) => {
        record("link-token-report", tokenId, reportId);
        return { id: tokenId, clinicId: 7 };
      },
    },
    notification: {
      sendSpecialStainRequiredEmail: async (input) => {
        record("email", input);

        if (options.emailError) {
          throw options.emailError;
        }

        return { sent: true };
      },
    },
    audit: {
      writeAuditLog: async (request, input) => {
        record("audit", request, input);

        if (options.auditError) {
          throw options.auditError;
        }
      },
    },
    auditEvents: {
      caseCreated: "study_tracking.case.created",
      caseUpdated: "study_tracking.case.updated",
      notificationCreated: "study_tracking.notification.created",
    },
    createDate: () => notifiedAt,
  });

  return {
    calls,
    created,
    error: expectedError,
    notification,
    operations,
  };
}

function callNames(calls: readonly Call[]): string[] {
  return calls.map((call) => call.name);
}

test("admin operations preservan consultas globales/clinic-scoped, identidad e inputs", async () => {
  const harness = createHarness();
  const global = await harness.operations.resolveAdminStudyTrackingCase({
    trackingCaseId: 101,
  });
  const scoped = await harness.operations.resolveAdminStudyTrackingCase({
    trackingCaseId: 101,
    clinicId: 7,
  });
  const listInput: AdminStudyTrackingCaseListParams = {
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    limit: 5,
    offset: 2,
  };
  const listSnapshot = { ...listInput };
  const cases =
    await harness.operations.listAdminStudyTrackingCases(listInput);

  assert.equal(global, harness.created);
  assert.equal(scoped, harness.created);
  assert.equal(cases[0], harness.created);
  assert.deepEqual(listInput, listSnapshot);
  assert.deepEqual(callNames(harness.calls), [
    "get-global-case",
    "get-scoped-case",
    "list-cases",
  ]);
  assert.equal(harness.calls[2]?.args[0], listInput);
});

test("admin operations preservan null, undefined y error por identidad en resolve", async () => {
  assert.equal(
    await createHarness({ globalCase: null, useGlobalCase: true }).operations
      .resolveAdminStudyTrackingCase({ trackingCaseId: 101 }),
    null,
  );
  assert.equal(
    await createHarness({ scopedCase: null, useScopedCase: true }).operations
      .resolveAdminStudyTrackingCase({
        trackingCaseId: 101,
        clinicId: 7,
      }),
    null,
  );

  assert.equal(
    await createHarness({
      globalCase: undefined,
      useGlobalCase: true,
    }).operations.resolveAdminStudyTrackingCase({
      trackingCaseId: 101,
    }),
    undefined,
  );

  const error = new Error("query identity");
  const errorHarness = createHarness({
    errorAt: "get-global-case",
    error,
  });

  await assert.rejects(
    errorHarness.operations.resolveAdminStudyTrackingCase({
      trackingCaseId: 101,
    }),
    (received) => received === error,
  );
});

test("admin operations preservan notificaciones globales/clinic-scoped y acknowledgements", async () => {
  const harness = createHarness();
  const globalInput: AdminStudyTrackingNotificationListParams = {
    unreadOnly: false,
    limit: 50,
    offset: 0,
  };
  const scopedInput: AdminStudyTrackingNotificationListParams = {
    clinicId: 7,
    unreadOnly: true,
    limit: 5,
    offset: 2,
  };

  const global =
    await harness.operations.listAdminStudyTrackingNotifications(globalInput);
  const scoped =
    await harness.operations.listAdminStudyTrackingNotifications(scopedInput);
  const marked =
    await harness.operations.acknowledgeAdminStudyTrackingNotification(202);
  const readAllGlobal =
    await harness.operations.acknowledgeAllAdminStudyTrackingNotifications({});
  const readAllScoped =
    await harness.operations.acknowledgeAllAdminStudyTrackingNotifications({
      clinicId: 7,
    });

  assert.equal(global[0], harness.notification);
  assert.equal(scoped[0], harness.notification);
  assert.equal(marked, harness.notification);
  assert.deepEqual(readAllGlobal, { updatedCount: 3 });
  assert.deepEqual(readAllScoped, { updatedCount: 3 });
  assert.deepEqual(callNames(harness.calls), [
    "list-notifications",
    "list-notifications",
    "mark-read",
    "mark-all",
    "mark-all",
  ]);
  assert.equal(harness.calls[0]?.args[0], globalInput);
  assert.equal(harness.calls[1]?.args[0], scopedInput);
  assert.deepEqual(harness.calls[3]?.args[0], {});
  assert.deepEqual(harness.calls[4]?.args[0], { clinicId: 7 });
});

test("admin operations preservan null/undefined y error en notification mark-one", async () => {
  assert.equal(
    await createHarness({ markOneResult: null }).operations
      .acknowledgeAdminStudyTrackingNotification(202),
    null,
  );

  const error = new Error("mark identity");
  const harness = createHarness({ errorAt: "mark-read", error });
  await assert.rejects(
    harness.operations.acknowledgeAdminStudyTrackingNotification(202),
    (received) => received === error,
  );
});

test("admin create corta con outcomes exactos antes de persistir", async () => {
  const scenarios = [
    {
      harness: createHarness({ clinic: null }),
      status: "clinic_not_found",
      calls: ["get-clinic"],
    },
    {
      harness: createHarness({ report: null }),
      status: "report_not_found",
      calls: ["get-clinic", "get-report"],
    },
    {
      harness: createHarness({ report: { id: 31, clinicId: 99 } }),
      status: "report_clinic_mismatch",
      calls: ["get-clinic", "get-report"],
    },
    {
      harness: createHarness({ token: null }),
      status: "particular_token_not_found",
      calls: ["get-clinic", "get-report", "get-token"],
    },
    {
      harness: createHarness({ token: { id: 41, clinicId: 99 } }),
      status: "particular_token_clinic_mismatch",
      calls: ["get-clinic", "get-report", "get-token"],
    },
  ] as const;

  for (const scenario of scenarios) {
    const result =
      await scenario.harness.operations.createAdminStudyTrackingCase({
        actor: { adminId: 9 },
        data: createData(),
        auditRequest,
      });

    assert.equal(result.status, scenario.status);
    assert.deepEqual(callNames(scenario.harness.calls), scenario.calls);
  }
});

test("admin create mínimo calcula delivery, atribuye admin, audita y no muta input", async () => {
  const created = buildTrackingCase({
    reportId: null,
    particularTokenId: null,
  });
  const harness = createHarness({ created });
  const data = createData({
    reportId: undefined,
    particularTokenId: undefined,
  });
  const dataSnapshot = { ...data };
  const result = await harness.operations.createAdminStudyTrackingCase({
    actor: { adminId: 9 },
    data,
    auditRequest,
  });

  assert.equal(result.status, "created");
  if (result.status !== "created") {
    return;
  }
  assert.equal(result.trackingCase, created);
  assert.deepEqual(data, dataSnapshot);
  assert.deepEqual(callNames(harness.calls), [
    "get-clinic",
    "create-case",
    "audit",
  ]);

  const createInput = harness.calls[1]?.args[0] as Record<string, unknown>;
  assert.equal(createInput.createdByAdminId, 9);
  assert.equal(createInput.createdByClinicUserId, null);
  assert.equal(createInput.receptionAt, labReceivedAt);
  assert.equal(
    (createInput.estimatedDeliveryAt as Date).toISOString(),
    "2026-07-23T00:00:00.000Z",
  );
  assert.equal(createInput.estimatedDeliveryWasManuallyAdjusted, false);

  const auditInput = harness.calls[2]?.args[1] as {
    event: string;
    metadata: Record<string, unknown>;
  };
  assert.equal(harness.calls[2]?.args[0], auditRequest);
  assert.equal(auditInput.event, "study_tracking.case.created");
  assert.equal(auditInput.metadata.createdVia, "admin");
  assert.equal(auditInput.metadata.labReceivedAt, created.receptionAt);
});

test("admin create respeta entrega manual y vínculo token-report", async () => {
  const manualDeliveryAt = new Date("2026-07-30T00:00:00.000Z");
  const harness = createHarness();
  const result = await harness.operations.createAdminStudyTrackingCase({
    actor: { adminId: 9 },
    data: createData({ estimatedDeliveryAt: manualDeliveryAt }),
    auditRequest,
  });

  assert.equal(result.status, "created");
  const createInput = harness.calls.find(
    (call) => call.name === "create-case",
  )?.args[0] as Record<string, unknown>;
  assert.equal(createInput.estimatedDeliveryAt, manualDeliveryAt);
  assert.equal(createInput.estimatedDeliveryWasManuallyAdjusted, true);
  assert.deepEqual(
    harness.calls.find((call) => call.name === "link-token-report")?.args,
    [41, 31],
  );
});

test("admin create con tinción conserva mensaje, timestamp, email, auditorías y orden", async () => {
  const created = buildTrackingCase({ specialStainRequired: true });
  const finalCase = buildTrackingCase({
    specialStainRequired: true,
    specialStainNotifiedAt: notifiedAt,
  });
  const harness = createHarness({
    created,
    updateResults: [finalCase],
  });
  const result = await harness.operations.createAdminStudyTrackingCase({
    actor: { adminId: 9 },
    data: createData({ specialStainRequired: true }),
    auditRequest,
  });

  assert.equal(result.status, "created");
  if (result.status !== "created") {
    return;
  }
  assert.equal(result.trackingCase, finalCase);
  assert.deepEqual(callNames(harness.calls), [
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
  ]);

  const notificationInput = harness.calls[5]?.args[0] as Record<string, unknown>;
  assert.deepEqual(notificationInput, {
    studyTrackingCaseId: 101,
    clinicId: 7,
    reportId: 31,
    particularTokenId: 41,
    type: "special_stain_required",
    title: "Se requiere tinción especial",
    message:
      "El estudio ingresó a evaluación y requiere tinción especial para continuar.",
    isRead: false,
    readAt: null,
  });
  assert.deepEqual(harness.calls[6]?.args, [
    101,
    { specialStainNotifiedAt: notifiedAt },
  ]);

  const emailInput = harness.calls[8]?.args[0] as Record<string, unknown>;
  assert.deepEqual(emailInput.to, [
    "clinic@example.test",
    "admin@example.test",
  ]);
  const auditEvents = harness.calls
    .filter((call) => call.name === "audit")
    .map((call) => (call.args[1] as { event: string }).event);
  assert.deepEqual(auditEvents, [
    "study_tracking.case.created",
    "study_tracking.notification.created",
  ]);
});

test("admin create conserva fallback si el timestamp update devuelve null", async () => {
  const created = buildTrackingCase({ specialStainRequired: true });
  const harness = createHarness({
    created,
    updateResults: [null],
  });
  const result = await harness.operations.createAdminStudyTrackingCase({
    actor: { adminId: 9 },
    data: createData({ specialStainRequired: true }),
    auditRequest,
  });

  assert.equal(result.status, "created");
  if (result.status === "created") {
    assert.equal(result.trackingCase, created);
  }
});

test("admin create mantiene email best-effort y propaga error de auditoría", async () => {
  const emailError = Object.assign(new Error("smtp failed"), {
    code: "SMTP_DOWN",
  });
  const harness = createHarness({
    created: buildTrackingCase({ specialStainRequired: true }),
    emailError,
  });
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const result = await harness.operations.createAdminStudyTrackingCase({
      actor: { adminId: 9 },
      data: createData({ specialStainRequired: true }),
      auditRequest,
    });

    assert.equal(result.status, "created");
    assert.equal(logged.length, 1);
    assert.deepEqual(logged[0]?.[1], {
      trackingCaseId: 101,
      clinicId: 7,
      errorName: "Error",
      errorCode: "SMTP_DOWN",
    });
  } finally {
    console.error = originalConsoleError;
  }

  const auditError = new Error("audit identity");
  const auditHarness = createHarness({ auditError });
  await assert.rejects(
    auditHarness.operations.createAdminStudyTrackingCase({
      actor: { adminId: 9 },
      data: createData({
        reportId: undefined,
        particularTokenId: undefined,
      }),
      auditRequest,
    }),
    (received) => received === auditError,
  );
});

test("admin create propaga error repository por identidad", async () => {
  const error = new Error("create identity");
  const harness = createHarness({
    errorAt: "create-case",
    error,
  });

  await assert.rejects(
    harness.operations.createAdminStudyTrackingCase({
      actor: { adminId: 9 },
      data: createData(),
      auditRequest,
    }),
    (received) => received === error,
  );
});

test("admin update corta con ownership outcomes antes del update", async () => {
  const scenarios = [
    {
      harness: createHarness({ report: null }),
      data: { reportId: 31 },
      status: "report_not_found",
      calls: ["get-report"],
    },
    {
      harness: createHarness({ report: { id: 31, clinicId: 99 } }),
      data: { reportId: 31 },
      status: "report_clinic_mismatch",
      calls: ["get-report"],
    },
    {
      harness: createHarness({ token: null }),
      data: { particularTokenId: 41 },
      status: "particular_token_not_found",
      calls: ["get-token"],
    },
    {
      harness: createHarness({ token: { id: 41, clinicId: 99 } }),
      data: { particularTokenId: 41 },
      status: "particular_token_clinic_mismatch",
      calls: ["get-token"],
    },
  ] as const;

  for (const scenario of scenarios) {
    const result =
      await scenario.harness.operations.updateAdminStudyTrackingCase({
        trackingCaseId: 101,
        current: scenario.harness.created,
        data: scenario.data,
        auditRequest,
      });

    assert.equal(result.status, scenario.status);
    assert.deepEqual(callNames(scenario.harness.calls), scenario.calls);
  }
});

test("admin update preserva null y undefined como tracking_case_not_found", async () => {
  for (const missing of [null, undefined]) {
    const harness = createHarness({ updateResults: [missing] });
    const result =
      await harness.operations.updateAdminStudyTrackingCase({
        trackingCaseId: 101,
        current: harness.created,
        data: { notes: "actualizado" },
        auditRequest,
      });

    assert.equal(result.status, "tracking_case_not_found");
    assert.deepEqual(callNames(harness.calls), ["update-case"]);
  }
});

test("admin update simple no recalcula delivery ni notifica stage y no muta inputs", async () => {
  const current = buildTrackingCase({ currentStage: "evaluation" });
  const updated = buildTrackingCase({
    currentStage: "evaluation",
    notes: "actualizado",
  });
  const harness = createHarness({ updateResults: [updated] });
  const data: UpdateAdminStudyTrackingCaseData = { notes: "actualizado" };
  const currentSnapshot = { ...current };
  const dataSnapshot = { ...data };
  const result = await harness.operations.updateAdminStudyTrackingCase({
    trackingCaseId: 101,
    current,
    data,
    auditRequest,
  });

  assert.equal(result.status, "updated");
  assert.deepEqual(current, currentSnapshot);
  assert.deepEqual(data, dataSnapshot);
  assert.deepEqual(callNames(harness.calls), [
    "update-case",
    "link-token-report",
    "audit",
  ]);
  const patch = harness.calls[0]?.args[1] as Record<string, unknown>;
  assert.equal(patch.estimatedDeliveryAt, undefined);
  assert.equal(patch.estimatedDeliveryAutoCalculatedAt, undefined);
  assert.equal(patch.estimatedDeliveryWasManuallyAdjusted, undefined);
});

test("admin update recalcula delivery automática y manual sólo cuando corresponde", async () => {
  const newReception = new Date("2026-07-02T00:00:00.000Z");
  const automaticHarness = createHarness();
  await automaticHarness.operations.updateAdminStudyTrackingCase({
    trackingCaseId: 101,
    current: automaticHarness.created,
    data: { labReceivedAt: newReception },
    auditRequest,
  });
  const automaticPatch = automaticHarness.calls[0]?.args[1] as Record<
    string,
    unknown
  >;
  assert.equal(automaticPatch.receptionAt, newReception);
  assert.equal(
    (automaticPatch.estimatedDeliveryAt as Date).toISOString(),
    "2026-07-24T00:00:00.000Z",
  );
  assert.equal(automaticPatch.estimatedDeliveryWasManuallyAdjusted, false);

  const manualDelivery = new Date("2026-08-01T00:00:00.000Z");
  const manualHarness = createHarness();
  await manualHarness.operations.updateAdminStudyTrackingCase({
    trackingCaseId: 101,
    current: manualHarness.created,
    data: { estimatedDeliveryAt: manualDelivery },
    auditRequest,
  });
  const manualPatch = manualHarness.calls[0]?.args[1] as Record<string, unknown>;
  assert.equal(manualPatch.estimatedDeliveryAt, manualDelivery);
  assert.equal(manualPatch.estimatedDeliveryWasManuallyAdjusted, true);
});

test("admin update aplica stage defaults y crea mensaje exacto de cambio", async () => {
  const current = buildTrackingCase({ currentStage: "processing" });
  const updated = buildTrackingCase({
    currentStage: "evaluation",
    evaluationAt: new Date(),
  });
  const harness = createHarness({ updateResults: [updated] });
  const result = await harness.operations.updateAdminStudyTrackingCase({
    trackingCaseId: 101,
    current,
    data: { currentStage: "evaluation" },
    auditRequest,
  });

  assert.equal(result.status, "updated");
  const patch = harness.calls[0]?.args[1] as Record<string, unknown>;
  assert.ok(patch.evaluationAt instanceof Date);
  const notification = harness.calls.find(
    (call) => call.name === "create-notification",
  )?.args[0] as Record<string, unknown>;
  assert.equal(notification.type, "stage_changed");
  assert.equal(notification.title, "Estado de estudio actualizado");
  assert.equal(
    notification.message,
    "El estudio cambió de estado: Procesamiento → Evaluación.",
  );
});

test("admin update con tinción + stage conserva side-effect order, fallback y metadata", async () => {
  const current = buildTrackingCase({
    currentStage: "reception",
    specialStainRequired: false,
  });
  const updated = buildTrackingCase({
    currentStage: "evaluation",
    specialStainRequired: true,
    specialStainNotifiedAt: null,
  });
  const harness = createHarness({
    updateResults: [updated, null],
  });
  const result = await harness.operations.updateAdminStudyTrackingCase({
    trackingCaseId: 101,
    current,
    data: {
      currentStage: "evaluation",
      specialStainRequired: true,
    },
    auditRequest,
  });

  assert.equal(result.status, "updated");
  if (result.status === "updated") {
    assert.equal(result.trackingCase, updated);
  }
  assert.deepEqual(callNames(harness.calls), [
    "update-case",
    "link-token-report",
    "create-notification",
    "update-case",
    "get-clinic",
    "email",
    "create-notification",
    "audit",
    "audit",
    "audit",
  ]);

  const notificationInputs = harness.calls
    .filter((call) => call.name === "create-notification")
    .map((call) => call.args[0] as Record<string, unknown>);
  assert.equal(notificationInputs[0]?.type, "special_stain_required");
  assert.equal(
    notificationInputs[0]?.message,
    "El estudio requiere tinción especial. Revisá el seguimiento para continuar la gestión.",
  );
  assert.equal(notificationInputs[1]?.type, "stage_changed");
  assert.equal(
    notificationInputs[1]?.message,
    "El estudio cambió de estado: Recepción → Evaluación.",
  );

  const auditInputs = harness.calls
    .filter((call) => call.name === "audit")
    .map((call) => call.args[1] as {
      event: string;
      metadata: Record<string, unknown>;
    });
  assert.deepEqual(
    auditInputs.map((input) => [
      input.event,
      input.metadata.type ?? "case",
    ]),
    [
      ["study_tracking.case.updated", "case"],
      ["study_tracking.notification.created", "special_stain_required"],
      ["study_tracking.notification.created", "stage_changed"],
    ],
  );
  assert.equal(auditInputs[0]?.metadata.updatedVia, "admin");
  assert.equal(auditInputs[2]?.metadata.fromStage, "reception");
  assert.equal(auditInputs[2]?.metadata.toStage, "evaluation");
});

test("admin update special_stain_resolved notifica y audita después de case update", async () => {
  const current = buildTrackingCase({
    currentStage: "evaluation",
    specialStainRequired: true,
    specialStainNotifiedAt: notifiedAt,
  });
  const updated = buildTrackingCase({
    currentStage: "evaluation",
    specialStainRequired: false,
    specialStainNotifiedAt: notifiedAt,
  });
  const harness = createHarness({ updateResults: [updated] });
  const result = await harness.operations.updateAdminStudyTrackingCase({
    trackingCaseId: 101,
    current,
    data: { specialStainRequired: false },
    auditRequest,
  });

  assert.equal(result.status, "updated");
  assert.deepEqual(callNames(harness.calls), [
    "update-case",
    "link-token-report",
    "create-notification",
    "audit",
    "audit",
  ]);
  const notification = harness.calls[2]?.args[0] as Record<string, unknown>;
  assert.deepEqual(
    {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      readAt: notification.readAt,
    },
    {
      type: "special_stain_resolved",
      title: "Tinción especial resuelta",
      message: "La solicitud de tinción especial fue resuelta.",
      isRead: false,
      readAt: null,
    },
  );
  const auditInputs = harness.calls
    .filter((call) => call.name === "audit")
    .map((call) => call.args[1] as { event: string; metadata: Record<string, unknown> });
  assert.equal(auditInputs[0]?.event, "study_tracking.case.updated");
  assert.equal(auditInputs[1]?.metadata.type, "special_stain_resolved");
});

test("admin update propaga errores de repository y auditoría por identidad", async () => {
  const repositoryError = new Error("update identity");
  const repositoryHarness = createHarness({
    errorAt: "update-case",
    error: repositoryError,
  });
  await assert.rejects(
    repositoryHarness.operations.updateAdminStudyTrackingCase({
      trackingCaseId: 101,
      current: repositoryHarness.created,
      data: { notes: "actualizado" },
      auditRequest,
    }),
    (received) => received === repositoryError,
  );

  const auditError = new Error("audit identity");
  const auditHarness = createHarness({ auditError });
  await assert.rejects(
    auditHarness.operations.updateAdminStudyTrackingCase({
      trackingCaseId: 101,
      current: auditHarness.created,
      data: { notes: "actualizado" },
      auditRequest,
    }),
    (received) => received === auditError,
  );
});
