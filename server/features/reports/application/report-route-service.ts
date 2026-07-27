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

export type SignedDownloadRouteResult =
  | { type: "not_found" }
  | { type: "signed"; downloadUrl: string };

export type WorkflowMutationRouteResult<
  TWorkflow extends WorkflowRouteRecord,
> =
  | { type: "not_found" }
  | { type: "updated"; report: TWorkflow };

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
  createOrEditReport: (input: {
    clinicId: number;
    patientName: string | null;
    studyType: string | null;
    uploadDate: Date | null;
    fileName: string;
    storagePath: string;
    createdByAdminUserId: number;
  }) => Promise<TReport>;
  getParticularTokenById: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
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

    const storagePath = await dependencies.uploadReport({
      file: input.file.buffer,
      fileName: input.file.fileName,
      clinicId: input.clinicId,
      mimeType: input.file.mimeType,
    });
    const patientName = dependencies.normalizeSearchText(input.patientName);
    const studyType = dependencies.parseReportStudyType(input.studyType);
    const uploadDate = dependencies.parseOptionalDate(input.uploadDate);

    const report = await dependencies.createOrEditReport({
      clinicId: input.clinicId,
      patientName: patientName ?? null,
      studyType: studyType ?? null,
      uploadDate: uploadDate ?? null,
      fileName: input.file.fileName,
      storagePath,
      createdByAdminUserId: input.adminUserId,
    });

    let trackingCase: TTracking | null = null;
    let previousTrackingCase: TTracking | null = null;
    let linkedTokenId: number | null = null;

    if (selectedParticularToken) {
      previousTrackingCase =
        (await dependencies.getParticularStudyTrackingCase(
          selectedParticularToken.id,
        )) ??
        (await dependencies.getStudyTrackingCaseByReportId(report.id)) ??
        null;

      const updatedToken = await dependencies.updateParticularTokenReport(
        selectedParticularToken.id,
        report.id,
      );
      const tokenForTracking = {
        ...selectedParticularToken,
        reportId: report.id,
        updatedAt: input.now,
      } as TToken;
      const linkedToken = updatedToken ?? tokenForTracking;

      linkedTokenId = linkedToken.id;
      trackingCase = await dependencies.ensureStudyTrackingCaseForToken(
        linkedToken,
        {
          adminUserId: input.adminUserId,
          now: input.now,
        },
      );
    } else {
      previousTrackingCase =
        (await dependencies.getStudyTrackingCaseByReportId(report.id)) ?? null;
      trackingCase = previousTrackingCase;

      if (
        trackingCase &&
        trackingCase.currentStage !== "delivered"
      ) {
        trackingCase =
          (await dependencies.updateStudyTrackingCase(trackingCase.id, {
            reportId: report.id,
            currentStage: "delivered",
            deliveredAt: trackingCase.deliveredAt ?? input.now,
          })) ?? trackingCase;
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
      try {
        await dependencies.createStudyTrackingNotification({
          studyTrackingCaseId: trackingCase.id,
          clinicId: report.clinicId,
          reportId: report.id,
          particularTokenId: trackingCase.particularTokenId,
          type: "report_delivered",
          title: "Informe disponible",
          message: "El informe del estudio ya está disponible.",
          isRead: false,
          readAt: null,
        });
      } catch (error) {
        dependencies.logReportDeliveredNotificationFailure({
          reportId: report.id,
          clinicId: report.clinicId,
          trackingCaseId: trackingCase.id,
          errorName: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    await dependencies.writeAuditLog(input.auditContext, {
      event: dependencies.auditEvents.reportUploaded,
      clinicId: report.clinicId,
      reportId: report.id,
      metadata: {
        fileName: input.file.fileName,
        mimeType: input.file.mimeType,
        patientName: patientName ?? null,
        studyType: studyType ?? null,
        uploadDate: uploadDate ?? null,
        uploadedVia: "admin",
        particularTokenId: linkedTokenId,
        trackingCaseId: trackingCase?.id ?? null,
        trackingStage: trackingCase?.currentStage ?? null,
      },
    });

    return { type: "uploaded", report };
  }

  function listAdminWorkflow(input: { limit: number; offset: number }) {
    return dependencies.listAdminReportWorkflowItems(input);
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
    getSignedDownloadUrl,
    uploadAdminReport,
    listAdminWorkflow,
    changeWorkflowStage,
    changeSpecialStain,
  };
}
