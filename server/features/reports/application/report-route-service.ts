type VerifiedDocumentMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

function reportStoragePathMatchesClinic(storagePath: string, clinicId: number): boolean {
  if (!Number.isSafeInteger(clinicId) || clinicId < 1) return false;
  const segments = storagePath.split("/");
  return segments.length >= 3 && (segments[0] === "clinics" || segments[0] === "reports") && segments[1] === String(clinicId) && segments.slice(2).every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function verifiedSignedUrlOrigin(signedUrl: string, configuredStorageUrl: string): string | null {
  try {
    const configured = new URL(configuredStorageUrl);
    const signed = new URL(signedUrl);
    if (configured.protocol !== "https:" || configured.username || configured.password || configured.search || configured.hash) return null;
    if (signed.protocol !== "https:" || signed.username || signed.password || signed.origin !== configured.origin) return null;
    return configured.origin;
  } catch { return null; }
}

export type ReportRouteRecord = {
  id: number;
  clinicId: number;
  storagePath: string;
  fileName?: string | null;
};

export type ParticularTokenRouteRecord = {
  id: number;
  clinicId: number;
  reportId?: number | null;
  createdByClinicUserId?: number | null;
  updatedAt?: Date | null;
};

export type StudyTrackingRouteRecord = {
  id: number;
  currentStage: string;
  particularTokenId: number | null;
  deliveredAt?: Date | null;
};

export type WorkflowRouteRecord = {
  id: number;
  clinicId: number;
  workflowStage: string;
  workflowUpdatedAt: string | null;
  specialStainRequested: boolean;
  specialStainAt: string | null;
};

export type ReportRouteAuditInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    adminUserId?: number | null;
  };
};

export type ReportRouteFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

export type ReportUploadRouteInput = {
  clinicId: number;
  particularTokenId?: number;
  file?: ReportRouteFile;
  patientName: unknown;
  studyType: unknown;
  uploadDate: unknown;
  adminUserId: number;
  auditContext: unknown;
  now: Date;
  /** Request ID de la peticion HTTP, solo para correlacionar los logs de compensacion. */
  requestId?: string;
};

export type ReportUploadRouteResult<TReport extends ReportRouteRecord> =
  | { type: "clinic_not_found" }
  | { type: "file_missing" }
  | { type: "token_not_found" }
  | { type: "token_clinic_mismatch" }
  | { type: "uploaded"; report: TReport };

export type SignedPreviewRouteResult =
  | { type: "not_found" }
  | { type: "signed"; previewUrl: string };

export type VerifiedPreviewRouteResult =
  | { type: "not_found" }
  | { type: "unverifiable" }
  | { type: "signed"; previewUrl: string; mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; trustedOrigin: string };

export type VerifiedDownloadRouteResult =
  | { type: "not_found" }
  | { type: "unverifiable" }
  | { type: "signed"; downloadUrl: string; trustedOrigin: string };

export type SignedDownloadRouteResult =
  | { type: "not_found" }
  | { type: "signed"; downloadUrl: string };

export type WorkflowMutationRouteResult<
  TWorkflow extends WorkflowRouteRecord,
> =
  | { type: "not_found" }
  | { type: "updated"; report: TWorkflow };

export class ReportUploadPersistenceError extends Error {
  readonly code: "token_link_failed" | "tracking_write_failed";

  constructor(code: "token_link_failed" | "tracking_write_failed") {
    super(`report upload persistence failed: ${code}`);
    this.name = "ReportUploadPersistenceError";
    this.code = code;
  }
}

/** El COMMIT fallo despues de completar el trabajo: el resultado es ambiguo. */
export class ReportPersistenceCommitUnknownError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("report persistence commit outcome unknown", options);
    this.name = "ReportPersistenceCommitUnknownError";
  }
}

export type ReportUploadPersistenceScope<
  TReport extends ReportRouteRecord,
  TToken extends ParticularTokenRouteRecord,
  TTracking extends StudyTrackingRouteRecord,
