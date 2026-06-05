import type { ParticularToken, StudyTrackingCase } from "../../drizzle/schema.ts";
import {
  applyEstimatedDeliveryRules,
  applyStageTimestampDefaults,
} from "./study-tracking.ts";

type TokenTrackingRecord = Pick<
  ParticularToken,
  | "id"
  | "clinicId"
  | "reportId"
  | "detailsLesion"
  | "createdByAdminId"
  | "createdByClinicUserId"
>;

type EnsureTokenTrackingInput = {
  token: TokenTrackingRecord;
  createdByAdminId?: number | null;
  createdByClinicUserId?: number | null;
  now?: Date;
};

type EnsureTokenTrackingDeps = {
  getParticularStudyTrackingCase: (
    particularTokenId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  getStudyTrackingCaseByReportId: (
    reportId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  createStudyTrackingCase: (
    input: Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">,
  ) => Promise<StudyTrackingCase>;
  updateStudyTrackingCase: (
    id: number,
    input: Partial<Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<StudyTrackingCase | null | undefined>;
};

function hasAnyPatchValue(
  patch: Partial<Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">>,
): boolean {
  return Object.keys(patch).length > 0;
}

export async function ensureStudyTrackingCaseForToken(
  deps: EnsureTokenTrackingDeps,
  input: EnsureTokenTrackingInput,
): Promise<StudyTrackingCase> {
  const now = input.now ?? new Date();
  const token = input.token;
  const tokenReportId =
    typeof token.reportId === "number" ? token.reportId : null;

  const caseByToken =
    (await deps.getParticularStudyTrackingCase(token.id)) ?? null;
  const caseByReport =
    tokenReportId === null
      ? null
      : ((await deps.getStudyTrackingCaseByReportId(tokenReportId)) ?? null);

  if (caseByToken) {
    const patch: Partial<
      Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">
    > = {};

    if (
      tokenReportId !== null &&
      caseByToken.reportId !== tokenReportId &&
      (!caseByReport || caseByReport.id === caseByToken.id)
    ) {
      patch.reportId = tokenReportId;
    }

    if (tokenReportId !== null && caseByToken.currentStage !== "delivered") {
      const stageDefaults = applyStageTimestampDefaults(caseByToken, {
        currentStage: "delivered",
      });
      patch.currentStage = "delivered";
      patch.deliveredAt = stageDefaults.deliveredAt ?? now;
    }

    if (!hasAnyPatchValue(patch)) {
      return caseByToken;
    }

    return (await deps.updateStudyTrackingCase(caseByToken.id, patch)) ?? caseByToken;
  }

  if (caseByReport && caseByReport.particularTokenId === token.id) {
    if (caseByReport.currentStage === "delivered") {
      return caseByReport;
    }

    const stageDefaults = applyStageTimestampDefaults(caseByReport, {
      currentStage: "delivered",
    });
    return (
      (await deps.updateStudyTrackingCase(caseByReport.id, {
        currentStage: "delivered",
        deliveredAt: stageDefaults.deliveredAt ?? now,
      })) ?? caseByReport
    );
  }

  if (caseByReport && caseByReport.particularTokenId === null) {
    const patch: Partial<
      Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">
    > = {
      particularTokenId: token.id,
    };

    if (caseByReport.currentStage !== "delivered") {
      const stageDefaults = applyStageTimestampDefaults(caseByReport, {
        currentStage: "delivered",
      });
      patch.currentStage = "delivered";
      patch.deliveredAt = stageDefaults.deliveredAt ?? now;
    }

    return (await deps.updateStudyTrackingCase(caseByReport.id, patch)) ?? caseByReport;
  }

  const labReceivedAt = now;
  const delivery = applyEstimatedDeliveryRules({ labReceivedAt });
  const createdByAdminId =
    input.createdByAdminId ?? token.createdByAdminId ?? null;
  const createdByClinicUserId =
    input.createdByClinicUserId ?? token.createdByClinicUserId ?? null;
  const isDelivered = tokenReportId !== null;

  return deps.createStudyTrackingCase({
    clinicId: token.clinicId,
    reportId: tokenReportId,
    particularTokenId: token.id,
    createdByAdminId,
    createdByClinicUserId,
    receptionAt: labReceivedAt,
    estimatedDeliveryAt: delivery.estimatedDeliveryAt,
    estimatedDeliveryAutoCalculatedAt: delivery.estimatedDeliveryAutoCalculatedAt,
    estimatedDeliveryWasManuallyAdjusted:
      delivery.estimatedDeliveryWasManuallyAdjusted,
    currentStage: isDelivered ? "delivered" : "reception",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: isDelivered ? now : null,
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: null,
    adminContactEmail: null,
    adminContactPhone: null,
    notes: token.detailsLesion ?? null,
  });
}
