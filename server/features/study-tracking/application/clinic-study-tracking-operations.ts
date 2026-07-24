import { applyEstimatedDeliveryRules } from "../domain/index.ts";
import type { StudyTrackingAuditPort } from "./ports/study-tracking-audit-port.ts";
import type { ClinicStudyTrackingCommandRepository } from "./ports/study-tracking-command-repository.ts";
import type { StudyTrackingNotificationPort } from "./ports/study-tracking-notification-port.ts";
import type { ClinicStudyTrackingQueryRepository } from "./ports/study-tracking-query-repository.ts";
import type { ClinicStudyTrackingReferenceRepository } from "./ports/clinic-study-tracking-reference-repository.ts";
import { createClinicStudyTrackingCommandUseCases } from "./study-tracking-command-use-cases.ts";
import { createClinicStudyTrackingQueryUseCases } from "./study-tracking-query-use-cases.ts";
import { createStudyTrackingSideEffectUseCases } from "./study-tracking-side-effect-use-cases.ts";

type ClinicStudyTrackingCaseRecord = {
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

type ClinicStudyTrackingNotificationRecord = {
  id: number;
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  type: string;
  title: string;
};

type ClinicReferenceRecord = {
  id: number;
  name: string;
  contactEmail?: string | null;
};

type ParticularTokenReferenceRecord = {
  clinicId: number;
};

export type ClinicStudyTrackingCaseListParams = {
  clinicId: number;
  reportId?: number;
  particularTokenId?: number;
  limit: number;
  offset: number;
};

export type ClinicStudyTrackingNotificationListParams = {
  clinicId: number;
  unreadOnly: boolean;
  limit: number;
  offset: number;
};

export type CreateClinicStudyTrackingCaseData = {
  reportId?: number;
  particularTokenId?: number;
  receptionAt: Date;
  currentStage: string;
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

type ClinicStudyTrackingAuditInput<TAuditEvent extends string> = {
  event: TAuditEvent;
  clinicId: number;
  reportId: number | null;
  metadata: Record<string, unknown>;
};

export type CreateClinicStudyTrackingCaseInput<TAuditRequest> = {
  actor: {
    clinicId: number;
    clinicUserId: number;
  };
  data: CreateClinicStudyTrackingCaseData;
  auditRequest: TAuditRequest;
};

export type CreateClinicStudyTrackingCaseResult<TCase> =
  | { status: "clinic_not_found" }
  | { status: "report_not_found" }
  | { status: "particular_token_not_found" }
  | { status: "particular_token_wrong_clinic" }
  | { status: "created"; trackingCase: TCase };

export function createClinicStudyTrackingOperations<
  TCase extends ClinicStudyTrackingCaseRecord,
  TNotification extends ClinicStudyTrackingNotificationRecord,
  TClinic extends ClinicReferenceRecord,
  TReport,
  TParticularToken extends ParticularTokenReferenceRecord,
  TAuditRequest,
  TAuditEvent extends string,
>(deps: {
  queryRepository: ClinicStudyTrackingQueryRepository<
    TCase,
    TNotification,
    ClinicStudyTrackingCaseListParams,
    ClinicStudyTrackingNotificationListParams
  >;
  commandRepository: ClinicStudyTrackingCommandRepository<
    TCase,
    TNotification,
    CreateStudyTrackingCaseRecordInput,
    Partial<TCase>,
    CreateStudyTrackingNotificationInput,
    { id: number; clinicId: number },
    { clinicId: number },
    { updatedCount: number }
  >;
  referenceRepository: ClinicStudyTrackingReferenceRepository<
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
    ClinicStudyTrackingAuditInput<TAuditEvent>
  >;
  auditEvents: {
    caseCreated: TAuditEvent;
    notificationCreated: TAuditEvent;
  };
  createDate: () => Date;
}) {
  const queries = createClinicStudyTrackingQueryUseCases(
    deps.queryRepository,
  );
  const commands = createClinicStudyTrackingCommandUseCases(
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
    listClinicStudyTrackingNotifications: (input: {
      clinicId: number;
      unreadOnly: boolean;
      limit: number;
      offset: number;
    }) => queries.listStudyTrackingNotifications(input),

    acknowledgeClinicStudyTrackingNotification: (input: {
      clinicId: number;
      notificationId: number;
    }) =>
      commands.markStudyTrackingNotificationReadScoped({
        id: input.notificationId,
        clinicId: input.clinicId,
      }),

    acknowledgeAllClinicStudyTrackingNotifications: (clinicId: number) =>
      commands.markAllStudyTrackingNotificationsReadScoped({ clinicId }),

    listClinicStudyTrackingCases: (
      input: ClinicStudyTrackingCaseListParams,
    ) => queries.listStudyTrackingCases(input),

    getClinicStudyTrackingCase: (input: {
      clinicId: number;
      trackingCaseId: number;
    }) =>
      queries.getClinicScopedStudyTrackingCase(
        input.trackingCaseId,
        input.clinicId,
      ),

    async createClinicStudyTrackingCase(
      input: CreateClinicStudyTrackingCaseInput<TAuditRequest>,
    ): Promise<CreateClinicStudyTrackingCaseResult<TCase>> {
      const clinic = await deps.referenceRepository.getClinicById(
        input.actor.clinicId,
      );

      if (!clinic) {
        return { status: "clinic_not_found" };
      }

      if (typeof input.data.reportId === "number") {
        const report =
          await deps.referenceRepository.getClinicScopedReportById(
            input.data.reportId,
            input.actor.clinicId,
          );

        if (!report) {
          return { status: "report_not_found" };
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

        if (particularToken.clinicId !== input.actor.clinicId) {
          return { status: "particular_token_wrong_clinic" };
        }
      }

      const delivery = applyEstimatedDeliveryRules({
        receptionAt: input.data.receptionAt,
        manualEstimatedDeliveryAt: undefined,
      });

      const created = await commands.createStudyTrackingCase({
        clinicId: input.actor.clinicId,
        reportId: input.data.reportId ?? null,
        particularTokenId: input.data.particularTokenId ?? null,
        createdByAdminId: null,
        createdByClinicUserId: input.actor.clinicUserId,
        receptionAt: input.data.receptionAt,
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
              "El estudio requiere tinción especial. Se generó una notificación para seguimiento.",
            isRead: false,
            readAt: null,
          });

        finalCase =
          (await commands.updateStudyTrackingCase(created.id, {
            specialStainNotifiedAt: notifiedAt,
          } as Partial<TCase>)) ?? created;

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
          estimatedDeliveryWasManuallyAdjusted:
            finalCase.estimatedDeliveryWasManuallyAdjusted,
          createdVia: "clinic",
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
            createdVia: "clinic",
          },
        });
      }

      return { status: "created", trackingCase: finalCase };
    },
  };
}
