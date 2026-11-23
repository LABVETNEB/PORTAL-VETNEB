import assert from "node:assert/strict";
import test from "node:test";

import {
  createReportRouteService,
  ReportPersistenceCommitUnknownError,
  ReportUploadPersistenceError,
  type ReportRouteServiceDependencies,
  type ReportStorageCompensationLog,
  type ReportUploadPersistenceScope,
  type ReportUploadRouteInput,
} from "../../../../server/features/reports/application/index.ts";
import { resolveReportSafeErrorName } from "../../../../server/features/reports/composition/report-route-composition.ts";

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

type Scope = ReportUploadPersistenceScope<
  FixtureReport,
  FixtureToken,
  FixtureTracking
>;
type Overrides = Partial<Dependencies> & Partial<Scope>;

const SCOPE_KEYS: readonly string[] = [
  "createOrEditReport",
  "updateParticularTokenReport",
  "getParticularStudyTrackingCase",
  "getStudyTrackingCaseByReportId",
  "updateStudyTrackingCase",
  "ensureStudyTrackingCaseForToken",
];

function defaultScope(): Scope {
  return {
    createOrEditReport: async () => report,
    updateParticularTokenReport: async () => token,
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    updateStudyTrackingCase: async () => tracking,
    ensureStudyTrackingCaseForToken: async () => tracking,
  };
}

function splitOverrides(allOverrides: Overrides) {
  const scopeOverrides: Partial<Scope> = {};
  const overrides: Partial<Dependencies> = {};

  for (const [key, value] of Object.entries(allOverrides)) {
    const isScopeKey = SCOPE_KEYS.includes(key);
    if (isScopeKey) Object.assign(scopeOverrides, { [key]: value });
    if (!isScopeKey) Object.assign(overrides, { [key]: value });
  }

  return { scopeOverrides, overrides };
}

/**
 * Runner de ORQUESTACION: ejecuta el callback una sola vez sobre el scope.
 * No es transaccional y no revierte nada: atomicidad y rollback no se prueban
 * con este runner (simulacion con rollback y PostgreSQL real, en otros tests).
 */
function orchestrationRunner(scope: Scope): Dependencies["runReportPersistence"] {
  return async (work) => work(scope);
}