> = {
  /**
   * Bloquea la fila del token hasta el fin de la transaccion y devuelve su
   * estado confirmado. Es la primera operacion de la unidad cuando la subida
   * lleva token: serializa las subidas concurrentes del mismo token.
   */
  lockParticularToken: (tokenId: number) => Promise<TToken | null | undefined>;
  createOrEditReport: (input: {
    clinicId: number;
    patientName: string | null;
    studyType: string | null;
    uploadDate: Date | null;
    fileName: string;
    storagePath: string;
    createdByAdminUserId: number;
  }) => Promise<TReport>;
  updateParticularTokenReport: (
    tokenId: number,
    reportId: number | null,
  ) => Promise<TToken | null | undefined>;
  getParticularStudyTrackingCase: (
    particularTokenId: number,
  ) => Promise<TTracking | null | undefined>;
  getStudyTrackingCaseByReportId: (
    reportId: number,
  ) => Promise<TTracking | null | undefined>;
  updateStudyTrackingCase: (
    id: number,
    input: {
      reportId: number;
      currentStage: "delivered";
      deliveredAt: Date;
    },
  ) => Promise<TTracking | null | undefined>;
  ensureStudyTrackingCaseForToken: (
    token: TToken,
    input: {
      adminUserId: number;
      now: Date;
    },
  ) => Promise<TTracking>;
  /**
   * Efecto de negocio dentro de la MISMA transaccion que el informe: se confirma
   * o se revierte con el, de modo que un commit ambiguo o una caida posterior no
   * puede dejar un informe sin su notificacion. Es best-effort por savepoint: un
   * fallo se devuelve (sin abortar la transaccion) para que el servicio lo registre.
   */
  createReportDeliveredNotification: (input: {
    studyTrackingCaseId: number;
    clinicId: number;
    reportId: number | null;
    particularTokenId: number | null;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    readAt: Date | null;
  }) => Promise<{ created: true } | { created: false; error: unknown }>;
  /**
   * Auditoria de la subida dentro de la misma transaccion. Falla cerrado: si no
   * puede escribirse, se revierte todo y se compensa el objeto, en vez de perder
   * el registro de auditoria de un informe que si quedaria persistido.
   */
  writeReportUploadedAudit: (
    auditContext: unknown,
    input: ReportRouteAuditInput,
  ) => Promise<void>;
};

export type ReportStorageCompensationOutcome =
  | "deleted"
  | "delete_failed"
  | "preserved_referenced"
  | "preserved_verification_failed"
  | "preserved_commit_unknown"
  | "commit_confirmed"
  | "preserved_unsafe_path";

export type ReportStorageCompensationLog = {
  outcome: ReportStorageCompensationOutcome;
  clinicId: number;
  storagePath: string;
  persistErrorName: string;
  errorName?: string;
  verification?: "persisted" | "not_persisted" | "unverifiable";
  /** Request ID de la peticion HTTP original; el adaptador lo valida antes de emitirlo. */
  requestId?: string;
};

function isExactReportObjectPath(storagePath: string, clinicId: number) {
  const segments = storagePath.split("/");
  return (
    Number.isSafeInteger(clinicId) &&
    clinicId >= 1 &&
    segments.length === 3 &&
    segments[0] === "clinics" &&
    segments[1] === String(clinicId) &&
    segments[2].length > 0 &&
    segments[2] !== "." &&
    segments[2] !== ".."
  );
}

export type ReportRouteServiceDependencies<
  TReport extends ReportRouteRecord,
  TToken extends ParticularTokenRouteRecord,
  TTracking extends StudyTrackingRouteRecord,
  TWorkflow extends WorkflowRouteRecord,
