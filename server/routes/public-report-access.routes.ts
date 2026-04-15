import { Router } from "express";
import {
  getReportAccessTokenWithReportByTokenHash,
  recordReportAccessTokenAccess,
} from "../db-report-access";
import { hashSessionToken } from "../lib/auth-security";
import {
  canAccessReportPublicly,
  getReportAccessTokenState,
  reportAccessTokenRawTokenSchema,
  serializePublicReportAccess,
} from "../lib/report-access-token";
import {
  createSignedReportDownloadUrl,
  createSignedReportUrl,
} from "../lib/supabase";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const parsed = reportAccessTokenRawTokenSchema.safeParse(req.params.token);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Token de acceso inválido",
      });
    }

    const tokenHash = hashSessionToken(parsed.data);
    const record = await getReportAccessTokenWithReportByTokenHash(tokenHash);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const tokenState = getReportAccessTokenState(record.token);

    if (tokenState === "revoked") {
      return res.status(410).json({
        success: false,
        error: "El token público de informe fue revocado",
      });
    }

    if (tokenState === "expired") {
      return res.status(410).json({
        success: false,
        error: "El token público de informe expiró",
      });
    }

    if (!canAccessReportPublicly(record.report.currentStatus)) {
      return res.status(409).json({
        success: false,
        error: "El informe todavía no está disponible para acceso público",
        currentStatus: record.report.currentStatus,
      });
    }

    const updatedToken = await recordReportAccessTokenAccess(record.token.id);
    const [previewUrl, downloadUrl] = await Promise.all([
      createSignedReportUrl(record.report.storagePath),
      createSignedReportDownloadUrl(
        record.report.storagePath,
        record.report.fileName ?? undefined,
      ),
    ]);

    return res.json({
      success: true,
      report: serializePublicReportAccess({
        report: record.report,
        previewUrl,
        downloadUrl,
      }),
      token: {
        accessCount: updatedToken?.accessCount ?? record.token.accessCount + 1,
        lastAccessAt: updatedToken?.lastAccessAt ?? new Date(),
        expiresAt: record.token.expiresAt,
      },
    });
  }),
);

export default router;
