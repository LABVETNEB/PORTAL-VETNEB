import { Router } from "express";
import { getClinicById, getReportById } from "../db";
import {
  createParticularToken,
  getParticularTokenById,
  listParticularTokens,
  updateParticularTokenReport,
} from "../db-particular";
import {
  generateSessionToken,
  hashSessionToken,
} from "../lib/auth-security";
import {
  adminCreateParticularTokenSchema,
  buildValidationError,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../lib/particular-token";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAdminAuth);

router.post(
  "/",
  requireTrustedOrigin,
  asyncHandler(async (req, res) => {
    const parsed = adminCreateParticularTokenSchema.safeParse(req.body);

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
        error: "Clínica no encontrada",
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
          error: "El informe no pertenece a la clínica indicada",
        });
      }
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    const particularToken = await createParticularToken({
      clinicId: parsed.data.clinicId,
      reportId:
        typeof parsed.data.reportId === "number" ? parsed.data.reportId : null,
      createdByAdminId: req.adminAuth!.id,
      createdByClinicUserId: null,
      tokenHash,
      tokenLast4: rawToken.slice(-4),
      tutorLastName: parsed.data.tutorLastName,
      petName: parsed.data.petName,
      petAge: parsed.data.petAge,
      petBreed: parsed.data.petBreed,
      petSex: parsed.data.petSex,
      petSpecies: parsed.data.petSpecies,
      sampleLocation: parsed.data.sampleLocation,
      sampleEvolution: parsed.data.sampleEvolution,
      detailsLesion: parsed.data.detailsLesion ?? null,
      extractionDate: parsed.data.extractionDate,
      shippingDate: parsed.data.shippingDate,
      isActive: true,
      lastLoginAt: null,
    });

    return res.status(201).json({
      success: true,
      message: "Token particular creado correctamente",
      token: rawToken,
      particularToken: serializeParticularToken(particularToken),
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const clinicId = parseEntityId(req.query.clinicId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const tokens = await listParticularTokens({
      clinicId,
      limit,
      offset,
    });

    return res.json({
      success: true,
      count: tokens.length,
      particularTokens: tokens.map((token) => serializeParticularToken(token)),
      pagination: {
        limit,
        offset,
      },
      filters: {
        clinicId: clinicId ?? null,
      },
    });
  }),
);

router.get(
  "/:tokenId",
  asyncHandler(async (req, res) => {
    const tokenId = parseEntityId(req.params.tokenId);

    if (typeof tokenId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de token inválido",
      });
    }

    const token = await getParticularTokenById(tokenId);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    const report =
      typeof token.reportId === "number"
        ? await getReportById(token.reportId)
        : null;

    return res.json({
      success: true,
      particularToken: serializeParticularTokenDetail(token, report),
    });
  }),
);

router.patch(
  "/:tokenId/report",
  requireTrustedOrigin,
  asyncHandler(async (req, res) => {
    const tokenId = parseEntityId(req.params.tokenId);

    if (typeof tokenId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de token inválido",
      });
    }

    const parsed = updateParticularTokenReportSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const token = await getParticularTokenById(tokenId);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token particular no encontrado",
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

      if (report.clinicId !== token.clinicId) {
        return res.status(400).json({
          success: false,
          error: "El informe no pertenece a la clínica del token",
        });
      }
    }

    const updated = await updateParticularTokenReport(
      tokenId,
      parsed.data.reportId,
    );

    const report =
      updated && typeof updated.reportId === "number"
        ? await getReportById(updated.reportId)
        : null;

    return res.json({
      success: true,
      message:
        typeof parsed.data.reportId === "number"
          ? "Informe vinculado al token correctamente"
          : "Informe desvinculado del token correctamente",
      particularToken: updated
        ? serializeParticularTokenDetail(updated, report)
        : null,
    });
  }),
);

export default router;
