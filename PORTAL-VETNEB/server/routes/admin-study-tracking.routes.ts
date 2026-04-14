import { Router } from "express";
import { getClinicById, getReportById } from "../db";
import {
  createStudyTrackingCase,
  createStudyTrackingNotification,
  getClinicScopedStudyTrackingCase,
  getStudyTrackingCaseById,
  listStudyTrackingCases,
  listStudyTrackingNotifications,
  updateStudyTrackingCase,
} from "../db-study-tracking";
import {
  getParticularTokenById,
  updateParticularTokenReport,
} from "../db-particular";
import { sendSpecialStainRequiredEmail } from "../lib/email";
import {
  adminCreateStudyTrackingSchema,
  applyEstimatedDeliveryRules,
  applyStageTimestampDefaults,
  buildValidationError,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
  shouldCreateSpecialStainNotification,
  updateStudyTrackingSchema,
} from "../lib/study-tracking";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

async function notifySpecialStainByEmail(trackingCase: {
  id: number;
  clinicId: number;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  currentStage: string;
  paymentUrl: string | null;
  adminContactEmail: string | null;
  adminContactPhone: string | null;
  notes: string | null;
}) {
  const clinic = await getClinicById(trackingCase.clinicId);

  if (!clinic) {
    console.warn("[EMAIL] special_stain_required skipped: clinic not found", {
      trackingCaseId: trackingCase.id,
      clinicId: trackingCase.clinicId,
    });
    return;
  }

  try {
    await sendSpecialStainRequiredEmail({
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
    console.error("[EMAIL] special_stain_required failed", {
      trackingCaseId: trackingCase.id,
      clinicId: trackingCase.clinicId,
      error,
    });
  }
}

router.use(requireAdminAuth);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const clinicId = parseEntityId(req.query.clinicId);
    const unreadOnly = parseBooleanQuery(req.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const notifications = await listStudyTrackingNotifications({
      clinicId,
      unreadOnly,
      limit,
      offset,
    });

    return res.json({
      success: true,
      count: notifications.length,
      notifications: notifications.map((notification) =>
        serializeStudyTrackingNotification(notification),
      ),
      pagination: {
        limit,
        offset,
      },
    });
  }),
);

