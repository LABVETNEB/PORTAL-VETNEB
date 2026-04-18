import { Router } from "express";
import { getClinicById, getReportById } from "../db";
import {
  createReportAccessToken,
  getReportAccessTokenById,
  listReportAccessTokens,
  revokeReportAccessToken,
} from "../db-report-access";
import {
  generateSessionToken,
  hashSessionToken,
} from "../lib/auth-security";
import {
  adminCreateReportAccessTokenSchema,
  buildPublicReportAccessPath,
  buildValidationError,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeReportAccessToken,
  serializeReportAccessTokenDetail,
} from "../lib/report-access-token";
import { AUDIT_EVENTS, writeAuditLog } from "../lib/audit";
import { createReportAccessTokenMutationRateLimit } from "../lib/report-access-token-rate-limit";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const reportAccessTokenMutationRateLimit =
  createReportAccessTokenMutationRateLimit();

router.use(requireAdminAuth);

router.post(
  "/",
  requireTrustedOrigin,
  reportAccessTokenMutationRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = adminCreateReportAccessTokenSchema.safeParse(req.body);

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

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    const reportAccessToken = await createReportAccessToken({
      clinicId: parsed.data.clinicId,
      reportId: report.id,
      tokenHash,
      tokenLast4: rawToken.slice(-4),
      expiresAt: parsed.data.expiresAt ?? null,
      createdByClinicUserId: null,
      createdByAdminUserId: req.adminAuth!.id,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    });

    await writeAuditLog(req, {
      event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED,
      clinicId: reportAccessToken.clinicId,
      reportId: reportAccessToken.reportId,
      targetReportAccessTokenId: reportAccessToken.id,
      metadata: {
        tokenLast4: reportAccessToken.tokenLast4,
        expiresAt: reportAccessToken.expiresAt,
        createdVia: "admin",
      },
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
    const clinicId = parseEntityId(req.query.clinicId);
    const reportId = parseEntityId(req.query.reportId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const tokens = await listReportAccessTokens({
      clinicId,
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
        clinicId: clinicId ?? null,
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

    const token = await getReportAccessTokenById(tokenId);

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
  reportAccessTokenMutationRateLimit,
  asyncHandler(async (req, res) => {
    const tokenId = parseEntityId(req.params.tokenId);

    if (typeof tokenId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de token inválido",
      });
    }

    const existing = await getReportAccessTokenById(tokenId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const revoked = await revokeReportAccessToken({
      id: tokenId,
      revokedByClinicUserId: null,
      revokedByAdminUserId: req.adminAuth!.id,
    });

    const report = revoked ? await getReportById(revoked.reportId) : null;

    if (revoked) {
      await writeAuditLog(req, {
        event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED,
        clinicId: revoked.clinicId,
        reportId: revoked.reportId,
        targetReportAccessTokenId: revoked.id,
        metadata: {
          tokenLast4: revoked.tokenLast4,
          revokedAt: revoked.revokedAt,
          revokedVia: "admin",
        },
      });
    }

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