> = {
  getClinicById: (clinicId: number) => Promise<{ id: number } | null | undefined>;
  getReportById: (reportId: number) => Promise<TReport | null | undefined>;
  uploadReport: (input: {
    file: Buffer;
    fileName: string;
    clinicId: number;
    mimeType: string;
  }) => Promise<string>;
  getParticularTokenById: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
  runReportPersistence: <TResult>(
    work: (
      scope: ReportUploadPersistenceScope<TReport, TToken, TTracking>,
    ) => Promise<TResult>,
  ) => Promise<TResult>;
  deleteStorageObject: (storagePath: string) => Promise<void>;
  isReportStoragePathPersisted: (storagePath: string) => Promise<boolean>;
  findPersistedReportByStoragePath: (
    storagePath: string,
  ) => Promise<TReport | null | undefined>;
  logReportStorageCompensation: (input: ReportStorageCompensationLog) => void;
  createStudyTrackingNotification: (input: {
    studyTrackingCaseId: number;
    clinicId: number;
    reportId: number | null;
    particularTokenId: number | null;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    readAt: Date | null;
  }) => Promise<unknown>;
  createSignedReportUrl: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  normalizeSearchText: (value: unknown) => string | undefined;
  parseReportStudyType: (value: unknown) => string | null | undefined;
  parseOptionalDate: (value: unknown) => Date | undefined;
  listAdminReportWorkflowItems: (input: {
    limit: number;
    offset: number;
  }) => Promise<TWorkflow[]>;
  getAdminReportWorkflowItem: (
    id: number,
  ) => Promise<TWorkflow | null | undefined>;
  updateAdminReportWorkflowStage: (
    id: number,
    stage: TWorkflow["workflowStage"],
    now: Date,
  ) => Promise<TWorkflow | null | undefined>;
  updateAdminReportSpecialStain: (
    id: number,
    requested: boolean,
    now: Date,
  ) => Promise<TWorkflow | null | undefined>;
  writeAuditLog: (
    auditContext: unknown,
    input: ReportRouteAuditInput,
  ) => Promise<void>;
  auditEvents: {
    reportUploaded: string;
    workflowStageChanged: string;
    specialStainChanged: string;
  };
  resolveSafeErrorName: (error: unknown) => string;
  logReportDeliveredNotificationFailure: (input: {
    reportId: number;
    clinicId: number;
    trackingCaseId: number;
    errorName: string;
  }) => void;
};

function shouldCreateReportDeliveredNotification<
  TTracking extends StudyTrackingRouteRecord,
>(input: {
  previousTrackingCase: TTracking | null;
  trackingCase: TTracking | null;
}) {
  if (!input.trackingCase || input.trackingCase.currentStage !== "delivered") {
    return false;
  }

  return (
    !input.previousTrackingCase ||
    input.previousTrackingCase.currentStage !== "delivered"
  );
}

export function createReportRouteService<
  TReport extends ReportRouteRecord,
  TToken extends ParticularTokenRouteRecord,
  TTracking extends StudyTrackingRouteRecord,
  TWorkflow extends WorkflowRouteRecord,
