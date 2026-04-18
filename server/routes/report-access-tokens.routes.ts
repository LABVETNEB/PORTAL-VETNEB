import { Router } from "express";
import { getReportById } from "../db";
import {
  createReportAccessToken,
  getClinicScopedReportAccessToken,
  listReportAccessTokens,
  revokeReportAccessToken,
} from "../db-report-access";
import {
  generateSessionToken,
  hashSessionToken,
} from "../lib/auth-security";
import {
  buildPublicReportAccessPath,
  buildValidationError,
  clinicCreateReportAccessTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeReportAccessToken,
  serializeReportAccessTokenDetail,
} from "../lib/report-access-token";
import { requireAuth } from "../middlewares/auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth);

const requireReportAccessTokenManagementPermission = asyncHandler(
  async (req, res, next) => {
    if (!req.auth?.canManageClinicUsers) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para administrar tokens públicos de informes",
      });
    }

    next();
  },
);

router.post(
  "/",
  requireTrustedOrigin,
  requireReportAccessTokenManagementPermission,
  asyncHandler(async (req, res) => {
    const parsed = clinicCreateReportAccessTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const report = await getReportById(parsed.data.reportId);

    if (!report || report.clinicId !== req.auth!.clinicId) {
      return res.status(404).json({
        success: false,
        error: "Informe no encontrado para la clínica autenticada",
      });
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    const reportAccessToken = await createReportAccessToken({
      clinicId: req.auth!.clinicId,
      reportId: report.id,
      tokenHash,
      tokenLast4: rawToken.slice(-4),
      expiresAt: parsed.data.expiresAt ?? null,
      createdByClinicUserId: req.auth!.id,
      createdByAdminUserId: null,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    });

    return res.status(201).json({
      success: true,
      message: "Token público de informe creado correctamente",
      token: rawToken,
      publicAccessPath: buildPublicReportAccessPath(rawToken),
      reportAccessToken: serializeReportAccessToken(reportAccessToken),
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const reportId = parseEntityId(req.query.reportId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const tokens = await listReportAccessTokens({
      clinicId: req.auth!.clinicId,
      reportId,
      limit,
      offset,
    });

    return res.json({
      success: true,
      count: tokens.length,
      reportAccessTokens: tokens.map((token) => serializeReportAccessToken(token)),
      pagination: {
        limit,
        offset,
      },
      filters: {
        reportId: reportId ?? null,
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

    const token = await getClinicScopedReportAccessToken(tokenId, req.auth!.clinicId);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const report = await getReportById(token.reportId);

    return res.json({
      success: true,
      reportAccessToken: serializeReportAccessTokenDetail(token, report),
    });
  }),
);

router.patch(
  "/:tokenId/revoke",
  requireTrustedOrigin,
  requireReportAccessTokenManagementPermission,
  asyncHandler(async (req, res) => {
    const tokenId = parseEntityId(req.params.tokenId);

    if (typeof tokenId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de token inválido",
      });
    }

    const existing = await getClinicScopedReportAccessToken(tokenId, req.auth!.clinicId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const revoked = await revokeReportAccessToken({
      id: tokenId,
      revokedByClinicUserId: req.auth!.id,
      revokedByAdminUserId: null,
    });

    const report = revoked ? await getReportById(revoked.reportId) : null;

    return res.json({
      success: true,
      message: "Token público de informe revocado correctamente",
      reportAccessToken: revoked
        ? serializeReportAccessTokenDetail(revoked, report)
        : null,
    });
  }),
);

export default router;