function dependencies(
  allOverrides: Overrides = {},
): Dependencies {
  const { scopeOverrides, overrides } = splitOverrides(allOverrides);
  const scope: Scope = { ...defaultScope(), ...scopeOverrides };

  return {
    getClinicById: async (clinicId) => ({ id: clinicId }),
    getReportById: async () => report,
    uploadReport: async () => report.storagePath,
    getParticularTokenById: async () => token,
    runReportPersistence: orchestrationRunner(scope),
    deleteStorageObject: async () => undefined,
    isReportStoragePathPersisted: async () => false,
    logReportStorageCompensation: () => undefined,
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
    resolveSafeErrorName: () => "Error",
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
    "normalize",
    "storage",
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

test("upload con token usa el token confirmado por la persistencia, conserva identidad y orden", async () => {
  const calls: string[] = [];
  const linked: FixtureToken = { ...token, reportId: 88, updatedAt: NOW };
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
      updateParticularTokenReport: async (tokenId, reportId) => {
        calls.push("token-update");
        assert.deepEqual({ tokenId, reportId }, { tokenId: 7, reportId: 88 });
        return linked;
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

  const result = await service.uploadAdminReport(
    uploadInput({ particularTokenId: 7 }),
  );

  assert.equal(result.type, "uploaded");
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
  assert.equal(tokenForTracking, linked);
  assert.equal(tokenForTracking?.createdByClinicUserId, 19);
});

const SAFE_STORAGE_PATH = "clinics/3/1790000000000-0123456789ab-informe.pdf";

type CompensationProbe = {
  calls: string[];
  deleted: string[];
  verified: string[];
  logs: ReportStorageCompensationLog[];
};

function newCompensationProbe(): CompensationProbe {
  return { calls: [], deleted: [], verified: [], logs: [] };
}

function compensationService(
  probe: CompensationProbe,
  overrides: Overrides = {},
  hooks: Partial<{
    storagePath: string;
    persisted: () => Promise<boolean>;
    remove: () => Promise<void>;
  }> = {},
) {
  const resolved = {
    storagePath: SAFE_STORAGE_PATH,
    persisted: async () => false,
    remove: async () => undefined,
    ...hooks,
  };

  return createReportRouteService(
    dependencies({
      uploadReport: async () => {
        probe.calls.push("storage");
        return resolved.storagePath;
      },
      deleteStorageObject: async (storagePath) => {
        probe.calls.push("delete");
        probe.deleted.push(storagePath);
        await resolved.remove();
      },
      isReportStoragePathPersisted: async (storagePath) => {
        probe.calls.push("verify");
        probe.verified.push(storagePath);
        return resolved.persisted();
      },
      logReportStorageCompensation: (input) => {
        probe.calls.push("log");
        probe.logs.push(input);
      },
      createStudyTrackingNotification: async () => {
        probe.calls.push("notification");
      },
      writeAuditLog: async () => {
        probe.calls.push("audit");
      },
      ...overrides,
    }),
  );
}

test("orquestación: asociación de token no confirmada falla cerrado, compensa y no simula éxito", async (context) => {
  const outcomes: Array<{ label: string; linked: FixtureToken | null }> = [
    { label: "update devuelve null", linked: null },
    {
      label: "update devuelve token de otra clínica",
      linked: { ...token, clinicId: 99, reportId: 88 },
    },
  ];

  for (const outcome of outcomes) {
    await context.test(outcome.label, async () => {
      const probe = newCompensationProbe();
      const service = compensationService(probe, {
        updateParticularTokenReport: async () => {
          probe.calls.push("token-update");
          return outcome.linked;
        },
        ensureStudyTrackingCaseForToken: async () => {
          probe.calls.push("tracking-ensure");
          return tracking;
        },
      });

      await assert.rejects(
        service.uploadAdminReport(uploadInput({ particularTokenId: 7 })),
        (error) =>
          error instanceof ReportUploadPersistenceError &&
          error.code === "token_link_failed",
      );
      assert.deepEqual(probe.calls, [
        "storage",
        "token-update",
        "verify",
        "delete",
        "log",
      ]);
      assert.deepEqual(probe.deleted, [SAFE_STORAGE_PATH]);
    });
  }
});

test("orquestación: update de tracking sin fila afectada falla cerrado y no notifica ni audita", async () => {
  const probe = newCompensationProbe();
  const pending = { ...tracking, currentStage: "processing", deliveredAt: null };
  const service = compensationService(probe, {
    getStudyTrackingCaseByReportId: async () => pending,
    updateStudyTrackingCase: async () => {
      probe.calls.push("tracking-update");
      return null;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) =>
      error instanceof ReportUploadPersistenceError &&
      error.code === "tracking_write_failed",
  );
  assert.deepEqual(probe.calls, [
    "storage",
    "tracking-update",
    "verify",
    "delete",
    "log",
  ]);
});

test("orquestación: fallo al asegurar tracking del token propaga el error original y compensa", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("tracking_create_failure");
  const service = compensationService(probe, {
    ensureStudyTrackingCaseForToken: async () => {
      probe.calls.push("tracking-ensure");
      throw failure;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput({ particularTokenId: 7 })),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, [
    "storage",
    "tracking-ensure",
    "verify",
    "delete",
    "log",
  ]);
  assert.deepEqual(probe.deleted, [SAFE_STORAGE_PATH]);
});

test("orquestación: persistencia fallida sin referencia elimina sólo el objeto nuevo y propaga el error original", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("persist_failure");
  const service = compensationService(probe, {
    createOrEditReport: async () => {
      throw failure;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, ["storage", "verify", "delete", "log"]);
  assert.deepEqual(probe.verified, [SAFE_STORAGE_PATH]);
  assert.deepEqual(probe.deleted, [SAFE_STORAGE_PATH]);
  assert.deepEqual(probe.logs, [
    {
      outcome: "deleted",
      clinicId: 3,
      storagePath: SAFE_STORAGE_PATH,
      persistErrorName: "Error",
      verification: "not_persisted",
    },
  ]);
});

test("orquestación: objeto con referencia persistida nunca se elimina", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("persist_failure");
  const service = compensationService(
    probe,
    {
      createOrEditReport: async () => {
        throw failure;
      },
    },
    { persisted: async () => true },
  );

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, ["storage", "verify", "log"]);
  assert.deepEqual(probe.deleted, []);
  assert.deepEqual(probe.logs, [
    {
      outcome: "preserved_referenced",
      clinicId: 3,
      storagePath: SAFE_STORAGE_PATH,
      persistErrorName: "Error",
      verification: "persisted",
    },
  ]);
});

test("orquestación: verificación imposible preserva el objeto y propaga el error original", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("persist_failure");
  const service = compensationService(
    probe,
    {
      createOrEditReport: async () => {
        throw failure;
      },
    },
    {
      persisted: async () => {
        throw new Error("verify_failure");
      },
    },
  );

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, ["storage", "verify", "log"]);
  assert.deepEqual(probe.deleted, []);
  assert.deepEqual(probe.logs, [
    {
      outcome: "preserved_verification_failed",
      clinicId: 3,
      storagePath: SAFE_STORAGE_PATH,
      persistErrorName: "Error",
      errorName: "Error",
      verification: "unverifiable",
    },
  ]);
});

test("orquestación: fallo de compensación se registra y no reemplaza el error original", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("persist_failure");
  const service = compensationService(
    probe,
    {
      createOrEditReport: async () => {
        throw failure;
      },
    },
    {
      remove: async () => {
        throw new Error("delete_failure");
      },
    },
  );

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, ["storage", "verify", "delete", "log"]);
  assert.deepEqual(probe.logs, [
    {
      outcome: "delete_failed",
      clinicId: 3,
      storagePath: SAFE_STORAGE_PATH,
      persistErrorName: "Error",
      errorName: "Error",
      verification: "not_persisted",
    },
  ]);
});