>(
  dependencies: ReportRouteServiceDependencies<
    TReport,
    TToken,
    TTracking,
    TWorkflow
  >,
) {
  async function getSignedPreviewUrl(
    reportId: number,
  ): Promise<SignedPreviewRouteResult> {
    const report = await dependencies.getReportById(reportId);

    if (!report) {
      return { type: "not_found" };
    }

    return {
      type: "signed",
      previewUrl: await dependencies.createSignedReportUrl(report.storagePath),
    };
  }

  async function getVerifiedPreviewSource(
    reportId: number,
    inspectMime: (path: string) => Promise<VerifiedDocumentMime | null>,
    configuredStorageUrl: string,
  ): Promise<VerifiedPreviewRouteResult> {
    const report = await dependencies.getReportById(reportId);
    if (!report) return { type: "not_found" };
    if (!reportStoragePathMatchesClinic(report.storagePath, report.clinicId)) return { type: "unverifiable" };
    let mimeType;
    try { mimeType = await inspectMime(report.storagePath); } catch { return { type: "unverifiable" }; }
    if (!mimeType) return { type: "unverifiable" };
    let previewUrl;
    try { previewUrl = await dependencies.createSignedReportUrl(report.storagePath); } catch { return { type: "unverifiable" }; }
    const trustedOrigin = verifiedSignedUrlOrigin(previewUrl, configuredStorageUrl);
    if (!trustedOrigin) return { type: "unverifiable" };
    return { type: "signed", previewUrl, mimeType, trustedOrigin };
  }

  async function getSignedDownloadUrl(
    reportId: number,
  ): Promise<SignedDownloadRouteResult> {
    const report = await dependencies.getReportById(reportId);

    if (!report) {
      return { type: "not_found" };
    }

    return {
      type: "signed",
      downloadUrl: await dependencies.createSignedReportDownloadUrl(
        report.storagePath,
        report.fileName ?? undefined,
      ),
    };
  }

  async function getVerifiedDownloadSource(
    reportId: number,
    configuredStorageUrl: string,
  ): Promise<VerifiedDownloadRouteResult> {
    const report = await dependencies.getReportById(reportId);
    if (!report) return { type: "not_found" };
    if (!reportStoragePathMatchesClinic(report.storagePath, report.clinicId)) return { type: "unverifiable" };
    let downloadUrl;
    try {
      downloadUrl = await dependencies.createSignedReportDownloadUrl(report.storagePath, report.fileName ?? undefined);
    } catch { return { type: "unverifiable" }; }
    const trustedOrigin = verifiedSignedUrlOrigin(downloadUrl, configuredStorageUrl);
    if (!trustedOrigin) return { type: "unverifiable" };
    return { type: "signed", downloadUrl, trustedOrigin };
  }

  /**
   * Resuelve el destino del objeto recien subido cuando la persistencia no se
   * confirmo. Nunca lanza: el error funcional original es el que debe propagarse.
   * Devuelve el informe solo si un commit ambiguo resulta haberse aplicado (sus
   * efectos de negocio viajan en la misma transaccion, asi que ya existen).
   */
  async function compensateUnpersistedUpload(
    storagePath: string,
    clinicId: number,
    persistError: unknown,
    requestId?: string,
  ): Promise<TReport | null> {
    const persistErrorName = dependencies.resolveSafeErrorName(persistError);
    const log = (
      outcome: ReportStorageCompensationOutcome,
      extra: Partial<ReportStorageCompensationLog> = {},
    ) =>
      dependencies.logReportStorageCompensation({
        outcome,
        clinicId,
        storagePath,
        persistErrorName,
        ...(requestId === undefined ? {} : { requestId }),
        ...extra,
      });

    if (persistError instanceof ReportPersistenceCommitUnknownError) {
      let persistedReport: TReport | null | undefined;
      let verification: "persisted" | "not_persisted" | "unverifiable";
      try {
        persistedReport =
          await dependencies.findPersistedReportByStoragePath(storagePath);
        verification = persistedReport ? "persisted" : "not_persisted";
      } catch {
        verification = "unverifiable";
      }

      if (persistedReport && persistedReport.clinicId === clinicId) {
        log("commit_confirmed", { verification: "persisted" });
        return persistedReport;
      }

      log("preserved_commit_unknown", { verification });
      return null;
    }

    if (!isExactReportObjectPath(storagePath, clinicId)) {
      log("preserved_unsafe_path");
      return null;
    }

    try {
      if (await dependencies.isReportStoragePathPersisted(storagePath)) {
        log("preserved_referenced", { verification: "persisted" });
        return null;
      }
    } catch (error) {
      log("preserved_verification_failed", {
        verification: "unverifiable",
        errorName: dependencies.resolveSafeErrorName(error),
      });
      return null;
    }

    try {
      await dependencies.deleteStorageObject(storagePath);
      log("deleted", { verification: "not_persisted" });
    } catch (error) {
      log("delete_failed", {
        verification: "not_persisted",
        errorName: dependencies.resolveSafeErrorName(error),
      });
    }

    return null;
  }

  async function uploadAdminReport(
    input: ReportUploadRouteInput,
  ): Promise<ReportUploadRouteResult<TReport>> {
    const clinic = await dependencies.getClinicById(input.clinicId);

    if (!clinic) {
      return { type: "clinic_not_found" };
    }

    if (!input.file) {
      return { type: "file_missing" };
    }

    const selectedParticularToken =
      typeof input.particularTokenId === "number"
        ? await dependencies.getParticularTokenById(input.particularTokenId)
        : null;

    if (
      typeof input.particularTokenId === "number" &&
      !selectedParticularToken
    ) {
      return { type: "token_not_found" };
    }

    if (
      selectedParticularToken &&
      selectedParticularToken.clinicId !== input.clinicId
    ) {
      return { type: "token_clinic_mismatch" };
    }

    const patientName = dependencies.normalizeSearchText(input.patientName);
    const studyType = dependencies.parseReportStudyType(input.studyType);
    const uploadDate = dependencies.parseOptionalDate(input.uploadDate);
    const file = input.file;

    const storagePath = await dependencies.uploadReport({
      file: file.buffer,
      fileName: file.fileName,
      clinicId: input.clinicId,
      mimeType: file.mimeType,
    });

    let persisted: { report: TReport };

    try {
      persisted = await dependencies.runReportPersistence(async (scope) => {
        if (selectedParticularToken) {
          // Primera operacion: serializa por token y valida bajo el lock (la
          // lectura previa fue sin lock y pudo quedar vieja).
          const lockedToken = await scope.lockParticularToken(
            selectedParticularToken.id,
          );

          if (!lockedToken || lockedToken.clinicId !== input.clinicId) {
            throw new ReportUploadPersistenceError("token_link_failed");
          }
        }

        const createdReport = await scope.createOrEditReport({
          clinicId: input.clinicId,
          patientName: patientName ?? null,
          studyType: studyType ?? null,
          uploadDate: uploadDate ?? null,
          fileName: file.fileName,
          storagePath,
          createdByAdminUserId: input.adminUserId,
        });

        let trackingCase: TTracking | null = null;
        let previousTrackingCase: TTracking | null = null;
        let linkedTokenId: number | null = null;

        if (selectedParticularToken) {
          previousTrackingCase =
            (await scope.getParticularStudyTrackingCase(
              selectedParticularToken.id,
            )) ??
            (await scope.getStudyTrackingCaseByReportId(createdReport.id)) ??
            null;

          const linkedToken = await scope.updateParticularTokenReport(
            selectedParticularToken.id,
            createdReport.id,
          );

          if (!linkedToken || linkedToken.clinicId !== input.clinicId) {
            throw new ReportUploadPersistenceError("token_link_failed");
          }

          trackingCase = await scope.ensureStudyTrackingCaseForToken(
            linkedToken,
            { adminUserId: input.adminUserId, now: input.now },
          );
          linkedTokenId = linkedToken.id;
        }

        if (!selectedParticularToken) {
          previousTrackingCase =
            (await scope.getStudyTrackingCaseByReportId(createdReport.id)) ??
            null;
          trackingCase = previousTrackingCase;

          if (trackingCase && trackingCase.currentStage !== "delivered") {
            const updated = await scope.updateStudyTrackingCase(
              trackingCase.id,
              {
                reportId: createdReport.id,
                currentStage: "delivered",
                deliveredAt: trackingCase.deliveredAt ?? input.now,
              },
            );

            if (!updated) {
              throw new ReportUploadPersistenceError("tracking_write_failed");
            }

            trackingCase = updated;
          }

          linkedTokenId = trackingCase?.particularTokenId ?? null;
        }

        if (
          shouldCreateReportDeliveredNotification({
            previousTrackingCase,
            trackingCase,
          }) &&
          trackingCase
        ) {
          const notification = await scope.createReportDeliveredNotification({
            studyTrackingCaseId: trackingCase.id,
            clinicId: createdReport.clinicId,
            reportId: createdReport.id,
            particularTokenId: trackingCase.particularTokenId,
            type: "report_delivered",
            title: "Informe disponible",
            message: "El informe del estudio ya está disponible.",
            isRead: false,
            readAt: null,
          });

          if (!notification.created) {
            dependencies.logReportDeliveredNotificationFailure({
              reportId: createdReport.id,
              clinicId: createdReport.clinicId,
              trackingCaseId: trackingCase.id,
              errorName: dependencies.resolveSafeErrorName(notification.error),
            });
          }
        }

        await scope.writeReportUploadedAudit(input.auditContext, {
          event: dependencies.auditEvents.reportUploaded,
          clinicId: createdReport.clinicId,
          reportId: createdReport.id,
          metadata: {
            fileName: file.fileName,
            mimeType: file.mimeType,
            studyType: studyType ?? null,
            uploadDate: uploadDate ?? null,
            uploadedVia: "admin",
            particularTokenId: linkedTokenId,
            trackingCaseId: trackingCase?.id ?? null,
            trackingStage: trackingCase?.currentStage ?? null,
          },
        });

        return { report: createdReport };
      });
    } catch (error) {
      const confirmed = await compensateUnpersistedUpload(
        storagePath,
        input.clinicId,
        error,
        input.requestId,
      );

      if (confirmed) {
        return { type: "uploaded", report: confirmed };
      }

      throw error;
    }

    return { type: "uploaded", report: persisted.report };
  }

  function listAdminWorkflow(input: { limit: number; offset: number }) {
    return dependencies.listAdminReportWorkflowItems(input);
  }

  /** One workflow item, in the same shape as a list item. */
  async function getAdminWorkflowItem(
    reportId: number,
  ): Promise<{ type: "not_found" } | { type: "found"; report: TWorkflow }> {
    const report = await dependencies.getAdminReportWorkflowItem(reportId);
    return report ? { type: "found", report } : { type: "not_found" };
  }

  async function changeWorkflowStage(input: {
    reportId: number;
    stage: TWorkflow["workflowStage"];
    now: Date;
    auditContext: unknown;
  }): Promise<WorkflowMutationRouteResult<TWorkflow>> {
    const current =
      await dependencies.getAdminReportWorkflowItem(input.reportId);

    if (!current) {
      return { type: "not_found" };
    }

    const updated = await dependencies.updateAdminReportWorkflowStage(
      input.reportId,
      input.stage,
      input.now,
    );

    if (!updated) {
      return { type: "not_found" };
    }

    await dependencies.writeAuditLog(input.auditContext, {
      event: dependencies.auditEvents.workflowStageChanged,
      clinicId: updated.clinicId,
      reportId: updated.id,
      metadata: {
        previousStage: current.workflowStage,
        nextStage: updated.workflowStage,
        workflowUpdatedAt: updated.workflowUpdatedAt,
      },
    });

    return { type: "updated", report: updated };
  }

  async function changeSpecialStain(input: {
    reportId: number;
    requested: boolean;
    now: Date;
    auditContext: unknown;
  }): Promise<WorkflowMutationRouteResult<TWorkflow>> {
    const current =
      await dependencies.getAdminReportWorkflowItem(input.reportId);

    if (!current) {
      return { type: "not_found" };
    }

    const updated = await dependencies.updateAdminReportSpecialStain(
      input.reportId,
      input.requested,
      input.now,
    );

    if (!updated) {
      return { type: "not_found" };
    }

    await dependencies.writeAuditLog(input.auditContext, {
      event: dependencies.auditEvents.specialStainChanged,
      clinicId: updated.clinicId,
      reportId: updated.id,
      metadata: {
        previousRequested: current.specialStainRequested,
        requested: updated.specialStainRequested,
        specialStainAt: updated.specialStainAt,
      },
    });

    return { type: "updated", report: updated };
  }

  return {
    getSignedPreviewUrl,
    getVerifiedPreviewSource,
    getSignedDownloadUrl,
    getVerifiedDownloadSource,
    uploadAdminReport,
    listAdminWorkflow,
    getAdminWorkflowItem,
    changeWorkflowStage,
    changeSpecialStain,
  };
}