router.post(
  "/",
  requireTrustedOrigin,
  asyncHandler(async (req, res) => {
    const parsed = adminCreateStudyTrackingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const clinic = await getClinicById(parsed.data.clinicId);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: "ClÃ­nica no encontrada",
      });
    }

    if (typeof parsed.data.reportId === "number") {
      const report = await getReportById(parsed.data.reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Informe no encontrado",
        });
      }

      if (report.clinicId !== parsed.data.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El informe no pertenece a la clÃ­nica indicada",
        });
      }
    }

    if (typeof parsed.data.particularTokenId === "number") {
      const particularToken = await getParticularTokenById(parsed.data.particularTokenId);

      if (!particularToken) {
        return res.status(404).json({
          success: false,
          error: "Token particular no encontrado",
        });
      }

      if (particularToken.clinicId !== parsed.data.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El token particular no pertenece a la clÃ­nica indicada",
        });
      }
    }

    const delivery = applyEstimatedDeliveryRules({
      receptionAt: parsed.data.receptionAt,
      manualEstimatedDeliveryAt: parsed.data.estimatedDeliveryAt,
    });

    const created = await createStudyTrackingCase({
      clinicId: parsed.data.clinicId,
      reportId: parsed.data.reportId ?? null,
      particularTokenId: parsed.data.particularTokenId ?? null,
      createdByAdminId: req.adminAuth!.id,
      createdByClinicUserId: null,
      receptionAt: parsed.data.receptionAt,
      estimatedDeliveryAt: delivery.estimatedDeliveryAt,
      estimatedDeliveryAutoCalculatedAt:
        delivery.estimatedDeliveryAutoCalculatedAt,
      estimatedDeliveryWasManuallyAdjusted:
        delivery.estimatedDeliveryWasManuallyAdjusted,
      currentStage: parsed.data.currentStage,
      processingAt: parsed.data.processingAt ?? null,
      evaluationAt: parsed.data.evaluationAt ?? null,
      reportDevelopmentAt: parsed.data.reportDevelopmentAt ?? null,
      deliveredAt: parsed.data.deliveredAt ?? null,
      specialStainRequired: parsed.data.specialStainRequired,
      specialStainNotifiedAt: null,
      paymentUrl: parsed.data.paymentUrl ?? null,
      adminContactEmail: parsed.data.adminContactEmail ?? null,
      adminContactPhone: parsed.data.adminContactPhone ?? null,
      notes: parsed.data.notes ?? null,
    });

    if (
      typeof created.particularTokenId === "number" &&
      typeof created.reportId === "number"
    ) {
      await updateParticularTokenReport(created.particularTokenId, created.reportId);
    }

    let finalCase = created;

    if (created.specialStainRequired) {
      const notifiedAt = new Date();

      await createStudyTrackingNotification({
        studyTrackingCaseId: created.id,
        clinicId: created.clinicId,
        reportId: created.reportId ?? null,
        particularTokenId: created.particularTokenId ?? null,
        type: "special_stain_required",
        title: "Se requiere tinciÃ³n especial",
        message:
          "El estudio ingresÃ³ a evaluaciÃ³n y requiere tinciÃ³n especial para continuar.",
        isRead: false,
        readAt: null,
      });

      finalCase = (await updateStudyTrackingCase(created.id, {
        specialStainNotifiedAt: notifiedAt,
      })) ?? created;

      await notifySpecialStainByEmail(finalCase);
    }

    return res.status(201).json({
      success: true,
      message: "Seguimiento creado correctamente",
      trackingCase: serializeStudyTrackingCase(finalCase),
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const clinicId = parseEntityId(req.query.clinicId);
    const reportId = parseEntityId(req.query.reportId);
    const particularTokenId = parseEntityId(req.query.particularTokenId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const trackingCases = await listStudyTrackingCases({
      clinicId,
      reportId,
      particularTokenId,
      limit,
      offset,
    });

    return res.json({
      success: true,
      count: trackingCases.length,
      trackingCases: trackingCases.map((trackingCase) =>
        serializeStudyTrackingCase(trackingCase),
      ),
      pagination: {
        limit,
        offset,
      },
    });
  }),
);

router.get(
  "/:trackingCaseId",
  asyncHandler(async (req, res) => {
    const trackingCaseId = parseEntityId(req.params.trackingCaseId);

    if (typeof trackingCaseId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de seguimiento invÃ¡lido",
      });
    }

    const clinicId = parseEntityId(req.query.clinicId);
    const trackingCase =
      typeof clinicId === "number"
        ? await getClinicScopedStudyTrackingCase(trackingCaseId, clinicId)
        : await getStudyTrackingCaseById(trackingCaseId);

    if (!trackingCase) {
      return res.status(404).json({
        success: false,
        error: "Seguimiento no encontrado",
      });
    }

    return res.json({
      success: true,
      trackingCase: serializeStudyTrackingCase(trackingCase),
    });
  }),
);

