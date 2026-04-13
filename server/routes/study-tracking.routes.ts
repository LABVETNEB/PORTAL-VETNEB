import { Router } from "express";
import { getClinicById, getReportById } from "../db";
import {
  createStudyTrackingCase,
  createStudyTrackingNotification,
  getClinicScopedStudyTrackingCase,
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
  applyEstimatedDeliveryRules,
  buildValidationError,
  clinicCreateStudyTrackingSchema,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
} from "../lib/study-tracking";
import { requireAuth } from "../middlewares/auth";
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

router.use(requireAuth);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const unreadOnly = parseBooleanQuery(req.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const notifications = await listStudyTrackingNotifications({
      clinicId: req.auth!.clinicId,
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
    const parsed = clinicCreateStudyTrackingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const clinic = await getClinicById(req.auth!.clinicId);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: "ClÃ­nica autenticada no encontrada",
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

      if (report.clinicId !== req.auth!.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El informe no pertenece a la clÃ­nica autenticada",
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

      if (particularToken.clinicId !== req.auth!.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El token particular no pertenece a la clÃ­nica autenticada",
        });
      }
    }

    const delivery = applyEstimatedDeliveryRules({
      receptionAt: parsed.data.receptionAt,
      manualEstimatedDeliveryAt: parsed.data.estimatedDeliveryAt,
    });

    const created = await createStudyTrackingCase({
      clinicId: req.auth!.clinicId,
      reportId: parsed.data.reportId ?? null,
      particularTokenId: parsed.data.particularTokenId ?? null,
      createdByAdminId: null,
      createdByClinicUserId: req.auth!.id,
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
          "El estudio requiere tinciÃ³n especial. Se generÃ³ una notificaciÃ³n para seguimiento.",
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
    const reportId = parseEntityId(req.query.reportId);
    const particularTokenId = parseEntityId(req.query.particularTokenId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const trackingCases = await listStudyTrackingCases({
      clinicId: req.auth!.clinicId,
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

    const trackingCase = await getClinicScopedStudyTrackingCase(
      trackingCaseId,
      req.auth!.clinicId,
    );

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

export default router;