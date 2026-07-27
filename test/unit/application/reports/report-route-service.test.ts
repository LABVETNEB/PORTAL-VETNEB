import assert from "node:assert/strict";
import test from "node:test";

import {
  createReportRouteService,
  type ReportRouteServiceDependencies,
  type ReportUploadRouteInput,
} from "../../../../server/features/reports/application/index.ts";

type FixtureReport = {
  id: number;
  clinicId: number;
  storagePath: string;
  fileName: string | null;
};

type FixtureToken = {
  id: number;
  clinicId: number;
  reportId: number | null;
  createdByClinicUserId: number | null;
  updatedAt: Date;
};

type FixtureTracking = {
  id: number;
  currentStage: string;
  particularTokenId: number | null;
  deliveredAt: Date | null;
};

type FixtureWorkflow = {
  id: number;
  clinicId: number;
  workflowStage: string;
  workflowUpdatedAt: string | null;
  specialStainRequested: boolean;
  specialStainAt: string | null;
};

type Dependencies = ReportRouteServiceDependencies<
  FixtureReport,
  FixtureToken,
  FixtureTracking,
  FixtureWorkflow
>;

const NOW = new Date("2026-07-27T15:00:00.000Z");
const report: FixtureReport = {
  id: 88,
  clinicId: 3,
  storagePath: "reports/3/luna.pdf",
  fileName: "luna.pdf",
};
const token: FixtureToken = {
  id: 7,
  clinicId: 3,
  reportId: null,
  createdByClinicUserId: 19,
  updatedAt: new Date("2026-07-20T10:00:00.000Z"),
};
const tracking: FixtureTracking = {
  id: 11,
  currentStage: "delivered",
  particularTokenId: 7,
  deliveredAt: NOW,
};
const workflow: FixtureWorkflow = {
  id: 88,
  clinicId: 3,
  workflowStage: "processing",
  workflowUpdatedAt: NOW.toISOString(),
  specialStainRequested: false,
  specialStainAt: null,
};