router.patch(
  "/:trackingCaseId",
  requireTrustedOrigin,
  asyncHandler(async (req, res) => {
    const trackingCaseId = parseEntityId(req.params.trackingCaseId);

    if (typeof trackingCaseId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de seguimiento invÃ¡lido",
      });
    }

    const clinicId = parseEntityId(req.body?.clinicId) ?? parseEntityId(req.query.clinicId);
    const current =
      typeof clinicId === "number"
        ? await getClinicScopedStudyTrackingCase(trackingCaseId, clinicId)
        : await getStudyTrackingCaseById(trackingCaseId);

    if (!current) {
      return res.status(404).json({
        success: false,
        error: "Seguimiento no encontrado",
      });
    }

    const parsed = updateStudyTrackingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    if (typeof parsed.data.reportId === "number") {
      const report = await getReportById(parsed.data.reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Informe no encontrado",
        });
      }

      if (report.clinicId !== current.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El informe no pertenece a la clÃ­nica del seguimiento",
        });
      }
    }

    if (typeof parsed.data.particularTokenId === "number") {
      const particularToken = await getParticularTokenById(parsed.data.particularTokenId);

      if (!particularToken) {
        return res.status(404).json({
          success: false,
          error: "Token particular no encontrado",
        });
      }

      if (particularToken.clinicId !== current.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El token particular no pertenece a la clÃ­nica del seguimiento",
        });
      }
    }

    const nextReceptionAt = parsed.data.receptionAt ?? current.receptionAt;
    const deliveryRecalculationNeeded =
      parsed.data.receptionAt instanceof Date || parsed.data.estimatedDeliveryAt instanceof Date;

    const delivery = deliveryRecalculationNeeded
      ? applyEstimatedDeliveryRules({
          receptionAt: nextReceptionAt,
          manualEstimatedDeliveryAt:
            parsed.data.estimatedDeliveryAt instanceof Date
              ? parsed.data.estimatedDeliveryAt
              : undefined,
        })
      : null;

    const stageDefaults = applyStageTimestampDefaults(current, {
      currentStage: parsed.data.currentStage,
      processingAt:
        typeof parsed.data.processingAt === "undefined"
          ? undefined
          : parsed.data.processingAt,
      evaluationAt:
        typeof parsed.data.evaluationAt === "undefined"
          ? undefined
          : parsed.data.evaluationAt,
      reportDevelopmentAt:
        typeof parsed.data.reportDevelopmentAt === "undefined"
          ? undefined
          : parsed.data.reportDevelopmentAt,
      deliveredAt:
        typeof parsed.data.deliveredAt === "undefined"
          ? undefined
          : parsed.data.deliveredAt,
    });

    const updated = await updateStudyTrackingCase(trackingCaseId, {
      reportId:
        typeof parsed.data.reportId === "undefined"
          ? undefined
          : parsed.data.reportId,
      particularTokenId:
        typeof parsed.data.particularTokenId === "undefined"
          ? undefined
          : parsed.data.particularTokenId,
      receptionAt: parsed.data.receptionAt,
      estimatedDeliveryAt: delivery?.estimatedDeliveryAt,
      estimatedDeliveryAutoCalculatedAt:
        delivery?.estimatedDeliveryAutoCalculatedAt,
      estimatedDeliveryWasManuallyAdjusted:
        delivery?.estimatedDeliveryWasManuallyAdjusted,
      currentStage: parsed.data.currentStage,
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
      specialStainRequired: parsed.data.specialStainRequired,
      paymentUrl: parsed.data.paymentUrl,
      adminContactEmail: parsed.data.adminContactEmail,
      adminContactPhone: parsed.data.adminContactPhone,
      notes: parsed.data.notes,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Seguimiento no encontrado",
      });
    }

    if (
      typeof updated.particularTokenId === "number" &&
      typeof updated.reportId === "number"
    ) {
      await updateParticularTokenReport(updated.particularTokenId, updated.reportId);
    }

    let finalCase = updated;

    if (
      shouldCreateSpecialStainNotification({
        previousRequired: current.specialStainRequired,
        nextRequired: updated.specialStainRequired,
        notifiedAt: updated.specialStainNotifiedAt,
      })
    ) {
      const notifiedAt = new Date();

      await createStudyTrackingNotification({
        studyTrackingCaseId: updated.id,
        clinicId: updated.clinicId,
        reportId: updated.reportId ?? null,
        particularTokenId: updated.particularTokenId ?? null,
        type: "special_stain_required",
        title: "Se requiere tinciÃ³n especial",
        message:
          "El estudio requiere tinciÃ³n especial. RevisÃ¡ el seguimiento para continuar la gestiÃ³n.",
        isRead: false,
        readAt: null,
      });

      finalCase = (await updateStudyTrackingCase(updated.id, {
        specialStainNotifiedAt: notifiedAt,
      })) ?? updated;

      await notifySpecialStainByEmail(finalCase);
    }

    return res.json({
      success: true,
      message: "Seguimiento actualizado correctamente",
      trackingCase: serializeStudyTrackingCase(finalCase),
    });
  }),
);

export default router;