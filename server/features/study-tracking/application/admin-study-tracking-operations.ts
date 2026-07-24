import {
  applyEstimatedDeliveryRules,
  applyStageTimestampDefaults,
  shouldCreateSpecialStainNotification,
  type StudyTrackingStage,
} from "../domain/index.ts";
import type { AdminStudyTrackingReferenceRepository } from "./ports/admin-study-tracking-reference-repository.ts";
import type { StudyTrackingAuditPort } from "./ports/study-tracking-audit-port.ts";
import type { AdminStudyTrackingCommandRepository } from "./ports/study-tracking-command-repository.ts";
import type { StudyTrackingNotificationPort } from "./ports/study-tracking-notification-port.ts";
import type { AdminStudyTrackingQueryRepository } from "./ports/study-tracking-query-repository.ts";
import { createAdminStudyTrackingCommandUseCases } from "./study-tracking-command-use-cases.ts";
import { createAdminStudyTrackingQueryUseCases } from "./study-tracking-query-use-cases.ts";
import { createStudyTrackingSideEffectUseCases } from "./study-tracking-side-effect-use-cases.ts";

type AdminStudyTrackingCaseRecord = {
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

type AdminStudyTrackingNotificationRecord = {
  id: number;
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  type: string;
  title: string;
};

type AdminClinicReferenceRecord = {
  id: number;
  name: string;
  contactEmail?: string | null;
};

type AdminReportReferenceRecord = {
  clinicId: number;
};

type AdminParticularTokenReferenceRecord = {
  clinicId: number;
};

export type AdminStudyTrackingCaseListParams = {
  clinicId?: number;
  reportId?: number;
  particularTokenId?: number;
  limit: number;
  offset: number;
};

export type AdminStudyTrackingNotificationListParams = {
  clinicId?: number;
  unreadOnly: boolean;
  limit: number;
  offset: number;
};

export type CreateAdminStudyTrackingCaseData = {
  clinicId: number;
  reportId?: number;
  particularTokenId?: number;
  labReceivedAt: Date;
  estimatedDeliveryAt?: Date;
  currentStage: StudyTrackingStage;
  processingAt?: Date | null;
  evaluationAt?: Date | null;
  reportDevelopmentAt?: Date | null;
  deliveredAt?: Date | null;
  specialStainRequired: boolean;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
};

export type UpdateAdminStudyTrackingCaseData = {
  reportId?: number | null;
  particularTokenId?: number | null;
  labReceivedAt?: Date;
  estimatedDeliveryAt?: Date | null;
  currentStage?: StudyTrackingStage;
  processingAt?: Date | null;
  evaluationAt?: Date | null;
  reportDevelopmentAt?: Date | null;
  deliveredAt?: Date | null;
  specialStainRequired?: boolean;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
};

type CreateStudyTrackingCaseRecordInput = {
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  createdByAdminId: number | null;
  createdByClinicUserId: number | null;
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

type UpdateStudyTrackingCaseRecordInput = {
  reportId?: number | null;
  particularTokenId?: number | null;
  receptionAt?: Date;
  estimatedDeliveryAt?: Date;
  estimatedDeliveryAutoCalculatedAt?: Date;
  estimatedDeliveryWasManuallyAdjusted?: boolean;
  currentStage?: string;
  processingAt?: Date | null;
  evaluationAt?: Date | null;
  reportDevelopmentAt?: Date | null;
  deliveredAt?: Date | null;
  specialStainRequired?: boolean;
  specialStainNotifiedAt?: Date | null;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
};

type CreateStudyTrackingNotificationInput = {
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
};

type SpecialStainRequiredEmailInput = {
  to: Array<string | null | undefined>;
  clinicName: string;
  trackingCaseId: number;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  currentStage: string;
  paymentUrl: string | null;
  adminContactEmail: string | null;
  adminContactPhone: string | null;
  notes: string | null;
};

type AdminStudyTrackingAuditInput<TAuditEvent extends string> = {
  event: TAuditEvent;
  clinicId: number;
  reportId: number | null;
  metadata: Record<string, unknown>;
};

export type CreateAdminStudyTrackingCaseInput<TAuditRequest> = {
  actor: {
    adminId: number;
  };
  data: CreateAdminStudyTrackingCaseData;
  auditRequest: TAuditRequest;
};

export type CreateAdminStudyTrackingCaseResult<TCase> =
  | { status: "clinic_not_found" }
  | { status: "report_not_found" }
  | { status: "report_clinic_mismatch" }
  | { status: "particular_token_not_found" }
  | { status: "particular_token_clinic_mismatch" }
  | { status: "created"; trackingCase: TCase };

export type UpdateAdminStudyTrackingCaseInput<TCase, TAuditRequest> = {
  trackingCaseId: number;
  current: TCase;
  data: UpdateAdminStudyTrackingCaseData;
  auditRequest: TAuditRequest;
};

export type UpdateAdminStudyTrackingCaseResult<TCase> =
  | { status: "report_not_found" }
  | { status: "report_clinic_mismatch" }
  | { status: "particular_token_not_found" }
  | { status: "particular_token_clinic_mismatch" }
  | { status: "tracking_case_not_found" }
  | { status: "updated"; trackingCase: TCase };

function getStudyTrackingStageLabel(value: unknown): string {
  switch (value) {
    case "reception":
      return "Recepción";
    case "processing":
      return "Procesamiento";
    case "evaluation":
      return "Evaluación";
    case "report_development":
      return "Desarrollo de informe";
    case "delivered":
      return "Entregado";
    default:
      return String(value);
  }
}

export function createAdminStudyTrackingOperations<
  TCase extends AdminStudyTrackingCaseRecord,
  TNotification extends AdminStudyTrackingNotificationRecord,
  TClinic extends AdminClinicReferenceRecord,
  TReport extends AdminReportReferenceRecord,
  TParticularToken extends AdminParticularTokenReferenceRecord,
  TAuditRequest,
  TAuditEvent extends string,
>(deps: {
  queryRepository: AdminStudyTrackingQueryRepository<
    TCase,
    TNotification,
    AdminStudyTrackingCaseListParams,
    AdminStudyTrackingNotificationListParams
  >;
  commandRepository: AdminStudyTrackingCommandRepository<
    TCase,
    TNotification,
    CreateStudyTrackingCaseRecordInput,
    UpdateStudyTrackingCaseRecordInput,
    CreateStudyTrackingNotificationInput,
    { clinicId?: number },
    { updatedCount: number }
  >;
  referenceRepository: AdminStudyTrackingReferenceRepository<
    TClinic,
    TReport,
    TParticularToken
  >;
  notification: StudyTrackingNotificationPort<
    SpecialStainRequiredEmailInput,
    unknown
  >;
  audit: StudyTrackingAuditPort<
    TAuditRequest,
    AdminStudyTrackingAuditInput<TAuditEvent>
  >;
  auditEvents: {
    caseCreated: TAuditEvent;
    caseUpdated: TAuditEvent;
    notificationCreated: TAuditEvent;
  };
  createDate: () => Date;
}) {
  const queries = createAdminStudyTrackingQueryUseCases(
    deps.queryRepository,
  );
  const commands = createAdminStudyTrackingCommandUseCases(
    deps.commandRepository,
  );
  const sideEffects = createStudyTrackingSideEffectUseCases({
    notification: deps.notification,
    audit: deps.audit,
  });

  async function notifySpecialStainByEmail(trackingCase: TCase) {
    const clinic = await deps.referenceRepository.getClinicById(
      trackingCase.clinicId,
    );

    if (!clinic) {
      console.warn("[EMAIL] special_stain_required skipped: clinic not found", {
        trackingCaseId: trackingCase.id,
        clinicId: trackingCase.clinicId,
      });
      return;
    }

    try {
      await sideEffects.sendSpecialStainRequiredEmail({
        to: [clinic.contactEmail, trackingCase.adminContactEmail],
        clinicName: clinic.name,
        trackingCaseId: trackingCase.id,
        receptionAt: trackingCase.receptionAt,
        estimatedDeliveryAt: trackingCase.estimatedDeliveryAt,
        currentStage: trackingCase.currentStage,
        paymentUrl: trackingCase.paymentUrl,
        adminContactEmail: trackingCase.adminContactEmail,
        adminContactPhone: trackingCase.adminContactPhone,
        notes: trackingCase.notes,
      });
    } catch (error) {
      const errorCode =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : undefined;

      console.error("[EMAIL] special_stain_required failed", {
        trackingCaseId: trackingCase.id,
        clinicId: trackingCase.clinicId,
        errorName: error instanceof Error ? error.name : "unknown_error",
        errorCode:
          errorCode && errorCode.trim().length > 0 ? errorCode : undefined,
      });
    }
  }

  return {
    listAdminStudyTrackingNotifications: (
      input: AdminStudyTrackingNotificationListParams,
    ) => queries.listStudyTrackingNotifications(input),

    acknowledgeAdminStudyTrackingNotification: (notificationId: number) =>
      commands.markStudyTrackingNotificationRead(notificationId),

    acknowledgeAllAdminStudyTrackingNotifications: (input: {
      clinicId?: number;
    }) => commands.markAllStudyTrackingNotificationsRead(input),

    listAdminStudyTrackingCases: (
      input: AdminStudyTrackingCaseListParams,
    ) => queries.listStudyTrackingCases(input),

    resolveAdminStudyTrackingCase: (input: {
      trackingCaseId: number;
      clinicId?: number;
    }) =>
      typeof input.clinicId === "number"
        ? queries.getClinicScopedStudyTrackingCase(
            input.trackingCaseId,
            input.clinicId,
          )
        : queries.getStudyTrackingCaseById(input.trackingCaseId),

    async createAdminStudyTrackingCase(
      input: CreateAdminStudyTrackingCaseInput<TAuditRequest>,
    ): Promise<CreateAdminStudyTrackingCaseResult<TCase>> {
      const clinic = await deps.referenceRepository.getClinicById(
        input.data.clinicId,
      );

      if (!clinic) {
        return { status: "clinic_not_found" };
      }

      if (typeof input.data.reportId === "number") {
        const report = await deps.referenceRepository.getReportById(
          input.data.reportId,
        );

        if (!report) {
          return { status: "report_not_found" };
        }

        if (report.clinicId !== input.data.clinicId) {
          return { status: "report_clinic_mismatch" };
        }
      }

      if (typeof input.data.particularTokenId === "number") {
        const particularToken =
          await deps.referenceRepository.getParticularTokenById(
            input.data.particularTokenId,
          );

        if (!particularToken) {
          return { status: "particular_token_not_found" };
        }

        if (particularToken.clinicId !== input.data.clinicId) {
          return { status: "particular_token_clinic_mismatch" };
        }
      }

      const delivery = applyEstimatedDeliveryRules({
        labReceivedAt: input.data.labReceivedAt,
        manualEstimatedDeliveryAt: input.data.estimatedDeliveryAt,
      });

      const created = await commands.createStudyTrackingCase({
        clinicId: input.data.clinicId,
        reportId: input.data.reportId ?? null,
        particularTokenId: input.data.particularTokenId ?? null,
        createdByAdminId: input.actor.adminId,
        createdByClinicUserId: null,
        receptionAt: input.data.labReceivedAt,
        estimatedDeliveryAt: delivery.estimatedDeliveryAt,
        estimatedDeliveryAutoCalculatedAt:
          delivery.estimatedDeliveryAutoCalculatedAt,
        estimatedDeliveryWasManuallyAdjusted:
          delivery.estimatedDeliveryWasManuallyAdjusted,
        currentStage: input.data.currentStage,
        processingAt: input.data.processingAt ?? null,
        evaluationAt: input.data.evaluationAt ?? null,
        reportDevelopmentAt: input.data.reportDevelopmentAt ?? null,
        deliveredAt: input.data.deliveredAt ?? null,
        specialStainRequired: input.data.specialStainRequired,
        specialStainNotifiedAt: null,
        paymentUrl: input.data.paymentUrl ?? null,
        adminContactEmail: input.data.adminContactEmail ?? null,
        adminContactPhone: input.data.adminContactPhone ?? null,
        notes: input.data.notes ?? null,
      });

      if (
        typeof created.particularTokenId === "number" &&
        typeof created.reportId === "number"
      ) {
        await deps.referenceRepository.updateParticularTokenReport(
          created.particularTokenId,
          created.reportId,
        );
      }

      let finalCase = created;
      let studyTrackingNotification: TNotification | null = null;

      if (created.specialStainRequired) {
        const notifiedAt = deps.createDate();

        studyTrackingNotification =
          await commands.createStudyTrackingNotification({
            studyTrackingCaseId: created.id,
            clinicId: created.clinicId,
            reportId: created.reportId ?? null,
            particularTokenId: created.particularTokenId ?? null,
            type: "special_stain_required",
            title: "Se requiere tinción especial",
            message:
              "El estudio ingresó a evaluación y requiere tinción especial para continuar.",
            isRead: false,
            readAt: null,
          });

        finalCase =
          (await commands.updateStudyTrackingCase(created.id, {
            specialStainNotifiedAt: notifiedAt,
          })) ?? created;

        await notifySpecialStainByEmail(finalCase);
      }

      await sideEffects.writeAuditLog(input.auditRequest, {
        event: deps.auditEvents.caseCreated,
        clinicId: finalCase.clinicId,
        reportId: finalCase.reportId ?? null,
        metadata: {
          trackingCaseId: finalCase.id,
          particularTokenId: finalCase.particularTokenId ?? null,
          currentStage: finalCase.currentStage,
          specialStainRequired: finalCase.specialStainRequired,
          specialStainNotifiedAt: finalCase.specialStainNotifiedAt ?? null,
          estimatedDeliveryAt: finalCase.estimatedDeliveryAt,
          labReceivedAt: finalCase.receptionAt,
          estimatedDeliveryWasManuallyAdjusted:
            finalCase.estimatedDeliveryWasManuallyAdjusted,
          createdVia: "admin",
        },
      });

      if (studyTrackingNotification) {
        await sideEffects.writeAuditLog(input.auditRequest, {
          event: deps.auditEvents.notificationCreated,
          clinicId: studyTrackingNotification.clinicId,
          reportId: studyTrackingNotification.reportId ?? null,
          metadata: {
            trackingCaseId:
              studyTrackingNotification.studyTrackingCaseId,
            notificationId: studyTrackingNotification.id,
            particularTokenId:
              studyTrackingNotification.particularTokenId ?? null,
            type: studyTrackingNotification.type,
            title: studyTrackingNotification.title,
            createdVia: "admin",
          },
        });
      }

      return { status: "created", trackingCase: finalCase };
    },

    async updateAdminStudyTrackingCase(
      input: UpdateAdminStudyTrackingCaseInput<TCase, TAuditRequest>,
    ): Promise<UpdateAdminStudyTrackingCaseResult<TCase>> {
      if (typeof input.data.reportId === "number") {
        const report = await deps.referenceRepository.getReportById(
          input.data.reportId,
        );

        if (!report) {
          return { status: "report_not_found" };
        }

        if (report.clinicId !== input.current.clinicId) {
          return { status: "report_clinic_mismatch" };
        }
      }

      if (typeof input.data.particularTokenId === "number") {
        const particularToken =
          await deps.referenceRepository.getParticularTokenById(
            input.data.particularTokenId,
          );

        if (!particularToken) {
          return { status: "particular_token_not_found" };
        }

        if (particularToken.clinicId !== input.current.clinicId) {
          return { status: "particular_token_clinic_mismatch" };
        }
      }

      const nextLabReceivedAt =
        input.data.labReceivedAt ?? input.current.receptionAt;
      const deliveryRecalculationNeeded =
        input.data.labReceivedAt instanceof Date ||
        input.data.estimatedDeliveryAt instanceof Date;

      const delivery = deliveryRecalculationNeeded
        ? applyEstimatedDeliveryRules({
            labReceivedAt: nextLabReceivedAt,
            manualEstimatedDeliveryAt:
              input.data.estimatedDeliveryAt instanceof Date
                ? input.data.estimatedDeliveryAt
                : undefined,
          })
        : null;

      const stageDefaults = applyStageTimestampDefaults(input.current, {
        currentStage: input.data.currentStage,
        processingAt:
          typeof input.data.processingAt === "undefined"
            ? undefined
            : input.data.processingAt,
        evaluationAt:
          typeof input.data.evaluationAt === "undefined"
            ? undefined
            : input.data.evaluationAt,
        reportDevelopmentAt:
          typeof input.data.reportDevelopmentAt === "undefined"
            ? undefined
            : input.data.reportDevelopmentAt,
        deliveredAt:
          typeof input.data.deliveredAt === "undefined"
            ? undefined
            : input.data.deliveredAt,
      });
      const stageChanged =
        typeof input.data.currentStage !== "undefined" &&
        input.data.currentStage !== input.current.currentStage;

      const updated = await commands.updateStudyTrackingCase(
        input.trackingCaseId,
        {
          reportId:
            typeof input.data.reportId === "undefined"
              ? undefined
              : input.data.reportId,
          particularTokenId:
            typeof input.data.particularTokenId === "undefined"
              ? undefined
              : input.data.particularTokenId,
          receptionAt: input.data.labReceivedAt,
          estimatedDeliveryAt: delivery?.estimatedDeliveryAt,
          estimatedDeliveryAutoCalculatedAt:
            delivery?.estimatedDeliveryAutoCalculatedAt,
          estimatedDeliveryWasManuallyAdjusted:
            delivery?.estimatedDeliveryWasManuallyAdjusted,
          currentStage: input.data.currentStage,
          processingAt:
            typeof stageDefaults.processingAt === "undefined"
              ? undefined
              : stageDefaults.processingAt,
          evaluationAt:
            typeof stageDefaults.evaluationAt === "undefined"
              ? undefined
              : stageDefaults.evaluationAt,
          reportDevelopmentAt:
            typeof stageDefaults.reportDevelopmentAt === "undefined"
              ? undefined
              : stageDefaults.reportDevelopmentAt,
          deliveredAt:
            typeof stageDefaults.deliveredAt === "undefined"
              ? undefined
              : stageDefaults.deliveredAt,
          specialStainRequired: input.data.specialStainRequired,
          paymentUrl: input.data.paymentUrl,
          adminContactEmail: input.data.adminContactEmail,
          adminContactPhone: input.data.adminContactPhone,
          notes: input.data.notes,
        },
      );

      if (!updated) {
        return { status: "tracking_case_not_found" };
      }

      if (
        typeof updated.particularTokenId === "number" &&
        typeof updated.reportId === "number"
      ) {
        await deps.referenceRepository.updateParticularTokenReport(
          updated.particularTokenId,
          updated.reportId,
        );
      }

      let finalCase = updated;
      let updateNotification: TNotification | null = null;
      let specialStainResolvedNotification: TNotification | null = null;
      let stageChangeNotification: TNotification | null = null;

      if (
        shouldCreateSpecialStainNotification({
          previousRequired: input.current.specialStainRequired,
          nextRequired: updated.specialStainRequired,
          notifiedAt: updated.specialStainNotifiedAt,
        })
      ) {
        const notifiedAt = deps.createDate();

        updateNotification =
          await commands.createStudyTrackingNotification({
            studyTrackingCaseId: updated.id,
            clinicId: updated.clinicId,
            reportId: updated.reportId ?? null,
            particularTokenId: updated.particularTokenId ?? null,
            type: "special_stain_required",
            title: "Se requiere tinción especial",
            message:
              "El estudio requiere tinción especial. Revisá el seguimiento para continuar la gestión.",
            isRead: false,
            readAt: null,
          });

        finalCase =
          (await commands.updateStudyTrackingCase(updated.id, {
            specialStainNotifiedAt: notifiedAt,
          })) ?? updated;

        await notifySpecialStainByEmail(finalCase);
      }

      if (
        input.current.specialStainRequired &&
        !updated.specialStainRequired
      ) {
        specialStainResolvedNotification =
          await commands.createStudyTrackingNotification({
            studyTrackingCaseId: updated.id,
            clinicId: updated.clinicId,
            reportId: updated.reportId ?? null,
            particularTokenId: updated.particularTokenId ?? null,
            type: "special_stain_resolved",
            title: "Tinción especial resuelta",
            message: "La solicitud de tinción especial fue resuelta.",
            isRead: false,
            readAt: null,
          });
      }

      if (stageChanged) {
        stageChangeNotification =
          await commands.createStudyTrackingNotification({
            studyTrackingCaseId: finalCase.id,
            clinicId: finalCase.clinicId,
            reportId: finalCase.reportId ?? null,
            particularTokenId: finalCase.particularTokenId ?? null,
            type: "stage_changed",
            title: "Estado de estudio actualizado",
            message: `El estudio cambió de estado: ${getStudyTrackingStageLabel(input.current.currentStage)} → ${getStudyTrackingStageLabel(finalCase.currentStage)}.`,
            isRead: false,
            readAt: null,
          });
      }

      await sideEffects.writeAuditLog(input.auditRequest, {
        event: deps.auditEvents.caseUpdated,
        clinicId: finalCase.clinicId,
        reportId: finalCase.reportId ?? null,
        metadata: {
          trackingCaseId: finalCase.id,
          particularTokenId: finalCase.particularTokenId ?? null,
          fromStage: input.current.currentStage,
          toStage: finalCase.currentStage,
          specialStainRequired: finalCase.specialStainRequired,
          specialStainNotifiedAt: finalCase.specialStainNotifiedAt ?? null,
          labReceivedAt: finalCase.receptionAt,
          updatedVia: "admin",
        },
      });

      if (updateNotification) {
        await sideEffects.writeAuditLog(input.auditRequest, {
          event: deps.auditEvents.notificationCreated,
          clinicId: updateNotification.clinicId,
          reportId: updateNotification.reportId ?? null,
          metadata: {
            trackingCaseId: updateNotification.studyTrackingCaseId,
            notificationId: updateNotification.id,
            particularTokenId:
              updateNotification.particularTokenId ?? null,
            type: updateNotification.type,
            title: updateNotification.title,
            createdVia: "admin",
          },
        });
      }

      if (stageChangeNotification) {
        await sideEffects.writeAuditLog(input.auditRequest, {
          event: deps.auditEvents.notificationCreated,
          clinicId: stageChangeNotification.clinicId,
          reportId: stageChangeNotification.reportId ?? null,
          metadata: {
            trackingCaseId: stageChangeNotification.studyTrackingCaseId,
            notificationId: stageChangeNotification.id,
            particularTokenId:
              stageChangeNotification.particularTokenId ?? null,
            type: stageChangeNotification.type,
            title: stageChangeNotification.title,
            fromStage: input.current.currentStage,
            toStage: finalCase.currentStage,
            createdVia: "admin",
          },
        });
      }

      if (specialStainResolvedNotification) {
        await sideEffects.writeAuditLog(input.auditRequest, {
          event: deps.auditEvents.notificationCreated,
          clinicId: specialStainResolvedNotification.clinicId,
          reportId: specialStainResolvedNotification.reportId ?? null,
          metadata: {
            trackingCaseId:
              specialStainResolvedNotification.studyTrackingCaseId,
            notificationId: specialStainResolvedNotification.id,
            particularTokenId:
              specialStainResolvedNotification.particularTokenId ?? null,
            type: specialStainResolvedNotification.type,
            title: specialStainResolvedNotification.title,
            createdVia: "admin",
          },
        });
      }

      return { status: "updated", trackingCase: finalCase };
    },
  };
}