test("orquestación: commit ambiguo nunca elimina el objeto y sólo verifica y registra", async (context) => {
  const cases: Array<{
    label: string;
    verify: () => Promise<boolean>;
    expected: "persisted" | "not_persisted" | "unverifiable";
  }> = [
    { label: "objeto referenciado", verify: async () => true, expected: "persisted" },
    { label: "objeto no referenciado", verify: async () => false, expected: "not_persisted" },
    {
      label: "verificación imposible",
      verify: async () => {
        throw new Error("verify_failure");
      },
      expected: "unverifiable",
    },
  ];

  for (const scenario of cases) {
    await context.test(scenario.label, async () => {
      const probe = newCompensationProbe();
      const ambiguous = new ReportPersistenceCommitUnknownError({
        cause: new Error("commit_failure"),
      });
      const service = compensationService(
        probe,
        {
          runReportPersistence: async () => {
            throw ambiguous;
          },
        },
        { persisted: scenario.verify },
      );

      await assert.rejects(
        service.uploadAdminReport(uploadInput()),
        (error) => error === ambiguous,
      );
      assert.deepEqual(probe.deleted, []);
      assert.deepEqual(probe.calls, ["storage", "verify", "log"]);
      assert.deepEqual(probe.logs, [
        {
          outcome: "preserved_commit_unknown",
          clinicId: 3,
          storagePath: SAFE_STORAGE_PATH,
          persistErrorName: "Error",
          verification: scenario.expected,
        },
      ]);
    });
  }
});

test("orquestación: paths que no son exactamente clinics/<clínica>/<objeto> nunca se verifican ni eliminan", async (context) => {
  const unsafePaths = [
    "reports/3/informe.pdf",
    "clinics/4/1790000000000-0123456789ab-informe.pdf",
    "clinics/3/nested/1790000000000-0123456789ab-informe.pdf",
    "clinics/3/..",
  ];

  for (const unsafePath of unsafePaths) {
    await context.test(unsafePath, async () => {
      const probe = newCompensationProbe();
      const failure = new Error("persist_failure");
      const service = compensationService(
        probe,
        {
          createOrEditReport: async () => {
            throw failure;
          },
        },
        { storagePath: unsafePath },
      );

      await assert.rejects(
        service.uploadAdminReport(uploadInput()),
        (error) => error === failure,
      );
      assert.deepEqual(probe.calls, ["storage", "log"]);
      assert.deepEqual(probe.verified, []);
      assert.deepEqual(probe.deleted, []);
      assert.deepEqual(probe.logs, [
        {
          outcome: "preserved_unsafe_path",
          clinicId: 3,
          storagePath: unsafePath,
          persistErrorName: "Error",
        },
      ]);
    });
  }
});

test("orquestación: persistencia confirmada no dispara compensación y audita después", async () => {
  const probe = newCompensationProbe();
  const service = compensationService(probe);

  const result = await service.uploadAdminReport(uploadInput());

  assert.equal(result.type, "uploaded");
  assert.deepEqual(probe.calls, ["storage", "audit"]);
  assert.deepEqual(probe.deleted, []);
  assert.deepEqual(probe.verified, []);
  assert.deepEqual(probe.logs, []);
});