function dependencies(
  overrides: Partial<Dependencies> = {},
): Dependencies {
  return {
    getClinicById: async (clinicId) => ({ id: clinicId }),
    getReportById: async () => report,
    uploadReport: async () => report.storagePath,
    createOrEditReport: async () => report,
    getParticularTokenById: async () => token,
    updateParticularTokenReport: async () => token,
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    updateStudyTrackingCase: async () => tracking,
    ensureStudyTrackingCaseForToken: async () => tracking,
    createStudyTrackingNotification: async () => undefined,
    createSignedReportUrl: async (storagePath) => `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (storagePath, fileName) =>
      `download:${storagePath}:${fileName ?? ""}`,
    normalizeSearchText: (value) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined,
    parseReportStudyType: (value) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined,
    parseOptionalDate: (value) =>
      typeof value === "string" && value
        ? new Date(value)
        : value instanceof Date
          ? value
          : undefined,
    listAdminReportWorkflowItems: async () => [workflow],
    getAdminReportWorkflowItem: async () => workflow,
    updateAdminReportWorkflowStage: async (_id, stage) => ({
      ...workflow,
      workflowStage: stage,
    }),
    updateAdminReportSpecialStain: async (_id, requested) => ({
      ...workflow,
      specialStainRequested: requested,
      specialStainAt: requested ? NOW.toISOString() : null,
    }),
    writeAuditLog: async () => undefined,
    auditEvents: {
      reportUploaded: "report.uploaded",
      workflowStageChanged: "report.workflow_stage.changed",
      specialStainChanged: "report.special_stain.changed",
    },
    logReportDeliveredNotificationFailure: () => undefined,
    ...overrides,
  };
}

function uploadInput(
  overrides: Partial<ReportUploadRouteInput> = {},
) {
  return {
    clinicId: 3,
    file: {
      buffer: Buffer.from("pdf"),
      fileName: "luna.pdf",
      mimeType: "application/pdf",
    },
    patientName: " Luna ",
    studyType: "histopatologia",
    uploadDate: "2026-07-27",
    adminUserId: 5,
    auditContext: { opaque: true },
    now: NOW,
    ...overrides,
  };
}

test("signed preview y download respetan success, not_found y fileName", async () => {
  const calls: string[] = [];
  const service = createReportRouteService(
    dependencies({
      getReportById: async (id) => {
        calls.push(`get:${id}`);
        return id === 88 ? report : null;
      },
      createSignedReportUrl: async (path) => {
        calls.push(`preview:${path}`);
        return "preview-url";
      },
      createSignedReportDownloadUrl: async (path, fileName) => {
        calls.push(`download:${path}:${fileName}`);
        return "download-url";
      },
    }),
  );

  assert.deepEqual(await service.getSignedPreviewUrl(88), {
    type: "signed",
    previewUrl: "preview-url",
  });
  assert.deepEqual(await service.getSignedPreviewUrl(404), {
    type: "not_found",
  });
  assert.deepEqual(await service.getSignedDownloadUrl(88), {
    type: "signed",
    downloadUrl: "download-url",
  });
  assert.deepEqual(await service.getSignedDownloadUrl(404), {
    type: "not_found",
  });
  assert.deepEqual(calls, [
    "get:88",
    `preview:${report.storagePath}`,
    "get:404",
    "get:88",
    `download:${report.storagePath}:${report.fileName}`,
    "get:404",
  ]);
});

test("upload distingue clínica inexistente y valida clínica antes de archivo ausente", async () => {
  const calls: string[] = [];
  const missingClinic = createReportRouteService(
    dependencies({
      getClinicById: async () => {
        calls.push("clinic");
        return null;
      },
      uploadReport: async () => {
        calls.push("storage");
        return "unexpected";
      },
    }),
  );

  assert.deepEqual(
    await missingClinic.uploadAdminReport(
      uploadInput({ file: undefined }),
    ),
    { type: "clinic_not_found" },
  );
  assert.deepEqual(calls, ["clinic"]);

  const missingFile = createReportRouteService(
    dependencies({
      getClinicById: async () => {
        calls.push("clinic-present");
        return { id: 3 };
      },
    }),
  );
  assert.deepEqual(
    await missingFile.uploadAdminReport(uploadInput({ file: undefined })),
    { type: "file_missing" },
  );
  assert.deepEqual(calls, ["clinic", "clinic-present"]);
});

test("upload sin token no crea tracking inexistente y preserva storage, autoría y audit", async () => {
  const calls: string[] = [];
  const createInputs: unknown[] = [];
  const auditInputs: unknown[] = [];
  const service = createReportRouteService(
    dependencies({
      getClinicById: async () => {
        calls.push("clinic");
        return { id: 3 };
      },
      uploadReport: async () => {
        calls.push("storage");
        return report.storagePath;
      },
      normalizeSearchText: (value) => {
        calls.push("normalize");
        return String(value).trim();
      },
      createOrEditReport: async (input) => {
        calls.push("create");
        createInputs.push(input);
        return report;
      },
      getStudyTrackingCaseByReportId: async () => {
        calls.push("tracking");
        return null;
      },
      createStudyTrackingNotification: async () => {
        calls.push("notification");
      },
      writeAuditLog: async (_context, input) => {
        calls.push("audit");
        auditInputs.push(input);
      },
    }),
  );

  const result = await service.uploadAdminReport(uploadInput());

  assert.equal(result.type, "uploaded");
  assert.deepEqual(calls, [
    "clinic",
    "storage",
    "normalize",
    "create",
    "tracking",
    "audit",
  ]);
  assert.deepEqual(createInputs[0], {
    clinicId: 3,
    patientName: "Luna",
    studyType: "histopatologia",
    uploadDate: new Date("2026-07-27"),
    fileName: "luna.pdf",
    storagePath: report.storagePath,
    createdByAdminUserId: 5,
  });
  assert.deepEqual(auditInputs[0], {
    event: "report.uploaded",
    clinicId: 3,
    reportId: 88,
    metadata: {
      fileName: "luna.pdf",
      mimeType: "application/pdf",
      patientName: "Luna",
      studyType: "histopatologia",
      uploadDate: new Date("2026-07-27"),
      uploadedVia: "admin",
      particularTokenId: null,
      trackingCaseId: null,
      trackingStage: null,
    },
  });
});

test("upload sin token actualiza sólo tracking no-delivered, notifica y audita en orden", async () => {
  const calls: string[] = [];
  const pending = { ...tracking, currentStage: "processing", deliveredAt: null };
  const notifications: unknown[] = [];
  const service = createReportRouteService(
    dependencies({
      getStudyTrackingCaseByReportId: async () => {
        calls.push("tracking");
        return pending;
      },
      updateStudyTrackingCase: async (id, input) => {
        calls.push("tracking-update");
        assert.deepEqual({ id, input }, {
          id: 11,
          input: {
            reportId: 88,
            currentStage: "delivered",
            deliveredAt: NOW,
          },
        });
        return tracking;
      },
      createStudyTrackingNotification: async (input) => {
        calls.push("notification");
        notifications.push(input);
      },
      writeAuditLog: async () => {
        calls.push("audit");
      },
    }),
  );

  await service.uploadAdminReport(uploadInput());

  assert.deepEqual(calls.slice(-4), [
    "tracking",
    "tracking-update",
    "notification",
    "audit",
  ]);
  assert.deepEqual(notifications, [
    {
      studyTrackingCaseId: 11,
      clinicId: 3,
      reportId: 88,
      particularTokenId: 7,
      type: "report_delivered",
      title: "Informe disponible",
      message: "El informe del estudio ya está disponible.",
      isRead: false,
      readAt: null,
    },
  ]);
});

test("upload no actualiza ni duplica notification cuando tracking ya estaba delivered", async () => {
  let updates = 0;
  let notifications = 0;
  const service = createReportRouteService(
    dependencies({
      getStudyTrackingCaseByReportId: async () => tracking,
      updateStudyTrackingCase: async () => {
        updates += 1;
        return tracking;
      },
      createStudyTrackingNotification: async () => {
        notifications += 1;
      },
    }),
  );

  assert.equal(
    (await service.uploadAdminReport(uploadInput())).type,
    "uploaded",
  );
  assert.equal(updates, 0);
  assert.equal(notifications, 0);
});

test("upload distingue token inexistente y token de otra clínica antes de storage", async () => {
  let storageCalls = 0;
  const base = {
    uploadReport: async () => {
      storageCalls += 1;
      return report.storagePath;
    },
  };
  const missing = createReportRouteService(
    dependencies({
      ...base,
      getParticularTokenById: async () => null,
    }),
  );
  const mismatched = createReportRouteService(
    dependencies({
      ...base,
      getParticularTokenById: async () => ({ ...token, clinicId: 99 }),
    }),
  );

  assert.deepEqual(
    await missing.uploadAdminReport(uploadInput({ particularTokenId: 7 })),
    { type: "token_not_found" },
  );
  assert.deepEqual(
    await mismatched.uploadAdminReport(uploadInput({ particularTokenId: 7 })),
    { type: "token_clinic_mismatch" },
  );
  assert.equal(storageCalls, 0);
});

test("upload con token preserva fallback tracking, identidad y orden completo", async () => {
  const calls: string[] = [];
  let tokenForTracking: FixtureToken | undefined;
  const service = createReportRouteService(
    dependencies({
      getClinicById: async () => {
        calls.push("clinic");
        return { id: 3 };
      },
      getParticularTokenById: async () => {
        calls.push("token-get");
        return token;
      },
      uploadReport: async () => {
        calls.push("storage");
        return report.storagePath;
      },
      createOrEditReport: async () => {
        calls.push("create");
        return report;
      },
      getParticularStudyTrackingCase: async () => {
        calls.push("tracking-token");
        return null;
      },
      getStudyTrackingCaseByReportId: async () => {
        calls.push("tracking-report");
        return null;
      },
      updateParticularTokenReport: async () => {
        calls.push("token-update");
        return null;
      },
      ensureStudyTrackingCaseForToken: async (linkedToken, input) => {
        calls.push("tracking-ensure");
        tokenForTracking = linkedToken;
        assert.deepEqual(input, { adminUserId: 5, now: NOW });
        return tracking;
      },
      createStudyTrackingNotification: async () => {
        calls.push("notification");
      },
      writeAuditLog: async () => {
        calls.push("audit");
      },
    }),
  );

  await service.uploadAdminReport(uploadInput({ particularTokenId: 7 }));

  assert.deepEqual(calls, [
    "clinic",
    "token-get",
    "storage",
    "create",
    "tracking-token",
    "tracking-report",
    "token-update",
    "tracking-ensure",
    "notification",
    "audit",
  ]);
  assert.deepEqual(tokenForTracking, {
    ...token,
    reportId: 88,
    updatedAt: NOW,
  });
  assert.equal(tokenForTracking?.createdByClinicUserId, 19);
});

test("notification report_delivered fallida es best-effort y audit precede resultado", async () => {
  const calls: string[] = [];
  const service = createReportRouteService(
    dependencies({
      getStudyTrackingCaseByReportId: async () => ({
        ...tracking,
        currentStage: "processing",
      }),
      updateStudyTrackingCase: async () => tracking,
      createStudyTrackingNotification: async () => {
        calls.push("notification");
        throw new Error("notification_failure");
      },
      logReportDeliveredNotificationFailure: (input) => {
        calls.push("log");
        assert.deepEqual(input, {
          reportId: 88,
          clinicId: 3,
          trackingCaseId: 11,
          errorName: "notification_failure",
        });
      },
      writeAuditLog: async () => {
        calls.push("audit");
      },
    }),
  );

  const result = await service.uploadAdminReport(uploadInput());
  calls.push("result");

  assert.equal(result.type, "uploaded");
  assert.deepEqual(calls, ["notification", "log", "audit", "result"]);
});

test("upload propaga fallos de storage, persistencia y audit", async (context) => {
  for (const target of ["storage", "db", "audit"] as const) {
    await context.test(target, async () => {
      const failure = new Error(`${target}_failure`);
      const service = createReportRouteService(
        dependencies({
          uploadReport: async () => {
            if (target === "storage") throw failure;
            return report.storagePath;
          },
          createOrEditReport: async () => {
            if (target === "db") throw failure;
            return report;
          },
          writeAuditLog: async () => {
            if (target === "audit") throw failure;
          },
        }),
      );

      await assert.rejects(
        service.uploadAdminReport(uploadInput()),
        (error) => error === failure,
      );
    });
  }
});

test("listado workflow delega limit y offset sin adaptar datos", async () => {
  const calls: unknown[] = [];
  const service = createReportRouteService(
    dependencies({
      listAdminReportWorkflowItems: async (input) => {
        calls.push(input);
        return [workflow];
      },
    }),
  );

  const result = await service.listAdminWorkflow({ limit: 21, offset: 40 });

  assert.equal(result[0], workflow);
  assert.deepEqual(calls, [{ limit: 21, offset: 40 }]);
});

test("stage devuelve not_found antes o después del update y audita success en orden", async () => {
  let updates = 0;
  const missing = createReportRouteService(
    dependencies({
      getAdminReportWorkflowItem: async () => null,
      updateAdminReportWorkflowStage: async () => {
        updates += 1;
        return workflow;
      },
    }),
  );
  assert.deepEqual(
    await missing.changeWorkflowStage({
      reportId: 88,
      stage: "delivered",
      now: NOW,
      auditContext: {},
    }),
    { type: "not_found" },
  );
  assert.equal(updates, 0);

  const concurrent = createReportRouteService(
    dependencies({
      updateAdminReportWorkflowStage: async () => null,
    }),
  );
  assert.deepEqual(
    await concurrent.changeWorkflowStage({
      reportId: 88,
      stage: "delivered",
      now: NOW,
      auditContext: {},
    }),
    { type: "not_found" },
  );

  const calls: string[] = [];
  const auditInputs: unknown[] = [];
  const updated = { ...workflow, workflowStage: "delivered" };
  const success = createReportRouteService(
    dependencies({
      getAdminReportWorkflowItem: async () => {
        calls.push("read");
        return workflow;
      },
      updateAdminReportWorkflowStage: async () => {
        calls.push("update");
        return updated;
      },
      writeAuditLog: async (_context, input) => {
        calls.push("audit");
        auditInputs.push(input);
      },
    }),
  );
  const result = await success.changeWorkflowStage({
    reportId: 88,
    stage: "delivered",
    now: NOW,
    auditContext: {},
  });
  calls.push("result");

  assert.deepEqual(result, { type: "updated", report: updated });
  assert.deepEqual(calls, ["read", "update", "audit", "result"]);
  assert.deepEqual(auditInputs[0], {
    event: "report.workflow_stage.changed",
    clinicId: 3,
    reportId: 88,
    metadata: {
      previousStage: "processing",
      nextStage: "delivered",
      workflowUpdatedAt: NOW.toISOString(),
    },
  });
});

test("special stain preserva update, audit y metadata exacta", async () => {
  const auditInputs: unknown[] = [];
  const updated = {
    ...workflow,
    specialStainRequested: true,
    specialStainAt: NOW.toISOString(),
  };
  const service = createReportRouteService(
    dependencies({
      updateAdminReportSpecialStain: async () => updated,
      writeAuditLog: async (_context, input) => {
        auditInputs.push(input);
      },
    }),
  );

  assert.deepEqual(
    await service.changeSpecialStain({
      reportId: 88,
      requested: true,
      now: NOW,
      auditContext: {},
    }),
    { type: "updated", report: updated },
  );
  assert.deepEqual(auditInputs[0], {
    event: "report.special_stain.changed",
    clinicId: 3,
    reportId: 88,
    metadata: {
      previousRequested: false,
      requested: true,
      specialStainAt: NOW.toISOString(),
    },
  });
});