test("orquestación: fallo de auditoría posterior a persistencia confirmada no elimina el objeto", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("audit_failure");
  const service = compensationService(probe, {
    writeAuditLog: async () => {
      probe.calls.push("audit");
      throw failure;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, ["storage", "audit"]);
  assert.deepEqual(probe.deleted, []);
  assert.deepEqual(probe.verified, []);
});

test("orquestación: fallo de Storage no ejecuta persistencia, compensación ni auditoría", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("storage_failure");
  const service = compensationService(probe, {
    uploadReport: async () => {
      probe.calls.push("storage");
      throw failure;
    },
    runReportPersistence: async () => {
      probe.calls.push("persist");
      throw new Error("no debe ejecutarse");
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, ["storage"]);
});

test("orquestación: parseo inválido falla antes de subir a Storage", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("parse_failure");
  const service = compensationService(probe, {
    parseOptionalDate: () => {
      throw failure;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.deepEqual(probe.calls, []);
});

test("orquestación: no reintenta la subida ni la persistencia ante un fallo", async () => {
  const probe = newCompensationProbe();
  const failure = new Error("persist_failure");
  let attempts = 0;
  const service = compensationService(probe, {
    runReportPersistence: async () => {
      attempts += 1;
      throw failure;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === failure,
  );
  assert.equal(attempts, 1);
  assert.deepEqual(probe.calls, ["storage", "verify", "delete", "log"]);
});

test("orquestación: el evento interno de compensación no lleva mensajes ni nombres de error arbitrarios", async () => {
  const probe = newCompensationProbe();
  const thrown = Object.assign(new Error("PII: Luna, historia clínica 123"), {
    name: "LunaPacienteError",
  });
  const service = compensationService(probe, {
    resolveSafeErrorName: resolveReportSafeErrorName,
    createOrEditReport: async () => {
      throw thrown;
    },
  });

  await assert.rejects(
    service.uploadAdminReport(uploadInput()),
    (error) => error === thrown,
  );
  assert.deepEqual(probe.logs, [
    {
      outcome: "deleted",
      clinicId: 3,
      storagePath: SAFE_STORAGE_PATH,
      persistErrorName: "Error",
      verification: "not_persisted",
    },
  ]);
  const serialized = JSON.stringify(probe.logs).toLowerCase();
  for (const forbidden of ["luna", "pii", "historia", "paciente"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
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
      resolveSafeErrorName: () => "Error",
      logReportDeliveredNotificationFailure: (input) => {
        calls.push("log");
        assert.deepEqual(input, {
          reportId: 88,
          clinicId: 3,
          trackingCaseId: 11,
          errorName: "Error",
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

test("el logger de notificación sólo recibe el nombre resuelto, nunca el mensaje ni un nombre arbitrario", async () => {
  const thrown = Object.assign(new Error("PII: Luna, historia clínica 123"), {
    name: "LunaPacienteError",
  });
  const logged: unknown[] = [];
  const service = createReportRouteService(
    dependencies({
      getStudyTrackingCaseByReportId: async () => ({
        ...tracking,
        currentStage: "processing",
      }),
      updateStudyTrackingCase: async () => tracking,
      createStudyTrackingNotification: async () => {
        throw thrown;
      },
      resolveSafeErrorName: resolveReportSafeErrorName,
      logReportDeliveredNotificationFailure: (input) => {
        logged.push(input);
      },
    }),
  );

  const result = await service.uploadAdminReport(uploadInput());

  assert.equal(result.type, "uploaded");
  assert.deepEqual(logged, [
    { reportId: 88, clinicId: 3, trackingCaseId: 11, errorName: "Error" },
  ]);
  assert.equal(JSON.stringify(logged).includes("Luna"), false);
  assert.equal(JSON.stringify(logged).includes("PII"), false);
});

test("resolveReportSafeErrorName conserva sólo nombres de la allowlist del logger", () => {
  assert.equal(resolveReportSafeErrorName(new Error("PII sensible")), "Error");
  assert.equal(resolveReportSafeErrorName(new TypeError("PII")), "TypeError");
  assert.equal(
    resolveReportSafeErrorName(
      Object.assign(new Error("x"), { name: "PacienteLunaError" }),
    ),
    "Error",
  );
  for (const value of ["texto", 42, null, undefined, { message: "PII" }]) {
    assert.equal(resolveReportSafeErrorName(value), "unknown_error");
  }
});

test("upload con notificación fallida y valor no Error mantiene unknown_error y no bloquea", async () => {
  const logged: string[] = [];
  const service = createReportRouteService(
    dependencies({
      getStudyTrackingCaseByReportId: async () => ({
        ...tracking,
        currentStage: "processing",
      }),
      updateStudyTrackingCase: async () => tracking,
      createStudyTrackingNotification: async () => {
        throw "PII de paciente";
      },
      resolveSafeErrorName: resolveReportSafeErrorName,
      logReportDeliveredNotificationFailure: (input) => {
        logged.push(input.errorName);
      },
    }),
  );

  const result = await service.uploadAdminReport(uploadInput());

  assert.equal(result.type, "uploaded");
  assert.deepEqual(logged, ["unknown_error"]);
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
